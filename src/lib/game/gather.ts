/**
 * 채집 판정 규칙 (설계 3.2장).
 *
 * 이 파일이 존재하는 이유는 **판정을 클라이언트와 서버가 똑같이 계산**해야 하기
 * 때문이다.
 *
 * 예전에는 서버가 요청 도착 시각으로 반응시간을 쟀다. 그러면 왕복 지연이 그대로
 * 판정에 더해져, 화면상 제때 눌러도 실패한다. 700ms 창이 지연만큼 좁아지는 셈이다.
 * 게다가 결과를 보려면 왕복을 기다려야 해서 입력이 씹힌 것처럼 느껴졌다.
 *
 * 그래서 **측정도 판정도 로컬에서 끝낸다.** 클라이언트는 자기 시계로 잰 값을 이
 * 함수에 넣어 결과를 즉시 화면에 띄우고, 서버는 같은 함수에 같은 값을 넣어 같은
 * 결론에 도달한 뒤 자원을 지급한다. 규칙이 한 곳에 있으니 둘이 갈라질 수 없다.
 *
 * 자원 지급은 여전히 서버만 한다. 클라이언트는 "무엇을 측정했는가"를 말할 뿐,
 * "무엇을 받는가"는 말하지 못한다.
 *
 * 순수 함수다. DB·네트워크·Date.now 를 쓰지 않는다.
 */

import { BALANCE } from './constants';

export type FishFailReason = 'too_early' | 'too_late';
export type MineFailReason = 'not_enough' | 'too_fast';

export interface Verdict<R> {
  success: boolean;
  reason?: R;
}

/**
 * 어업 판정.
 *
 * @param reactionMs 입질이 화면에 뜬 순간부터 입력까지 걸린 시간.
 *   대기 중에 미리 누른 경우처럼 입질 자체가 없었다면 0 을 넣는다.
 */
export function judgeFish(reactionMs: number): Verdict<FishFailReason> {
  // 입질 전에 눌렀거나, 사람이 낼 수 없는 반응속도
  if (reactionMs < BALANCE.FISH_MIN_HUMAN_MS) {
    return { success: false, reason: 'too_early' };
  }
  if (reactionMs > BALANCE.FISH_QTE_WINDOW_MS) {
    return { success: false, reason: 'too_late' };
  }
  return { success: true };
}

/**
 * 광산 판정.
 *
 * @param clicks 연타 횟수
 * @param elapsedMs 첫 연타 화면이 준비된 순간부터 목표 도달까지 걸린 시간
 *
 * 소요 시간 하한을 두는 이유는 자동 연타를 거르기 위해서다. 한 손 기준 초당 5회를
 * 가정했으므로(3.2장) 하한은 그보다 한참 아래로 잡아 정상 플레이를 막지 않는다.
 */
export function judgeMine(
  clicks: number,
  elapsedMs: number,
): Verdict<MineFailReason> {
  if (clicks < BALANCE.MINE_CLICK_TARGET) {
    return { success: false, reason: 'not_enough' };
  }
  if (elapsedMs < BALANCE.MINE_CLICK_TARGET * BALANCE.MINE_MIN_MS_PER_CLICK) {
    return { success: false, reason: 'too_fast' };
  }
  return { success: true };
}
