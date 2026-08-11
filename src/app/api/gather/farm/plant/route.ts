import { withUser } from '@/lib/server/route';
import { plantFarm } from '@/lib/server/services/gather';

export const POST = withUser((userId) => plantFarm(userId));
