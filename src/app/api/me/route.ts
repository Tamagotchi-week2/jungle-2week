import { withUser } from '@/lib/server/route';
import { getMeSnapshot } from '@/lib/server/services/user';

/** 마을 화면이 한 번에 필요로 하는 현황 */
export const GET = withUser((userId) => getMeSnapshot(userId));
