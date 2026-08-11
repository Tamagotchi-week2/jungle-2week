import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Vitest 는 tsconfig 의 paths 를 자동으로 읽지 않는다.
 * `@/` 별칭을 여기서 다시 알려주지 않으면 테스트에서만 모듈 해석이 실패한다.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // TEST_DATABASE_URL 이 있으면 그쪽을 바라보게 한다 (통합 테스트용)
    setupFiles: ['./vitest.setup.ts'],
    // 통합 테스트는 같은 DB 를 공유하므로 파일 간 병렬 실행을 막는다.
    // 동시에 돌면 서로의 데이터를 지운다.
    fileParallelism: false,
    testTimeout: 30_000,
    // 원격 DB 라 왕복이 느리다. 훅에서 24종 시딩이 기본 10초를 넘긴다
    hookTimeout: 60_000,
  },
});
