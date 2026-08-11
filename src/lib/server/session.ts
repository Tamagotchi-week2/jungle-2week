/**
 * 세션 → 행위자 도출.
 *
 * 모든 엔드포인트의 행위자는 반드시 서버 세션에서 도출한다. 요청 바디의 userId 를
 * 신뢰하면 타인 계정 명의로 교환·급여·수령이 가능해진다 (설계 문서 16장 원칙 1).
 * 그래서 서비스 계층은 userId 를 인자로만 받고, 그 값을 얻는 책임은 여기에 있다.
 */

import { auth } from '@/lib/server/auth';

/** 미인증 요청. 라우트에서 401 로 변환한다 */
export class UnauthenticatedError extends Error {
  constructor(message = '로그인이 필요합니다.') {
    super(message);
    this.name = 'UnauthenticatedError';
  }
}

/** 현재 요청의 사용자 ID. */
export async function getCurrentUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new UnauthenticatedError();
  }
  return session.user.id;
}
