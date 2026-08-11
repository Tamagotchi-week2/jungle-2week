import { expectInt, expectString, readJson, withUser } from '@/lib/server/route';
import { finishMine } from '@/lib/server/services/gather';
import type { MineFinishRequest } from '@/types/api';

/** 연타 완료. 클라이언트가 잰 값으로 서버가 같은 규칙을 다시 적용한다 */
export const POST = withUser(async (userId, req) => {
  const body = await readJson<MineFinishRequest>(req);
  return finishMine(
    userId,
    expectString(body.sessionId, 'sessionId'),
    expectInt(body.clicks, 'clicks'),
    expectInt(body.elapsedMs, 'elapsedMs'),
  );
});
