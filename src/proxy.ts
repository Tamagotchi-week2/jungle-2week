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

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|sprites|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
