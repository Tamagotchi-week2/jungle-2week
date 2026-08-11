import { randomInt } from 'node:crypto';

import type { Pet, Species, TradeStatus } from '@/generated/prisma';
import type { Prisma } from '@/generated/prisma';

import { db } from '@/lib/server/db';
import { BALANCE } from '@/lib/game/constants';
import { DomainError } from '@/lib/server/errors';
import { registerSpecies } from '@/lib/server/services/dex';
import type {
  TradeCreateResponse,
  TradeJoinResponse,
  TradePetView,
  TradeResolveResponse,
} from '@/types/api';

/** 혼동되는 0/O, 1/I 를 제외한 대문자·숫자 (17.4) */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
// 수치는 constants.ts 가 유일한 출처다 (원칙 3)
const TRADE_CODE_TTL_MS = BALANCE.TRADE_CODE_TTL_MINUTES * 60 * 1000;

export class TradeError extends DomainError {}

type PetWithSpecies = Pet & { species: Species | null };
type Tx = Prisma.TransactionClient;

function toTradePetView(pet: PetWithSpecies): TradePetView {
  if (!pet.species) {
    throw new TradeError('3차 성체가 아닌 개체는 교환할 수 없습니다.');
  }
  return {
    id: pet.id,
    speciesName: pet.species.name,
    eggType: pet.eggType,
    combo: pet.species.combo,
    isAlbino: pet.isAlbino,
  };
}

function randomCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

async function generateUniqueCode(tx: Tx): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    const existing = await tx.trade.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new TradeError('코드 발급에 실패했습니다. 다시 시도해 주세요.');
}

/** 만료·상태 이상 등으로 교환을 무효화하고 잠긴 개체를 모두 해제한다 */
async function invalidateTrade(
  tx: Tx,
  trade: { id: string; fromPetId: string; toPetId: string | null },
  status: 'cancelled' = 'cancelled',
) {
  const petIds = [trade.fromPetId, trade.toPetId].filter(
    (id): id is string => id !== null,
  );
  await tx.pet.updateMany({
    where: { id: { in: petIds }, lockedByTradeId: trade.id },
    data: { lockedByTradeId: null },
  });
  await tx.trade.update({
    where: { id: trade.id },
    data: { status, resolvedAt: new Date() },
  });
}

async function assertTradeablePet(tx: Tx, petId: string, userId: string) {
  const pet = await tx.pet.findUnique({
    where: { id: petId },
    include: { species: true },
  });
  if (!pet || pet.ownerId !== userId) {
    throw new TradeError('본인 소유의 개체가 아닙니다.');
  }
  if (pet.stage !== 3) {
    throw new TradeError('3차 성체만 교환할 수 있습니다.');
  }
  if (pet.isTraded) {
    throw new TradeError('이미 교환된 개체입니다.');
  }
  if (pet.lockedByTradeId) {
    throw new TradeError('다른 교환 제안에 잠겨 있는 개체입니다.');
  }
  return pet;
}

/** 내 성체를 걸고 교환 코드를 발급한다 (9장 / 17.4 1단계) */
export async function createTrade(
  userId: string,
  petId: string,
): Promise<TradeCreateResponse> {
  return db.$transaction(async (tx) => {
    const pet = await assertTradeablePet(tx, petId, userId);
    const code = await generateUniqueCode(tx);
    const expiresAt = new Date(Date.now() + TRADE_CODE_TTL_MS);

    const trade = await tx.trade.create({
      data: { code, expiresAt, fromUserId: userId, fromPetId: pet.id },
    });

    await tx.pet.update({
      where: { id: pet.id },
      data: { lockedByTradeId: trade.id },
    });

    return {
      code: trade.code,
      expiresAt: trade.expiresAt.toISOString(),
      myPet: toTradePetView(pet),
    };
  });
}

/** 코드를 입력하고 내 성체를 지정한다 (17.4 2단계) */
export async function joinTrade(
  userId: string,
  code: string,
  petId: string,
): Promise<TradeJoinResponse> {
  return db.$transaction(async (tx) => {
    const trade = await tx.trade.findUnique({
      where: { code },
      include: { fromPet: { include: { species: true } } },
    });
    if (!trade) {
      throw new TradeError('존재하지 않는 교환 코드입니다.');
    }
    if (trade.status !== 'proposed') {
      throw new TradeError('이미 처리된 교환 코드입니다.');
    }
    if (trade.expiresAt < new Date()) {
      await invalidateTrade(tx, trade);
      throw new TradeError('만료된 교환 코드입니다.');
    }
    if (trade.fromUserId === userId) {
      throw new TradeError('자신이 제안한 교환에는 참여할 수 없습니다.');
    }

    const pet = await assertTradeablePet(tx, petId, userId);

    await tx.pet.update({
      where: { id: pet.id },
      data: { lockedByTradeId: trade.id },
    });
    const updated = await tx.trade.update({
      where: { id: trade.id },
      data: { toUserId: userId, toPetId: pet.id, status: 'joined' },
    });

    return {
      tradeId: updated.id,
      theirPet: toTradePetView(trade.fromPet),
      myPet: toTradePetView(pet),
    };
  });
}

/**
 * 제안자가 최종 수락 / 거절한다 (17.4 3·4단계).
 * 참여 시점과 수락 시점 사이에 개체 상태가 변할 수 있으므로 트랜잭션 직전에 재검증한다 (9장).
 */
