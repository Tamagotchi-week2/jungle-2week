import { NextResponse } from 'next/server';

import { auth } from '@/lib/server/auth';

const AUTH_PAGES = ['/login', '/signup'];

/**
 * 설계 문서 17.1 — 로그인 게이트를 일괄 처리한다.
 * Next.js 16 부터 `middleware.ts` 가 `proxy.ts` 로 이름이 바뀌었다.
 */
export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;
  const isAuthPage = AUTH_PAGES.some((page) => pathname.startsWith(page));

  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', req.nextUrl));
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL('/game', req.nextUrl));
  }

  return NextResponse.next();
});

/**
 * `api` 전체를 제외한다. API 를 리다이렉트하면 클라이언트 fetch 가 401 대신
 * 로그인 HTML(200)을 받아 res.json() 에서 파싱 에러로 죽는다. "로그인 만료"를
 * 구분할 수도 없다.
 *
 * 제외해도 보호는 유지된다. 모든 API 라우트가 getCurrentUserId 를 거치며
 * 미인증이면 401 JSON 을 반환한다.
 */
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sprites|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
