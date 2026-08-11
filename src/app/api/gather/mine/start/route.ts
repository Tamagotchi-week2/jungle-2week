import { withUser } from '@/lib/server/route';
import { startMine } from '@/lib/server/services/gather';

export const POST = withUser((userId) => startMine(userId));
