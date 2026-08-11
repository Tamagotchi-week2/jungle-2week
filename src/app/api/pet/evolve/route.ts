import { expectString, readJson, withUser } from '@/lib/server/route';
import { evolvePet } from '@/lib/server/services/pet';
import type { EvolveRequest } from '@/types/api';

/** 진화. 성체 전환 시 도감 등록과 보상 자격 부여가 같은 트랜잭션에서 일어난다 */
export const POST = withUser(async (userId, req) => {
  const body = await readJson<EvolveRequest>(req);
  return evolvePet(userId, expectString(body.petId, 'petId'));
});
