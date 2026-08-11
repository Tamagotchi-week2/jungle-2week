/**
 * 통합 테스트용 DB 격리.
 *
 * `TEST_DATABASE_URL` 이 설정된 경우에만 그 값으로 접속 대상을 바꾼다.
 *
 * 두 가지가 함께 필요하다.
 *
 * 1. `.env` 를 여기서 직접 읽는다. Vitest 는 .env 를 자동으로 로드하지 않아
 *    이 시점에는 TEST_DATABASE_URL 이 비어 있다. 나중에 Prisma 가 .env 를 읽어
 *    개발 DB 에 붙어버린다.
 *
 * 2. process.env.DATABASE_URL 을 덮어쓰지 않고 전용 변수를 쓴다. Prisma 클라이언트가
 *    초기화 시 .env 를 다시 읽어 DATABASE_URL 을 되돌리기 때문이다.
 *    db.ts 가 이 변수를 datasourceUrl 로 명시해 넘긴다.
 *
 * 실제로 이 둘을 빠뜨려 통합 테스트가 개발 DB 를 지운 적이 있다. 그래서
 * 테스트 쪽에도 격리를 실증하는 가드를 따로 두었다.
 */

try {
  // Node 20.12+ 내장. 파일이 없어도 환경변수로 직접 주입할 수 있으므로 무시한다
  process.loadEnvFile();
} catch {
  // noop
}

const testUrl = process.env.TEST_DATABASE_URL;

if (testUrl) {
  if (testUrl === process.env.DATABASE_URL) {
    throw new Error(
      'TEST_DATABASE_URL 이 DATABASE_URL 과 같다. 테스트가 개발 DB 를 비운다. ' +
        '별도 스키마를 쓰려면 URL 끝에 &schema=test_integration 을 붙일 것.',
    );
  }

  process.env.PRISMA_DATASOURCE_URL_OVERRIDE = testUrl;
}
