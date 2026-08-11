import { auth } from '@/lib/server/auth';

export class UnauthenticatedError extends Error {
  constructor() {
    super('인증되지 않은 요청입니다.');
  }
}

/** 세션에서 행위자를 도출한다. 요청 바디의 user_id 는 어떤 API 에서도 신뢰하지 않는다 (16장 원칙 1). */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new UnauthenticatedError();
  }
  return session.user.id;
}
