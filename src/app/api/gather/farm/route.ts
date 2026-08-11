import { withUser } from '@/lib/server/route';
import { getFarmState } from '@/lib/server/services/gather';

/** 밭 상태. 남은 시간은 서버 시각 기준으로 계산해 내려준다 */
export const GET = withUser((userId) => getFarmState(userId));
