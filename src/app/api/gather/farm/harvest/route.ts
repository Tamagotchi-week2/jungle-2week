import { withUser } from '@/lib/server/route';
import { harvestFarm } from '@/lib/server/services/gather';

/** 수확. 경과 판단은 저장된 서버 시각과 현재 서버 시각으로만 한다 */
export const POST = withUser((userId) => harvestFarm(userId));
