import { withUser } from '@/lib/server/route';
import { openRewardEgg } from '@/lib/server/services/egg';

/**
 * 보상 알 1단계 — 선택지만 내려준다.
 *
 * 응답에 판정 결과를 실으면 개발자 도구로 선택 전에 확인할 수 있어
 * 변신 연출이 무의미해진다. 결과는 claim 에서만 공개된다 (설계 문서 6장).
 */
export const POST = withUser((userId) => openRewardEgg(userId));
