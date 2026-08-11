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
});
