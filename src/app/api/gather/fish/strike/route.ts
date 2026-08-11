import { expectInt, expectString, readJson, withUser } from '@/lib/server/route';
import { strikeFish } from '@/lib/server/services/gather';
import type { FishStrikeRequest } from '@/types/api';

/**
 * 판정. 클라이언트는 로컬에서 잰 반응시간을 보내고, 서버가 같은 규칙(judgeFish)을
 * 다시 적용한다. 성공 여부 자체를 클라이언트가 주장하게 두지는 않는다.
 */
export const POST = withUser(async (userId, req) => {
  const body = await readJson<FishStrikeRequest>(req);
  return strikeFish(
    userId,
    expectString(body.sessionId, 'sessionId'),
    expectInt(body.reactionMs, 'reactionMs'),
  );
});
