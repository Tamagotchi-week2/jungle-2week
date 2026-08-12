import { withUser } from '@/lib/server/route';
import { GameRuleError } from '@/lib/game/errors';
import { getTradeByPet } from '@/lib/server/services/trade';

/**
 * 그 개체를 묶고 있는 진행 중 교환. 없으면 null.
 *
 * 교환소에서 잠긴 개체를 눌렀을 때, 그 개체에 걸린 코드를 다시 띄우는 데 쓴다.
 * 계정 기준으로 찾으면 개체마다 교환을 걸 수 있는 구조에서 어느 건을 뜻하는지
 * 정해지지 않는다.
 *
 * 동적 구간이 아니라 쿼리로 받는다 — withUser 가 라우트 파라미터를 넘기지 않는다.
 */
export const GET = withUser(async (userId, req) => {
  const petId = new URL(req.url).searchParams.get('petId');
  if (!petId) {
    throw new GameRuleError('petId 가 필요합니다.');
  }
  return { trade: await getTradeByPet(userId, petId) };
});
