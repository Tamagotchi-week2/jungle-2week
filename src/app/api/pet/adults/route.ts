import { withUser } from '@/lib/server/route';
import { listAdultPets } from '@/lib/server/services/pet';
import { releaseExpiredTrades } from '@/lib/server/services/trade';

/**
 * 보유한 성체 목록. 교환 화면이 개체를 고를 때 쓴다.
 * /api/me 는 육성 중인 개체만 담으므로 성체는 여기서 받는다.
 *
 * 읽기 전에 만료된 교환을 먼저 정리한다. 유효 시간이 지난 잠금을 풀어 줄 주체가
 * 달리 없어서, 그냥 두면 개체가 영구히 묶인다. 목록 조회는 교환 화면에 들어올
 * 때마다 일어나므로 회수 시점으로 알맞다.
 */
export const GET = withUser(async (userId) => {
  await releaseExpiredTrades(userId);
  return listAdultPets(userId);
});
