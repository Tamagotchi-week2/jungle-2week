/**
 * 보상 알 서비스 (설계 문서 6장).
 *
 * open / claim 2단계로 나뉜다. 선택지를 내려줄 때 판정 결과를 함께 실으면
 * 개발자 도구로 선택 전에 결과를 확인할 수 있어 변신 연출이 무의미해진다.
 * 결과는 pendingRewardIsGold 로 서버에 보관하고 claim 에서만 공개한다.
 */

import { db } from '@/lib/server/db';
import { SELECTABLE_EGG_TYPES, resolveRewardEgg, rollRewardEgg } from '@/lib/game/eggs';
import type { EggType } from '@/lib/game/types';
import { EGG_TYPES } from '@/lib/game/types';
import type { RewardClaimResponse, RewardOpenResponse } from '@/types/api';
import { GameRuleError } from '@/lib/game/errors';

/**
 * 1단계 — 판정을 굴려 보관하고 선택지만 돌려준다.
 *
 * 이미 대기 중인 판정이 있으면 다시 굴리지 않는다. 재호출로 리롤이 가능하면
 * 금색이 나올 때까지 새로고침하면 그만이다.
 */
export async function openRewardEgg(
  userId: string,
): Promise<RewardOpenResponse> {
  await db.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        unclaimedRewards: true,
        pendingRewardIsGold: true,
        firstAdultRewardClaimed: true,
      },
    });

    if (user.pendingRewardIsGold !== null) return; // 이미 굴려둔 판정이 있다

    if (user.unclaimedRewards < 1) {
      throw new GameRuleError('받을 수 있는 보상 알이 없다');
    }

    const roll = rollRewardEgg(user.firstAdultRewardClaimed, Math.random);

    await tx.user.update({
      where: { id: userId },
      data: { pendingRewardIsGold: roll.isGold },
    });
  });

  // 결과는 절대 포함하지 않는다. 금색 판정이어도 선택 화면은 동일하다.
  return { choices: [...SELECTABLE_EGG_TYPES] };
}

/**
 * 2단계 — 유저 선택을 받아 확정한다. 여기서 처음 결과가 공개된다.
 *
 * 금색 판정이면 유저가 무엇을 골랐든 금색이 지급된다. 선택은 연출용이다.
 */
export async function claimRewardEgg(
  userId: string,
  chosen: EggType,
): Promise<RewardClaimResponse> {
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { unclaimedRewards: true, pendingRewardIsGold: true },
    });

    if (user.pendingRewardIsGold === null) {
      throw new GameRuleError('진행 중인 보상 알이 없다. 먼저 open 해야 한다');
    }
    if (user.unclaimedRewards < 1) {
      throw new GameRuleError('받을 수 있는 보상 알이 없다');
    }

    const isGold = user.pendingRewardIsGold;
    const granted = resolveRewardEgg({ isGold }, chosen);

    await tx.userEgg.upsert({
      where: { userId_eggType: { userId, eggType: granted } },
      update: { count: { increment: 1 } },
      create: { userId, eggType: granted, count: 1 },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        unclaimedRewards: { decrement: 1 },
        pendingRewardIsGold: null,
        // 최초 1회 금색 확정은 여기서 소진된다
        firstAdultRewardClaimed: true,
      },
    });

    const rows = await tx.userEgg.findMany({ where: { userId } });
    const eggs = Object.fromEntries(EGG_TYPES.map((t) => [t, 0])) as Record<
      EggType,
      number
    >;
    for (const r of rows) eggs[r.eggType as EggType] = r.count;

    return { granted, transformed: isGold, eggs };
  });
}
