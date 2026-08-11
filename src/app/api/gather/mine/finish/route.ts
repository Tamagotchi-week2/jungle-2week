import { expectInt, expectString, readJson, withUser } from '@/lib/server/route';
import { finishMine } from '@/lib/server/services/gather';
import type { MineFinishRequest } from '@/types/api';

/** 연타 완료. 서버가 최소 소요 시간 하한을 검증한다 */
export const POST = withUser(async (userId, req) => {
  const body = await readJson<MineFinishRequest>(req);
  return finishMine(
    userId,
    expectString(body.sessionId, 'sessionId'),
    expectInt(body.clicks, 'clicks'),
  );
});
