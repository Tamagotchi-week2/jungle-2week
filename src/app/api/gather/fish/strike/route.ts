import { expectString, readJson, withUser } from '@/lib/server/route';
import { strikeFish } from '@/lib/server/services/gather';
import type { FishStrikeRequest } from '@/types/api';

/**
 * 판정. 클라이언트는 입력했다는 사실만 보내고 성공 여부는 서버가 정한다.
 * 클라이언트가 성공을 주장하게 두면 조작이 너무 쉽다.
 */
export const POST = withUser(async (userId, req) => {
  const body = await readJson<FishStrikeRequest>(req);
  return strikeFish(userId, expectString(body.sessionId, 'sessionId'));
});
