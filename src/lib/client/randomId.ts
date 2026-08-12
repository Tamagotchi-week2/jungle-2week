'use client';

/**
 * crypto.randomUUID() 는 보안 컨텍스트(HTTPS 또는 localhost)에서만 존재한다.
 * HTTP로 서빙되는 배포(예: 도메인 연결 전 IP 직접 접속)에서는 없거나 호출 시
 * 예외를 던지므로, 어디서든 동작하는 crypto.getRandomValues 로 대체한다.
 * 서버는 이 값을 형식 검증 없이 오파크 문자열로만 쓴다.
 */
export function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // 보안 컨텍스트가 아니면 여기로 떨어진다 — getRandomValues 로 계속 진행
    }
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
