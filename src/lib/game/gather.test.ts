import { describe, expect, it } from 'vitest';

import { BALANCE } from './constants';
import { judgeFish, judgeMine } from './gather';

/**
 * 이 규칙은 클라이언트와 서버가 **함께** 쓴다. 둘이 갈라지면 화면에 뜬 결과와
 * 실제 지급이 어긋나므로, 경계값을 특히 촘촘히 못박아 둔다.
 */

describe('judgeFish', () => {
  it('창 안에 들어오면 성공한다', () => {
    expect(judgeFish(300).success).toBe(true);
  });

  it('입질 전 입력(0)은 too_early 다', () => {
    expect(judgeFish(0)).toEqual({ success: false, reason: 'too_early' });
  });

  it('사람이 낼 수 없는 반응속도는 too_early 다', () => {
    expect(judgeFish(BALANCE.FISH_MIN_HUMAN_MS - 1).reason).toBe('too_early');
  });

  it('하한 자체는 통과시킨다', () => {
    expect(judgeFish(BALANCE.FISH_MIN_HUMAN_MS).success).toBe(true);
  });

  it('창 경계는 성공, 1ms 넘으면 too_late 다', () => {
    expect(judgeFish(BALANCE.FISH_QTE_WINDOW_MS).success).toBe(true);
    expect(judgeFish(BALANCE.FISH_QTE_WINDOW_MS + 1)).toEqual({
      success: false,
      reason: 'too_late',
    });
  });
});

describe('judgeMine', () => {
  const target = BALANCE.MINE_CLICK_TARGET;
  const minMs = target * BALANCE.MINE_MIN_MS_PER_CLICK;

  it('횟수와 시간을 모두 채우면 성공한다', () => {
    expect(judgeMine(target, minMs).success).toBe(true);
  });

  it('한 번 모자라면 not_enough 다', () => {
    expect(judgeMine(target - 1, minMs)).toEqual({
      success: false,
      reason: 'not_enough',
    });
  });

  it('하한보다 1ms 빠르면 too_fast 다', () => {
    expect(judgeMine(target, minMs - 1)).toEqual({
      success: false,
      reason: 'too_fast',
    });
  });

  it('횟수 미달이 시간 미달보다 먼저 보고된다', () => {
    // 둘 다 틀렸을 때 유저에게 먼저 알려줄 것은 "더 눌러야 한다" 쪽이다.
    expect(judgeMine(0, 0).reason).toBe('not_enough');
  });

  it('한 손 5회/초 가정으로 정상 플레이는 통과한다 (3.2장)', () => {
    expect(judgeMine(target, (target / 5) * 1000).success).toBe(true);
  });
});
