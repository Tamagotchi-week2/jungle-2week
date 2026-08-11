/**
 * 알 획득 로직 (설계 문서 6장).
 *
 * 초기 가챠와 보상 알 판정은 **반드시 서버에서만** 굴리고 결과를 즉시 영속화한다.
 * 클라이언트가 결과를 알 수 있는 경로로 실행하면 새로고침 리롤이 가능해진다.
 */

import { BALANCE } from './constants';
import { GameRuleError } from './errors';
import type { EggType } from './types';
import type { Rng } from './evolution';

/** 보상 알 선택지. 금색은 유저가 고를 수 없다 */
export const SELECTABLE_EGG_TYPES: readonly EggType[] = ['air', 'land', 'sea'];

/** 초기 가챠 1회 (공30 / 육30 / 해30 / 금10) */
export function rollStarterEgg(rng: Rng): EggType {
  const roll = rng();
  const rates = BALANCE.STARTER_EGG_RATES;

  let cumulative = 0;
  for (const type of ['air', 'land', 'sea', 'gold'] as const) {
    cumulative += rates[type];
    if (roll < cumulative) return type;
  }
  // 부동소수 오차로 마지막 구간을 넘어선 경우
  return 'gold';
}

/** 계정 생성 시 1회만 수행하는 초기 가챠 4회. 종류 중복 가능 */
export function rollStarterEggs(rng: Rng): EggType[] {
  return Array.from({ length: BALANCE.STARTER_EGG_COUNT }, () =>
    rollStarterEgg(rng),
  );
}

/**
 * 보상 알 판정 결과.
 * `isGold` 가 true 면 유저의 선택과 무관하게 금색이 지급되고,
 * 클라이언트는 선택한 알이 금색으로 변하는 연출을 재생한다.
 */
export interface RewardEggRoll {
  isGold: boolean;
}

/**
 * 성체 완성 보상 알 판정.
 * 최초 성체 완성 1회에 한해 금색이 확정 지급된다.
 *
 * 이 결과는 선택 화면을 내려줄 때 응답에 실어서는 안 되며,
 * pending 으로 저장해두고 유저가 선택을 마친 뒤에만 공개한다 (6장).
 */
export function rollRewardEgg(
  firstAdultRewardClaimed: boolean,
  rng: Rng,
): RewardEggRoll {
  if (!firstAdultRewardClaimed && BALANCE.FIRST_ADULT_GOLD_GUARANTEE) {
    return { isGold: true };
  }
  return { isGold: rng() < BALANCE.GOLD_EGG_RATE };
}

/** 판정과 유저 선택을 합쳐 최종 지급 알을 결정한다 */
export function resolveRewardEgg(
  roll: RewardEggRoll,
  chosen: EggType,
): EggType {
  if (roll.isGold) return 'gold';
  if (!SELECTABLE_EGG_TYPES.includes(chosen)) {
    throw new GameRuleError(`선택할 수 없는 알 종류: ${chosen}`);
  }
  return chosen;
}
