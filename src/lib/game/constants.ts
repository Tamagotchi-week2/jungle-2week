/**
 * 밸런스 상수.
 * 설계 문서 14장. 코드 곳곳에 숫자를 흩뿌리지 않고 여기에만 둔다.
 *
 * 개발·시연 시에는 GAME_FAST_MODE=1 로 성장 요구치를 낮춘다 (14장).
 */

const FAST = process.env.GAME_FAST_MODE === '1';

export const BALANCE = {
  /** 부화 시 알비노 발현 확률 */
  HATCH_ALBINO_RATE: 0.05,

  /** 보상 알이 금색으로 나올 확률 */
  GOLD_EGG_RATE: 0.1,
  /** 최초 성체 완성 시 금색 알 확정 지급 */
  FIRST_ADULT_GOLD_GUARANTEE: true,

  /** 초기 가챠 확률 (합 1.0) */
  STARTER_EGG_RATES: {
    air: 0.3,
    land: 0.3,
    sea: 0.3,
    gold: 0.1,
  },
  /** 초기 가챠 시행 횟수 */
  STARTER_EGG_COUNT: 4,

  /** 유아기 → 성장기 전환에 필요한 먹이 횟수 */
  STAGE2_FEED_COUNT: FAST ? 3 : 10,
  /** 성장기 → 성체 전환에 필요한 먹이 횟수 */
  STAGE3_FEED_COUNT: FAST ? 4 : 15,

  /** 먹이 1회당 소모하는 자원 수 */
  FEED_COST: 1,

  /** 농사: 밭 구획 수 */
  FARM_PLOTS: 1,
  /** 농사: 대기 시간(초) */
  FARM_GROW_SECONDS: 120,
  /** 농사: 1회 수확량 */
  FARM_YIELD: 12,

  /**
   * 광산: 목표 연타 수. 밸런스의 핵심 레버 (3.3장).
   * 한 손 초당 5회 가정 시 35였으나, 실제 체감 피로도가 높아 20으로 낮춤.
   * 산출량 대비 시간이 짧아진 만큼 분당 산출은 기존보다 늘어난다.
   */
  MINE_CLICK_TARGET: 20,
  MINE_YIELD: 1,
  /** 광산: 서버 검증용 연타당 최소 소요 시간(ms) */
  MINE_MIN_MS_PER_CLICK: 80,

  /** 어업: 성공 시 산출 (실패 0, 퍼펙트 판정 없음) */
  FISH_YIELD: 2,
  /** 어업: 입질 대기 하한(ms). 분당 산출을 결정한다 (3.2장) */
  FISH_BITE_DELAY_MIN: 3000,
  /** 어업: 입질 대기 상한(ms) */
  FISH_BITE_DELAY_MAX: 9000,
  /** 어업: 판정 폭(ms). 체감 400ms + 네트워크 지연 여유 300ms */
  FISH_QTE_WINDOW_MS: 700,
  /** 어업: 이보다 빠른 반응은 봇으로 간주 */
  FISH_MIN_HUMAN_MS: 100,
  /**
   * 어업: 허용하는 왕복 지연 상한(ms).
   *
   * 판정은 클라이언트가 잰 반응시간으로 하되, 서버는 "그 주장이 물리적으로
   * 가능한 시각에 도착했는가"만 확인한다. 이 값이 그 허용 폭이다.
   * 너무 좁히면 지연이 큰 유저가 정타를 놓치고, 너무 넓히면 한참 뒤에 와서
   * 좋은 반응시간을 주장할 수 있다.
   */
  FISH_MAX_LATENCY_MS: 3000,

  /** 마을 타일 수 (편도 이동 3초 이내) */
  MAP_WIDTH: 15,
  MAP_HEIGHT: 11,

  /**
   * 교환 코드 유효 시간(분).
   * 짧을수록 실수로 걸어둔 개체가 빨리 돌아온다. 코드를 전달하고 상대가
   * 입력하기까지 3분이면 충분하다고 보고 10분에서 줄였다.
   */
  TRADE_CODE_TTL_MINUTES: 3,

  /** 방명록 */
  GUESTBOOK_MAX_LENGTH: 200,
  GUESTBOOK_COOLDOWN_SECONDS: 60,
  GUESTBOOK_PAGE_SIZE: 50,
} as const;

/** 도감 총 칸 수 */
export const DEX_TOTAL = 24;
