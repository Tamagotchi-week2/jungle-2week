/**
 * 규칙 위반 예외.
 *
 * "게임 규칙상 허용되지 않는 요청"을 한 종류로 통일한다.
 * 순수 함수(lib/game)와 서비스 계층이 같은 타입을 던지므로, 라우트는 이 하나만
 * 400 으로 변환하면 된다.
 *
 * 일반 Error 를 쓰면 진화 조건 미달 같은 정상적인 거절이 500 으로 나간다.
 * 클라이언트는 "내가 잘못 요청했다"와 "서버가 고장났다"를 구분할 수 없게 된다.
 *
 * 이 파일은 lib/game 규칙을 따라 외부 의존이 없다.
 */
export class GameRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameRuleError';
  }
}
