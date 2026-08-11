import { expectOneOf, expectString, readJson, withUser } from '@/lib/server/route';
import { feedPet } from '@/lib/server/services/pet';
import type { ResourceType } from '@/lib/game/types';
import type { FeedRequest } from '@/types/api';

const RESOURCE_TYPES: readonly ResourceType[] = ['crop', 'mineral', 'seafood'];

/** 먹이 1회. 자원 1개를 소모하고 해당 성향 +1 */
export const POST = withUser(async (userId, req) => {
  const body = await readJson<FeedRequest>(req);
  const petId = expectString(body.petId, 'petId');
  const resourceType = expectOneOf(body.resourceType, RESOURCE_TYPES, 'resourceType');
  return feedPet(userId, petId, resourceType);
});
