import { expectOneOf, readJson, withUser } from '@/lib/server/route';
import { hatchEgg } from '@/lib/server/services/pet';
import { EGG_TYPES } from '@/lib/game/types';
import type { HatchRequest } from '@/types/api';

/** 부화. 알비노 1% 판정이 서버에서 일어난다 */
export const POST = withUser(async (userId, req) => {
  const body = await readJson<HatchRequest>(req);
  const eggType = expectOneOf(body.eggType, EGG_TYPES, 'eggType');
  return hatchEgg(userId, eggType);
});
