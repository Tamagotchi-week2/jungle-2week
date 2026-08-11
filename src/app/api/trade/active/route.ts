import { withUser } from '@/lib/server/route';
import { getActiveTrade } from '@/lib/server/services/trade';

/**
 * 아직 끝나지 않은 내 교환. 없으면 null 을 돌려준다.
 * 교환 화면이 새로고침 뒤 하던 교환에 다시 붙는 데 쓴다.
 */
export const GET = withUser(async (userId) => ({
  trade: await getActiveTrade(userId),
}));
