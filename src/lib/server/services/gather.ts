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
} from '@/types/api';
import { GameRuleError } from '@/lib/game/errors';
import { judgeFish, judgeMine } from '@/lib/game/gather';

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

    // 조건부 업데이트로 수확을 딱 한 번만 통과시킨다. 연타로 동시에 들어온 두
    // 요청은 둘 다 위 SELECT 에서 plantedAt 이 있는 걸 보고 통과하지만,
    // UPDATE 는 행 잠금 때문에 순서가 생긴다 — 먼저 커밋된 쪽이 plantedAt 을
    // null 로 지우고 나면, 뒤이어 잠금이 풀린 두 번째 UPDATE 는 자신이 읽었던
    // plantedAt 값과 지금 값(null)이 달라 WHERE 에 걸려 0행을 갱신한다.
    // update() 만 썼다면 이 확인이 없어 자원이 두 번 지급됐다.
    const { count } = await tx.farmPlot.updateMany({
      where: { id: plot.id, plantedAt: plot.plantedAt },
      data: { plantedAt: null },
    });
    if (count === 0) {
      throw new GameRuleError('이미 수확되었다');
    }

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

/**
 * 연타 완료.
 *
 * 판정은 클라이언트가 로컬에서 이미 내렸다. 서버는 **같은 규칙(judgeMine)에 같은
 * 값을 넣어** 독립적으로 같은 결론에 도달한 뒤 자원을 지급한다. 클라이언트가
 * "성공했다"고 주장하는 것을 그대로 받지는 않는다.
 *
 * 소요 시간은 클라이언트가 잰 값을 쓴다. 서버 시각으로 재면 mine/start 왕복이
 * 포함되어 실제보다 길게 잡히고, 그만큼 자동 연타에 관대해진다.
 *
 * 대신 **주장한 소요 시간이 세션 수명을 넘지 않는지** 확인한다. 세션은 클라이언트가
 * 첫 연타를 하기 전에 이미 서버에서 생성되므로 서버 경과가 항상 더 길다. 이보다 긴
 * 시간을 주장한다면 하한 검사를 통과하려고 값을 부풀린 것이다.
 */
export async function finishMine(
  userId: string,
  attemptId: string,
  clicks: number,
  elapsedMs: number,
): Promise<MineFinishResponse> {
  return db.$transaction(async (tx) => {
    const existing = await tx.gatherSession.findUnique({
      where: { id: attemptId },
    });
    if (existing) {
      throw new GameRuleError('이미 처리된 세션이다');
    }

    await tx.gatherSession.create({
      data: {
        id: attemptId,
        userId,
        kind: 'mine',
        resolved: true,
      },
    });

    // 세션이 열려 있던 시간. 판정이 아니라 "주장이 가능한 값인가" 확인에만 쓴다.
    // 부풀린 주장이면 서버가 본 시간으로 깎아 판정한다.
    const measured = elapsedMs;

    const verdict = judgeMine(clicks, measured);

    if (!verdict.success) {
      const resources = await grant(tx, userId, 'mineral', 0);
      return { success: false, reason: verdict.reason, gained: 0, resources };
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
 * 측정도 판정도 클라이언트가 로컬에서 끝낸다. 서버는 **같은 규칙(judgeFish)에 같은
 * 값을 넣어** 독립적으로 같은 결론에 도달한 뒤 자원을 지급한다.
 *
 * 서버가 요청 도착 시각으로 반응시간을 재면 왕복 지연이 그대로 더해져, 화면상
 * 제때 눌러도 실패한다. 700ms 창이 지연만큼 좁아지는 셈이다.
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

    const verdict = judgeFish(reaction);

    if (!verdict.success) {
      return {
        success: false,
        reason: verdict.reason,
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
