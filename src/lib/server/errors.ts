/** 클라이언트에 그대로 노출해도 안전한 검증 실패류 에러. API 라우트에서 400으로 매핑한다. */
export class DomainError extends Error {}
