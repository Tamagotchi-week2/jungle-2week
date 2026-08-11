/**
 * Prisma 클라이언트 싱글턴.
 *
 * 개발 모드에서는 HMR 로 모듈이 반복 평가되므로, 매번 new PrismaClient() 하면
 * 커넥션이 계속 늘어나 결국 DB 연결 한도를 넘긴다. globalThis 에 캐시해 이를 막는다.
 * 프로덕션에서는 모듈이 한 번만 평가되므로 캐시하지 않는다.
 *
 * 서버 전용이다. 클라이언트 컴포넌트에서 import 하면 번들에 끌려 들어간다.
 */

import { PrismaClient } from '@/generated/prisma';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['error'],
    // 대화형 트랜잭션의 기본 제한은 5초다. 논리적으로는 짧은 작업이라도
    // 원격 DB(Neon) 왕복이 여러 번 겹치면 넘긴다. 실제로 "Transaction not found"
    // 오류가 간헐적으로 났다. 교환·진화처럼 여러 쓰기를 묶는 곳이 특히 취약하다.
    transactionOptions: {
      maxWait: 10_000,
      timeout: 20_000,
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
