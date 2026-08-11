import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
  }
}

// next-auth/jwt 는 @auth/core/jwt 를 재수출할 뿐이라, @auth/core 내부에서 쓰는
// JWT 타입에 반영되게 하려면 원본 모듈도 함께 보강해야 한다.
declare module '@auth/core/jwt' {
  interface JWT {
    userId?: string;
  }
}
