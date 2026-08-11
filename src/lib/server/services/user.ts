/**
 * 계정 서비스 (설계 문서 6장).
 *
 * 모든 함수는 userId 를 인자로 받는다. 세션에서 행위자를 꺼내는 일은 라우트가 하고,
 * 서비스는 누가 요청했는지 알 필요가 없다. 덕분에 인증 구현과 독립적이다.
 */

import { db } from '@/lib/server/db';
import { rollStarterEggs } from '@/lib/game/eggs';
import { BALANCE, DEX_TOTAL } from '@/lib/game/constants';
import type { EggType, ResourceType } from '@/lib/game/types';
import { EGG_TYPES, STAGE } from '@/lib/game/types';
import type { MeResponse } from '@/types/api';
import { toPetView } from './mappers';

const RESOURCE_TYPES: readonly ResourceType[] = ['crop', 'mineral', 'seafood'];

/**
 * 계정 생성 직후 1회만 수행하는 초기 셋업.
 *
 * 가챠는 **서버에서만** 굴리고 즉시 영속화한다. 이미 알을 받은 계정이면
 * 다시 굴리지 않는다 — 재호출로 리롤이 가능해지면 안 된다.
 *
 * 밭 1구획과 자원 인벤토리 3행도 함께 만든다. 미리 만들어두면 이후 채집·급여에서
 * 행 존재 여부를 매번 확인하지 않아도 된다.
 */
export async function setupNewUser(userId: string): Promise<EggType[]> {
  return db.$transaction(async (tx) => {
    const existing = await tx.userEgg.findMany({ where: { userId } });
    if (existing.length > 0) {
      return existing.flatMap((e) =>
        Array<EggType>(e.count).fill(e.eggType as EggType),
      );
    }

    const rolled = rollStarterEggs(Math.random);

    const counts = new Map<EggType, number>();
    for (const egg of rolled) {
      counts.set(egg, (counts.get(egg) ?? 0) + 1);
    }

    await tx.userEgg.createMany({
      data: [...counts].map(([eggType, count]) => ({ userId, eggType, count })),
    });

    // 밭과 인벤토리는 시드가 먼저 만들어둘 수 있어 각각 독립적으로 멱등해야 한다.
    // "알이 없으니 아무것도 없을 것"이라고 가정하면 유니크 제약에 걸린다.
    const plots = await tx.farmPlot.count({ where: { userId } });
    if (plots < BALANCE.FARM_PLOTS) {
      await tx.farmPlot.createMany({
        data: Array.from({ length: BALANCE.FARM_PLOTS - plots }, () => ({
          userId,
        })),
      });
    }

    await tx.inventory.createMany({
      data: RESOURCE_TYPES.map((resourceType) => ({
        userId,
        resourceType,
        count: 0,
      })),
      skipDuplicates: true,
    });

    return rolled;
  });
}

/** 마을 화면이 한 번에 필요로 하는 현황 */
export async function getMeSnapshot(userId: string): Promise<MeResponse> {
  const [user, eggs, resources, activePet, dexCompleted] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        nickname: true,
        tutorialStep: true,
        pendingRewardIsGold: true,
      },
    }),
    db.userEgg.findMany({ where: { userId } }),
    db.inventory.findMany({ where: { userId } }),
    // 육성 중인 개체는 계정당 최대 1마리다 (stage < 3)
    db.pet.findFirst({
      where: { ownerId: userId, stage: { lt: STAGE.ADULT } },
      include: { species: true },
    }),
    db.dexEntry.count({
      where: {
        userId,
        OR: [{ hasNormal: true }, { hasAlbino: true }],
      },
    }),
  ]);

  const eggCounts = Object.fromEntries(
    EGG_TYPES.map((t) => [t, 0]),
  ) as Record<EggType, number>;
  for (const e of eggs) eggCounts[e.eggType as EggType] = e.count;

  const resourceCounts = Object.fromEntries(
    RESOURCE_TYPES.map((t) => [t, 0]),
  ) as Record<ResourceType, number>;
  for (const r of resources) {
    resourceCounts[r.resourceType as ResourceType] = r.count;
  }

  return {
    nickname: user.nickname,
    tutorialStep: user.tutorialStep,
    eggs: eggCounts,
    resources: resourceCounts,
    activePet: activePet ? toPetView(activePet) : null,
    dexCompleted,
    dexTotal: DEX_TOTAL,
    // 결과(금색 여부)는 절대 내려보내지 않는다. 존재 여부만 알린다 (6장).
    hasPendingReward: user.pendingRewardIsGold !== null,
  };
}
