import { expectOneOf, readJson, withUser } from '@/lib/server/route';
import { claimRewardEgg } from '@/lib/server/services/egg';
import { SELECTABLE_EGG_TYPES } from '@/lib/game/eggs';
import type { RewardClaimRequest } from '@/types/api';

/** 보상 알 2단계 — 선택을 받아 확정한다. 여기서 처음 결과가 공개된다 */
export const POST = withUser(async (userId, req) => {
  const body = await readJson<RewardClaimRequest>(req);
  const chosen = expectOneOf(body.chosen, SELECTABLE_EGG_TYPES, 'chosen');
  return claimRewardEgg(userId, chosen);
});
