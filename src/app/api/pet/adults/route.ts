import { withUser } from '@/lib/server/route';
import { listAdultPets } from '@/lib/server/services/pet';

/**
 * 보유한 성체 목록. 교환 화면이 개체를 고를 때 쓴다.
 * /api/me 는 육성 중인 개체만 담으므로 성체는 여기서 받는다.
 */
export const GET = withUser((userId) => listAdultPets(userId));
