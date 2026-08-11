/**
 * 통합 테스트용 DB 격리.
 *
 * `TEST_DATABASE_URL` 이 설정된 경우에만 그 값으로 DATABASE_URL 을 덮어쓴다.
 * db.ts 의 PrismaClient 가 생성될 때 이 값을 읽으므로, 서비스 계층이 그대로
 * 테스트 DB 를 바라보게 된다.
 *
 * 설정하지 않으면 통합 테스트는 건너뛴다. 순수 함수 테스트만 돌아 빠르다.
 */

const testUrl = process.env.TEST_DATABASE_URL;

if (testUrl) {
  // 안전장치: 개발 DB 를 그대로 가리키면 팀 전체 데이터가 날아간다.
  // 통합 테스트는 테이블을 비우므로 같은 대상이면 즉시 중단한다.
  if (testUrl === process.env.DATABASE_URL) {
    throw new Error(
      'TEST_DATABASE_URL 이 DATABASE_URL 과 같다. 테스트가 개발 DB 를 비운다.\n' +
        '별도 스키마를 쓰려면 URL 끝에 &schema=test_integration 을 붙일 것.',
    );
  }

  process.env.DATABASE_URL = testUrl;
}
