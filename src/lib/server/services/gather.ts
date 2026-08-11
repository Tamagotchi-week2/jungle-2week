/**
 * 채집 서비스 — 농사 · 광산 · 어업 (설계 문서 3.1 · 3.2장).
 *
 * 세 채집 모두 **요청 시점에 서버가 검증 가능한 형태**다. 그래서 heartbeat 나
 * 세션 시간 누적이 필요 없다 (5장).
 *
 * 자원 가치가 낮으므로 과잉 방어는 하지 않는다. 결과 위조와 무한 획득만 막고,
 * 정교한 자동 클릭 봇은 원리적으로 차단 불가능하므로 대상에서 제외한다.
 */

import { db } from '@/lib/server/db';
import { BALANCE } from '@/lib/game/constants';
import type { ResourceType } from '@/lib/game/types';
import type {
  FarmStateResponse,
  FishCastResponse,
  FishStrikeResponse,
  HarvestResponse,
  MineFinishResponse,
  MineStartResponse,
} from '@/types/api';
import { GameRuleError } from '@/lib/game/errors';

const RESOURCE_TYPES: readonly ResourceType[] = ['crop', 'mineral', 'seafood'];

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

async function grant(
  tx: Tx,
  userId: string,
  resourceType: ResourceType,
  amount: number,
): Promise<Record<ResourceType, number>> {
  await tx.inventory.upsert({
    where: { userId_resourceType: { userId, resourceType } },
    update: { count: { increment: amount } },
    create: { userId, resourceType, count: amount },
  });

  const rows = await tx.inventory.findMany({ where: { userId } });
  const out = Object.fromEntries(RESOURCE_TYPES.map((t) => [t, 0])) as Record<
    ResourceType,
    number
  >;
  for (const r of rows) out[r.resourceType as ResourceType] = r.count;
  return out;
}

// ---------------------------------------------------------------- 농사

/**
 * 밭 상태. 남은 시간은 **서버 시각 기준**으로 계산해 내려준다.
 * 클라이언트가 자기 시계로 계산하면 시계를 돌려 즉시 수확할 수 있다.
 */
export async function getFarmState(userId: string): Promise<FarmStateResponse> {
  const plot = await db.farmPlot.findFirstOrThrow({ where: { userId } });

  if (!plot.plantedAt) {
    return { plantedAt: null, remainingSeconds: null, ready: false };
  }

  const elapsed = (Date.now() - plot.plantedAt.getTime()) / 1000;
  const remaining = Math.max(0, BALANCE.FARM_GROW_SECONDS - elapsed);

  return {
    plantedAt: plot.plantedAt.toISOString(),
    remainingSeconds: Math.ceil(remaining),
    ready: remaining <= 0,
  };
}

/** 씨앗 심기. 씨앗은 아이템이 아니므로 소모 자원이 없다 */
export async function plantFarm(userId: string): Promise<FarmStateResponse> {
  await db.$transaction(async (tx) => {
    const plot = await tx.farmPlot.findFirstOrThrow({ where: { userId } });
    if (plot.plantedAt) {
      throw new GameRuleError('이미 심어져 있다');
    }
    await tx.farmPlot.update({
      where: { id: plot.id },
      data: { plantedAt: new Date() },
    });
  });

  return getFarmState(userId);
}

/** 수확. 경과 시간은 저장된 서버 시각과 현재 서버 시각으로만 판단한다 */
export async function harvestFarm(userId: string): Promise<HarvestResponse> {
  return db.$transaction(async (tx) => {
    const plot = await tx.farmPlot.findFirstOrThrow({ where: { userId } });
    if (!plot.plantedAt) {
      throw new GameRuleError('심어진 작물이 없다');
    }

    const elapsed = (Date.now() - plot.plantedAt.getTime()) / 1000;
    if (elapsed < BALANCE.FARM_GROW_SECONDS) {
      throw new GameRuleError(
        `아직 자라지 않았다. ${Math.ceil(BALANCE.FARM_GROW_SECONDS - elapsed)}초 남음`,
      );
    }

    await tx.farmPlot.update({
      where: { id: plot.id },
      data: { plantedAt: null },
    });

    return {
      gained: BALANCE.FARM_YIELD,
      resources: await grant(tx, userId, 'crop', BALANCE.FARM_YIELD),
    };
  });
}

// ---------------------------------------------------------------- 광산

/** 진행 중이던 세션은 포기한 것으로 보고 정리한다 */
async function abandonOpenSessions(
  tx: Tx,
  userId: string,
  kind: 'mine' | 'fish',
) {
  await tx.gatherSession.updateMany({
    where: { userId, kind, resolved: false },
    data: { resolved: true },
  });
}

export async function startMine(userId: string): Promise<MineStartResponse> {
  return db.$transaction(async (tx) => {
    await abandonOpenSessions(tx, userId, 'mine');

    const session = await tx.gatherSession.create({
      data: { userId, kind: 'mine' },
    });

    return {
      sessionId: session.id,
      clickTarget: BALANCE.MINE_CLICK_TARGET,
    };
  });
}

/**
 * 연타 완료.
 *
 * 클라이언트가 보고한 연타 수를 그대로 믿되, **최소 소요 시간 하한**을 검증한다.
 * 사람이 낼 수 없는 속도로 완료를 보고하면 거절한다.
 */
