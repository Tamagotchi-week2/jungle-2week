import { randomInt } from 'node:crypto';

import type { Pet, Species, TradeStatus } from '@/generated/prisma';
import type { Prisma } from '@/generated/prisma';

import { db } from '@/lib/server/db';
import { BALANCE } from '@/lib/game/constants';
import { DomainError } from '@/lib/server/errors';
import { registerSpecies } from '@/lib/server/services/dex';
import { toTradePetView } from '@/lib/server/services/mappers';
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

/**
 * 진행 중인 교환은 계정당 하나로 제한한다.
 *
 * 예전에는 개체마다 따로 걸 수 있어 한 계정이 여러 건을 동시에 들고 있었다.
 * 교환소는 콘솔이 하나뿐이라 그중 최신 건만 보여줬고, 그걸 취소하면 숨어 있던
 * 이전 건이 튀어나와 "취소했는데 왜 아직 진행 중이지" 로 보였다.
 *
 * 아직 상대가 없는 건(proposed)은 사용자가 잊은 것으로 보고 조용히 정리한다.
 * 상대가 이미 들어온 건(joined)은 함부로 없애지 않는다 — 저쪽이 내 확정을
 * 기다리고 있으므로, 그쪽을 먼저 처리하라고 알린다.
 */
async function assertSingleActiveTrade(tx: Tx, userId: string) {
  const active = await tx.trade.findMany({
    where: {
      status: { in: ['proposed', 'joined'] },
      OR: [{ fromUserId: userId }, { toUserId: userId }],
    },
    select: { id: true, status: true, fromPetId: true, toPetId: true },
  });

  if (active.some((t) => t.status === 'joined')) {
    throw new TradeError(
      '이미 상대가 참여한 교환이 있습니다. 그 교환을 먼저 확정하거나 취소해 주세요.',
    );
  }
  for (const stale of active) {
    await invalidateTrade(tx, stale);
  }
}

