/**
 * 세션 → 행위자 도출.
 *
 * ⚠️ 이 파일은 **C 트랙(인증) 소유**다. A 가 계약만 먼저 세워두었으니
 *    getCurrentUserId 의 본문을 Auth.js 세션 조회로 교체하면 된다.
 *    시그니처를 바꾸면 API 라우트 전체가 영향을 받으므로 팀에 공유할 것.
 *
 * 왜 이 함수가 필요한가:
 * 모든 엔드포인트의 행위자는 반드시 서버 세션에서 도출한다. 요청 바디의 userId 를
 * 신뢰하면 타인 계정 명의로 교환·급여·수령이 가능해진다 (설계 문서 16장 원칙 1).
 * 그래서 서비스 계층은 userId 를 인자로만 받고, 그 값을 얻는 책임은 여기에 있다.
 */

/** 미인증 요청. 라우트에서 401 로 변환한다 */
export class UnauthenticatedError extends Error {
  constructor(message = '로그인이 필요하다') {
    super(message);
    this.name = 'UnauthenticatedError';
  }
}

/**
 * 현재 요청의 사용자 ID.
 *
 * C 구현 예정:
 *   const session = await auth();
 *   if (!session?.user?.id) throw new UnauthenticatedError();
 *   return session.user.id;
 */
export async function getCurrentUserId(): Promise<string> {
  // 개발 전용 우회로. 인증이 붙기 전까지 A 가 API 를 직접 확인하기 위한 것이다.
  //
  // 프로덕션에서는 절대 동작하지 않는다. 이 가드를 완화하면 인증 없이 임의 계정으로
  // 요청할 수 있게 되므로, C 가 구현을 채울 때 이 블록을 통째로 삭제할 것.
  if (process.env.NODE_ENV !== 'production' && process.env.DEV_USER_ID) {
    return process.env.DEV_USER_ID;
  }

  throw new UnauthenticatedError(
    '세션 조회가 아직 구현되지 않았다 (C 트랙: src/lib/server/session.ts)',
  );
}
