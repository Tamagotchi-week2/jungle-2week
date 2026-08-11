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

/**
 * 접속 대상 URL.
 *
 * process.env.DATABASE_URL 을 덮어쓰는 방식은 통하지 않는다. Prisma 클라이언트가
 * 초기화 시 .env 를 다시 읽어 값을 되돌리기 때문이다. 실제로 통합 테스트가
 * 격리 스키마 대신 개발 DB 를 지운 사고가 있었다.
 *
 * 그래서 별도 변수로 받아 datasourceUrl 에 **명시적으로** 넘긴다.
 * 이 값은 Prisma 의 .env 로딩이 건드리지 않는다.
 */
const datasourceUrl =
  process.env.PRISMA_DATASOURCE_URL_OVERRIDE ?? process.env.DATABASE_URL;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl,
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