export async function finishMine(
  userId: string,
  sessionId: string,
  clicks: number,
): Promise<MineFinishResponse> {
  return db.$transaction(async (tx) => {
    const session = await tx.gatherSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.userId !== userId || session.kind !== 'mine') {
      throw new GameRuleError('내 광산 세션이 아니다');
    }
    if (session.resolved) {
      throw new GameRuleError('이미 처리된 세션이다');
    }

    await tx.gatherSession.update({
      where: { id: sessionId },
      data: { resolved: true },
    });

    const elapsedMs = Date.now() - session.startedAt.getTime();
    const minMs = BALANCE.MINE_CLICK_TARGET * BALANCE.MINE_MIN_MS_PER_CLICK;

    const enough = clicks >= BALANCE.MINE_CLICK_TARGET;
    const humanSpeed = elapsedMs >= minMs;

    if (!enough || !humanSpeed) {
      const resources = await grant(tx, userId, 'mineral', 0);
      return { success: false, gained: 0, resources };
    }

    return {
      success: true,
      gained: BALANCE.MINE_YIELD,
      resources: await grant(tx, userId, 'mineral', BALANCE.MINE_YIELD),
    };
  });
}

// ---------------------------------------------------------------- 어업

/**
 * 캐스팅. 서버가 입질 시각을 정하고 지연값만 내려준다.
 *
 * 입질 대기는 3–9초를 유지해야 한다. 줄이면 1회 시도가 짧아져 어업이
 * 분당 산출에서 혼자 압도한다 (3.2장).
 */
export async function castFish(userId: string): Promise<FishCastResponse> {
  return db.$transaction(async (tx) => {
    await abandonOpenSessions(tx, userId, 'fish');

    const span = BALANCE.FISH_BITE_DELAY_MAX - BALANCE.FISH_BITE_DELAY_MIN;
    const biteDelay = Math.floor(
      BALANCE.FISH_BITE_DELAY_MIN + Math.random() * span,
    );

    const session = await tx.gatherSession.create({
      data: { userId, kind: 'fish', biteDelay },
    });

    return { sessionId: session.id, biteDelayMs: biteDelay };
  });
}

/**
 * 판정.
 *
 * 반응시간은 **클라이언트가 로컬에서 잰다** (입질 표시 → 입력). 서버가 요청 도착
 * 시각으로 재면 왕복 지연이 반응시간에 그대로 더해져, 화면상 제때 눌러도 실패한다.
 * 실제로 700ms 창이 지연 때문에 체감상 훨씬 좁아지는 문제가 있었다.
 *
 * 대신 서버는 **그 주장이 물리적으로 가능한 시각에 도착했는지**를 확인한다.
 * 입질 전에 도착했거나, 창을 한참 넘겨 도착한 요청은 반응시간과 무관하게 거절한다.
 *
 * 완벽한 방어는 아니다. 조작하면 항상 좋은 반응시간을 주장할 수 있다. 다만 자동
 * 클릭 봇은 애초에 막을 수 없고(3.2장) 걸린 자원이 2개뿐이라, 지연으로 정타가
 * 실패하는 쪽이 더 큰 손해라고 판단했다.
 */
export async function strikeFish(
  userId: string,
  sessionId: string,
  reactionMs: number,
): Promise<FishStrikeResponse> {
  return db.$transaction(async (tx) => {
    const session = await tx.gatherSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.userId !== userId || session.kind !== 'fish') {
      throw new GameRuleError('내 낚시 세션이 아니다');
    }
    if (session.resolved) {
      throw new GameRuleError('이미 처리된 세션이다');
    }
    if (session.biteDelay === null) {
      throw new GameRuleError('입질 정보가 없는 세션이다');
    }

    await tx.gatherSession.update({
      where: { id: sessionId },
      data: { resolved: true },
    });

    // 서버가 보는 경과. 판정이 아니라 "가능한 시각인가" 확인에만 쓴다.
    const serverElapsed = Date.now() - session.startedAt.getTime();
    const sinceBite = serverElapsed - session.biteDelay;

    // 입질보다 먼저 도착했다면 반응시간 주장이 무엇이든 성립하지 않는다.
    // 창을 크게 넘겨 도착한 것도 마찬가지다 (나중에 좋은 값을 주장하는 경우).
    const arrivalPlausible =
      sinceBite >= 0 &&
      sinceBite <= BALANCE.FISH_QTE_WINDOW_MS + BALANCE.FISH_MAX_LATENCY_MS;

    const reaction = arrivalPlausible ? reactionMs : sinceBite;

    // 입질 전에 눌렀거나 사람이 낼 수 없는 반응속도
    if (reaction < BALANCE.FISH_MIN_HUMAN_MS) {
      return {
        success: false,
        reason: 'too_early' as const,
        gained: 0,
        resources: await grant(tx, userId, 'seafood', 0),
      };
    }

    // 왕복 지연이 포함되므로 윈도우를 넉넉히 잡아 흡수한다
    if (reaction > BALANCE.FISH_QTE_WINDOW_MS) {
      return {
        success: false,
        reason: 'too_late' as const,
        gained: 0,
        resources: await grant(tx, userId, 'seafood', 0),
      };
    }

    return {
      success: true,
      gained: BALANCE.FISH_YIELD,
      resources: await grant(tx, userId, 'seafood', BALANCE.FISH_YIELD),
    };
  });
}
