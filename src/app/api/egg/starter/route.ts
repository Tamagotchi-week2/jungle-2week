import { withUser } from '@/lib/server/route';
import { setupNewUser } from '@/lib/server/services/user';

/**
 * 계정 생성 직후 초기 가챠 4회.
 * 이미 받은 계정이면 다시 굴리지 않고 기존 결과를 돌려준다.
 */
export const POST = withUser(async (userId) => ({
  eggs: await setupNewUser(userId),
}));