/** 내 성체를 걸고 교환 코드를 발급한다 (9장 / 17.4 1단계) */
export async function createTrade(
  userId: string,
  petId: string,
): Promise<TradeCreateResponse> {
  return db.$transaction(async (tx) => {
    await assertSingleActiveTrade(tx, userId);
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
  const result = await db.$transaction(async (tx) => {
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
      // 여기서 throw 하면 트랜잭션이 롤백되어 잠금 해제까지 취소된다.
      // 개체가 영구히 묶이므로, 무효화를 커밋한 뒤 바깥에서 throw 한다.
      await invalidateTrade(tx, trade);
      return { expired: true } as const;
    }
    if (trade.fromUserId === userId) {
      throw new TradeError('자신이 제안한 교환에는 참여할 수 없습니다.');
    }

    // 발급뿐 아니라 참여로도 교환이 열린다. 여기를 빼먹으면 내 제안 하나와
    // 남의 교환 참여 하나가 동시에 살아 있어, 하나를 취소해도 화면이 다른
    // 하나로 복귀한다.
    await assertSingleActiveTrade(tx, userId);

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
      expired: false,
      value: {
        tradeId: updated.id,
        theirPet: toTradePetView(trade.fromPet),
        myPet: toTradePetView(pet),
      },
    } as const;
  });

  if (result.expired) {
    throw new TradeError('만료된 교환 코드입니다.');
  }
  return result.value;
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
  const result = await db.$transaction(async (tx) => {
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
    // 무효화 후 곧바로 throw 하면 트랜잭션이 롤백되어 잠금 해제까지 취소된다.
    // 개체가 영구히 묶이므로, 무효화를 커밋한 뒤 바깥에서 throw 한다.
    if (trade.expiresAt < new Date()) {
      await invalidateTrade(tx, trade);
      return { failed: '만료된 교환입니다.' } as const;
    }

    const { fromPet, toPet, toUserId } = trade;
    for (const pet of [fromPet, toPet]) {
      if (pet.stage !== 3 || pet.isTraded || pet.lockedByTradeId !== trade.id) {
        await invalidateTrade(tx, trade);
        return {
          failed: '개체 상태가 변경되어 더 이상 교환할 수 없습니다.',
        } as const;
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
      return { failed: null, value: { status: 'rejected' as const, received: null } } as const;
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

    return {
      failed: null,
      value: { status: 'accepted' as const, received: toTradePetView(toPet) },
    } as const;
  });

  if (result.failed) {
    throw new TradeError(result.failed);
  }
  return result.value;
}

/**
 * 유효 시간이 지난 내 교환을 정리하고 잠긴 개체를 돌려준다.
 *
 * 만료 검사는 원래 joinTrade / resolveTrade 안에서만 일어났다. 즉 **누군가 그
 * 교환을 건드려야** 비로소 만료가 반영된다. 코드를 발급해 놓고 아무도 참여하지
 * 않은 채 창을 닫으면 개체가 사실상 영구히 묶였다 — 유효 시간이 지나도 그 사실을
 * 아무도 확인해 주지 않기 때문이다.
 *
 * 그래서 목록을 읽기 전에 이 함수를 먼저 부른다. 주기적으로 도는 작업을 두지
 * 않고도 같은 효과를 낸다. 이미 만료된 건만 손대므로 살아 있는 교환에는 영향이 없다.
 *
 * @returns 이번에 정리한 교환 수
 */
export async function releaseExpiredTrades(userId: string): Promise<number> {
  const expired = await db.trade.findMany({
    where: {
      status: { in: ['proposed', 'joined'] },
      expiresAt: { lt: new Date() },
      OR: [{ fromUserId: userId }, { toUserId: userId }],
    },
    select: { id: true, fromPetId: true, toPetId: true },
  });

  if (expired.length === 0) {
    return 0;
  }

  // 건별로 트랜잭션을 연다. 하나가 이미 다른 요청에서 처리됐더라도 나머지는
  // 정리되어야 한다.
  //
  // 상태는 cancelled 로 남긴다. 스키마가 만료를 cancelled 에 포함하도록
  // 정의해 두었고(TradeStatus 주석), 전용 값을 새로 넣으려면 마이그레이션이
  // 필요한데 구분해서 얻는 것이 없다.
  for (const trade of expired) {
    await db.$transaction((tx) => invalidateTrade(tx, trade));
  }
  return expired.length;
}

export interface TradeStatusView {
  tradeId: string;
  status: TradeStatus;
  code: string;
  expiresAt: string;
  /**
   * 조회한 사람이 제안자인가. 확정·취소 권한은 제안자에게만 있으므로,
   * 화면을 복원할 때 어느 단계로 되돌릴지 이 값으로 가른다.
   */
  iAmProposer: boolean;
  /** 이 상태를 조회한 세션 사용자 기준 내 개체 */
  myPet: TradePetView;
  /** 상대가 아직 참여하지 않았으면 null */
  theirPet: TradePetView | null;
}

/**
 * 지금 내가 끼어 있는, 아직 끝나지 않은 교환.
 *
 * 교환 진행 상태는 그동안 브라우저 메모리에만 있었다. 새로고침하면 화면은
 * 잊어버리는데 서버는 멀쩡히 기억하고 있어서, 개체가 잠긴 채 취소할 방법도
 * 없어졌다. 이 조회로 화면이 하던 교환에 다시 붙는다.
 *
 * /api/me 에 얹지 않는다. 자원을 먹을 때마다 불리는 엔드포인트라, 대부분 null 인
 * 값을 위해 매번 조인을 붙일 이유가 없다. 교환 화면에 들어올 때만 부른다.
 *
 * 만료된 건은 먼저 정리하므로 여기로 새어 나오지 않는다.
 */
export async function getActiveTrade(
  userId: string,
): Promise<TradeStatusView | null> {
  await releaseExpiredTrades(userId);

  const trade = await db.trade.findFirst({
    where: {
      status: { in: ['proposed', 'joined'] },
      OR: [{ fromUserId: userId }, { toUserId: userId }],
    },
    include: {
      fromPet: { include: { species: true } },
      toPet: { include: { species: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!trade) {
    return null;
  }

  const isFrom = trade.fromUserId === userId;
  const myPet = isFrom ? trade.fromPet : trade.toPet;
  if (!myPet) {
    return null;
  }

  return {
    tradeId: trade.id,
    status: trade.status,
    code: trade.code,
    expiresAt: trade.expiresAt.toISOString(),
    // 제안자인지 참여자인지에 따라 화면이 할 수 있는 일이 다르다. 화면이 그걸
    // 판단할 수 있도록 알려준다 — 참여자는 확정 권한이 없다.
    iAmProposer: isFrom,
    myPet: toTradePetView(myPet),
    theirPet: (() => {
      const other = isFrom ? trade.toPet : trade.fromPet;
      return other ? toTradePetView(other) : null;
    })(),
  };
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
    iAmProposer: isFrom,
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
