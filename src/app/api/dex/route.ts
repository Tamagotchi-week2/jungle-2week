import { withUser } from '@/lib/server/route';
import { getDex } from '@/lib/server/services/dex';

/** 도감 24칸 전체. 미획득 칸도 실루엣 표시를 위해 함께 내려준다 */
export const GET = withUser((userId) => getDex(userId));