export async function resolveTrade(
  userId: string,
  tradeId: string,
  accept: boolean,
): Promise<TradeResolveResponse> {
  return db.$transaction(async (tx) => {
    const trade = await tx.trade.findUnique({
      where: { id: tradeId },
      include: {
        fromPet: { include: { species: true } },
        toPet: { include: { species: true } },
      },
    });
    if (!trade) {
      throw new TradeError('존재하지 않는 교환입니다.');
    }
    if (trade.fromUserId !== userId) {
      throw new TradeError('제안자만 수락 또는 거절할 수 있습니다.');
    }
    if (trade.status !== 'joined' || !trade.toPet || !trade.toUserId) {
      throw new TradeError('아직 상대가 참여하지 않았거나 이미 처리된 교환입니다.');
    }
    if (trade.expiresAt < new Date()) {
      await invalidateTrade(tx, trade);
      throw new TradeError('만료된 교환입니다.');
    }

    const { fromPet, toPet, toUserId } = trade;
    for (const pet of [fromPet, toPet]) {
      if (pet.stage !== 3 || pet.isTraded || pet.lockedByTradeId !== trade.id) {
        await invalidateTrade(tx, trade);
        throw new TradeError('개체 상태가 변경되어 더 이상 교환할 수 없습니다.');
      }
    }

    if (!accept) {
      await tx.pet.updateMany({
        where: { id: { in: [fromPet.id, toPet.id] } },
        data: { lockedByTradeId: null },
      });
      await tx.trade.update({
        where: { id: trade.id },
        data: { status: 'rejected', resolvedAt: new Date() },
      });
      return { status: 'rejected', received: null };
    }

    await tx.pet.update({
      where: { id: fromPet.id },
      data: { ownerId: toUserId, isTraded: true, lockedByTradeId: null },
    });
    await tx.pet.update({
      where: { id: toPet.id },
      data: { ownerId: trade.fromUserId, isTraded: true, lockedByTradeId: null },
    });

    if (!toPet.speciesId || !fromPet.speciesId) {
      throw new TradeError('3차 성체가 아닌 개체는 교환할 수 없습니다.');
    }
    await registerSpecies(tx, trade.fromUserId, toPet.speciesId, toPet.isAlbino);
    await registerSpecies(tx, toUserId, fromPet.speciesId, fromPet.isAlbino);

    await tx.trade.update({
      where: { id: trade.id },
      data: { status: 'accepted', resolvedAt: new Date() },
    });

    return { status: 'accepted', received: toTradePetView(toPet) };
  });
}

export interface TradeStatusView {
  tradeId: string;
  status: TradeStatus;
  code: string;
  expiresAt: string;
  /** 이 상태를 조회한 세션 사용자 기준 내 개체 */
  myPet: TradePetView;
  /** 상대가 아직 참여하지 않았으면 null */
  theirPet: TradePetView | null;
}

/**
 * 코드로 교환 상태를 조회한다. 제안자가 상대 참여 여부를 확인할 때 쓴다.
 * api.ts 에 정의되지 않은 내부 폴링 전용 엔드포인트로, 참여 당사자만 조회할 수 있다.
 */
export async function getTradeStatusByCode(
  userId: string,
  code: string,
): Promise<TradeStatusView> {
  const trade = await db.trade.findUnique({
    where: { code },
    include: {
      fromPet: { include: { species: true } },
      toPet: { include: { species: true } },
    },
  });
  if (!trade) {
    throw new TradeError('존재하지 않는 교환 코드입니다.');
  }
  if (trade.fromUserId !== userId && trade.toUserId !== userId) {
    throw new TradeError('본인이 참여한 교환만 조회할 수 있습니다.');
  }

  const isFrom = trade.fromUserId === userId;
  const myPet = isFrom ? trade.fromPet : trade.toPet;
  const theirPet = isFrom ? trade.toPet : trade.fromPet;
  if (!myPet) {
    throw new TradeError('교환 정보를 찾을 수 없습니다.');
  }

  return {
    tradeId: trade.id,
    status: trade.status,
    code: trade.code,
    expiresAt: trade.expiresAt.toISOString(),
    myPet: toTradePetView(myPet),
    theirPet: theirPet ? toTradePetView(theirPet) : null,
  };
}

/**
 * 교환 취소 (9장 상태머신의 `취소`).
 *
 * 코드를 발급했는데 상대가 오지 않으면 만료(10분)까지 개체가 잠긴 채 묶인다.
 * 그동안 다른 사람과 교환할 수 없으므로, 제안자가 직접 풀 수 있어야 한다.
 *
 * 상대가 참여한 뒤에도 취소할 수 있다. 이 시점에는 상대 개체까지 잠겨 있어
 * 방치하면 두 사람이 함께 묶인다. 다만 이미 완료·거절된 건은 되돌리지 않는다.
 */
export async function cancelTrade(
  userId: string,
  tradeId: string,
): Promise<{ status: 'cancelled' }> {
  return db.$transaction(async (tx) => {
    const trade = await tx.trade.findUnique({ where: { id: tradeId } });
    if (!trade) {
      throw new TradeError('존재하지 않는 교환입니다.');
    }
    if (trade.fromUserId !== userId) {
      throw new TradeError('제안자만 취소할 수 있습니다.');
    }
    if (trade.status !== 'proposed' && trade.status !== 'joined') {
      throw new TradeError('이미 처리된 교환입니다.');
    }

    // 잠긴 개체 해제까지 함께 처리한다
    await invalidateTrade(tx, trade);
    return { status: 'cancelled' as const };
  });
}
