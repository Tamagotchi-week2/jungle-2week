/**
 * 개체 서비스 — 부화 · 급여 · 진화 (설계 문서 2·3·6장).
 *
 * 규칙 판정은 전부 src/lib/game 의 순수 함수가 하고, 여기서는 DB 상태를 읽어
 * 넘기고 결과를 저장하는 일만 한다. 이 경계를 지키면 UI 를 아무리 급하게 짜도
 * 게임 규칙은 깨지지 않는다.
 */

import { db } from '@/lib/server/db';
import { BALANCE } from '@/lib/game/constants';
import {
  canEvolve as canEvolvePure,
  createEgg,
  evolve as evolvePure,
  feed as feedPure,
  hatch as hatchPure,
} from '@/lib/game/evolution';
import type { Combo, EggType, ResourceType, Trait } from '@/lib/game/types';
import { RESOURCE_TRAIT, STAGE } from '@/lib/game/types';
import type {
  EvolveResponse,
  FeedResponse,
  HatchResponse,
} from '@/types/api';
import { registerSpecies } from './dex';
import { toEvolutionState, toPetView } from './mappers';

/** 요청이 규칙에 어긋날 때. 라우트에서 400 으로 변환한다 */
export class GameRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameRuleError';
  }
}

const RESOURCE_TYPES: readonly ResourceType[] = ['crop', 'mineral', 'seafood'];

async function readResources(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  userId: string,
): Promise<Record<ResourceType, number>> {
  const rows = await tx.inventory.findMany({ where: { userId } });
  const out = Object.fromEntries(RESOURCE_TYPES.map((t) => [t, 0])) as Record<
    ResourceType,
    number
  >;
  for (const r of rows) out[r.resourceType as ResourceType] = r.count;
  return out;
}

/**
 * 부화.
 *
 * 알비노 1% 판정이 여기서 일어나며, 반드시 서버에서만 굴리고 즉시 영속화한다.
 * 클라이언트가 결과를 알 수 있는 경로로 실행하면 새로고침 리롤이 가능해진다.
 */
export async function hatchEgg(
  userId: string,
  eggType: EggType,
): Promise<HatchResponse> {
  const pet = await db.$transaction(async (tx) => {
    // "동시 육성 1마리" = stage < 3 인 개체가 계정당 최대 1마리 (6장)
    const raising = await tx.pet.count({
      where: { ownerId: userId, stage: { lt: STAGE.ADULT } },
    });
    if (raising > 0) {
      throw new GameRuleError('이미 육성 중인 개체가 있다');
    }

    const stock = await tx.userEgg.findUnique({
      where: { userId_eggType: { userId, eggType } },
    });
    if (!stock || stock.count < 1) {
      throw new GameRuleError(`보유하지 않은 알이다: ${eggType}`);
    }

    await tx.userEgg.update({
      where: { userId_eggType: { userId, eggType } },
      data: { count: { decrement: 1 } },
    });

    const hatched = hatchPure(createEgg(eggType), Math.random);

    return tx.pet.create({
      data: {
        ownerId: userId,
        eggType,
        stage: hatched.stage,
        isAlbino: hatched.isAlbino,
      },
      include: { species: true },
    });
  });

  return { pet: toPetView(pet) };
}

/**
 * 먹이 1회.
 *
 * 자원 1개를 소모하고 해당 성향 +1. 진행도는 시간이 아니라 이 횟수로 잰다.
 */
export async function feedPet(
  userId: string,
  petId: string,
  resourceType: ResourceType,
): Promise<FeedResponse> {
  return db.$transaction(async (tx) => {
    const pet = await tx.pet.findUnique({
      where: { id: petId },
      include: { species: true },
    });
    if (!pet || pet.ownerId !== userId) {
      throw new GameRuleError('내 개체가 아니다');
    }

    const stock = await tx.inventory.findUnique({
      where: { userId_resourceType: { userId, resourceType } },
    });
    if (!stock || stock.count < BALANCE.FEED_COST) {
      throw new GameRuleError('자원이 부족하다');
    }

    // 단계·요구치 검증은 순수 함수가 한다. 규칙이 한 곳에만 있어야 한다.
    const trait: Trait = RESOURCE_TRAIT[resourceType];
    const next = feedPure(toEvolutionState(pet), trait);

    await tx.inventory.update({
      where: { userId_resourceType: { userId, resourceType } },
      data: { count: { decrement: BALANCE.FEED_COST } },
    });

    const updated = await tx.pet.update({
      where: { id: petId },
      data: {
        traitA: next.traits.a,
        traitB: next.traits.b,
        traitC: next.traits.c,
        feedCount: next.feedCount,
        lastFedSeqA: next.lastFedSeq.a,
        lastFedSeqB: next.lastFedSeq.b,
        lastFedSeqC: next.lastFedSeq.c,
      },
      include: { species: true },
    });

    return {
      pet: toPetView(updated),
      resources: await readResources(tx, userId),
      canEvolve: canEvolvePure(next),
    };
  });
}

/**
 * 진화.
 *
 * 유아기 → 성장기 : 성향 X 확정 후 카운터 리셋
 * 성장기 → 성체   : sort(X, Y) 로 조합 확정 → 도감 등록 → 보상 알 자격 +1
 *
 * 성체 전환의 세 가지는 반드시 한 트랜잭션이다. 갈라지면 도감에 없는 성체나
 * 받을 수 없는 보상이 생긴다.
 */
export async function evolvePet(
  userId: string,
  petId: string,
): Promise<EvolveResponse> {
  return db.$transaction(async (tx) => {
    const pet = await tx.pet.findUnique({
      where: { id: petId },
      include: { species: true },
    });
    if (!pet || pet.ownerId !== userId) {
      throw new GameRuleError('내 개체가 아니다');
    }

    const next = evolvePure(toEvolutionState(pet));

    // 카운터는 어느 방향이든 리셋된다 (3장)
    const common = {
      traitA: 0,
      traitB: 0,
      traitC: 0,
      feedCount: 0,
      lastFedSeqA: 0,
      lastFedSeqB: 0,
      lastFedSeqC: 0,
    };

    if (next.stage === STAGE.TEEN) {
      const updated = await tx.pet.update({
        where: { id: petId },
        data: { ...common, stage: next.stage, stage2Trait: next.stage2Trait },
        include: { species: true },
      });
      return {
        pet: toPetView(updated),
        dexUpdated: false,
        rewardAvailable: false,
      };
    }

    const species = await tx.species.findUniqueOrThrow({
      where: {
        eggType_combo: {
          eggType: pet.eggType,
          combo: next.combo as Combo,
        },
      },
    });

    const updated = await tx.pet.update({
      where: { id: petId },
      data: { ...common, stage: next.stage, speciesId: species.id },
      include: { species: true },
    });

    await registerSpecies(tx, userId, species.id, pet.isAlbino);

    // 교환으로 받은 성체는 보상 알을 주지 않는다. 여기는 직접 키운 경우뿐이다 (6장).
    await tx.user.update({
      where: { id: userId },
      data: { unclaimedRewards: { increment: 1 } },
    });

    return {
      pet: toPetView(updated),
      dexUpdated: true,
      rewardAvailable: true,
    };
  });
}
