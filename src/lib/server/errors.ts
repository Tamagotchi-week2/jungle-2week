/**
 * 서버 계층의 검증 실패 에러.
 *
 * A 의 `GameRuleError`(lib/game/errors.ts)와 **같은 클래스**다. 원래 두 트랙이
 * 각자 만들어 두 갈래였는데, 교차 사용하면 400 이어야 할 응답이 500 으로 나갔다.
 * C 의 TradeError 가 A 의 withUser 를 타거나, A 의 서비스 에러가 C 의
 * handleApiError 를 타는 경우가 그렇다.
 *
 * 별칭으로 묶어 두 래퍼(withUser / handleApiError)가 서로의 예외를 모두
 * 400 으로 변환하게 한다. 기존 `extends DomainError` 코드는 그대로 동작한다.
 */
export { GameRuleError as DomainError } from '@/lib/game/errors';
