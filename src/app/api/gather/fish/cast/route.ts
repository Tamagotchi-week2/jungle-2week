import { withUser } from '@/lib/server/route';
import { castFish } from '@/lib/server/services/gather';

/** 캐스팅. 서버가 입질 시각을 정하고 지연값만 내려준다 */
export const POST = withUser((userId) => castFish(userId));
