/**
 * 알 획득 로직 테스트 (설계 문서 6장).
 */

import { describe, expect, it } from 'vitest';

import {
  SELECTABLE_EGG_TYPES,
  resolveRewardEgg,
  rollRewardEgg,
  rollStarterEgg,
  rollStarterEggs,
} from './eggs';

describe('초기 가챠', () => {
  it('구간 경계가 공30 / 육30 / 해30 / 금10 을 따른다', () => {
    expect(rollStarterEgg(() => 0)).toBe('air');
    expect(rollStarterEgg(() => 0.29)).toBe('air');
    expect(rollStarterEgg(() => 0.3)).toBe('land');
    expect(rollStarterEgg(() => 0.59)).toBe('land');
    expect(rollStarterEgg(() => 0.6)).toBe('sea');
    expect(rollStarterEgg(() => 0.89)).toBe('sea');
    expect(rollStarterEgg(() => 0.9)).toBe('gold');
    expect(rollStarterEgg(() => 0.999)).toBe('gold');
  });

  it('4회를 굴리며 종류 중복을 허용한다', () => {
    expect(rollStarterEggs(() => 0)).toEqual(['air', 'air', 'air', 'air']);
    expect(rollStarterEggs(() => 0.95)).toHaveLength(4);
  });
});

describe('보상 알', () => {
  it('최초 성체 완성 시 금색이 확정 지급된다', () => {
    expect(rollRewardEgg(false, () => 0.99).isGold).toBe(true);
  });

  it('그 이후에는 10% 확률로만 금색이 나온다', () => {
    expect(rollRewardEgg(true, () => 0.09).isGold).toBe(true);
    expect(rollRewardEgg(true, () => 0.1).isGold).toBe(false);
    expect(rollRewardEgg(true, () => 0.99).isGold).toBe(false);
  });

  it('금색 판정이면 유저가 무엇을 골랐든 금색이 지급된다', () => {
    const gold = { isGold: true };
    expect(resolveRewardEgg(gold, 'air')).toBe('gold');
    expect(resolveRewardEgg(gold, 'sea')).toBe('gold');
  });

  it('일반 판정이면 선택한 알이 그대로 지급된다', () => {
    expect(resolveRewardEgg({ isGold: false }, 'land')).toBe('land');
  });

  it('선택지에 금색은 포함되지 않는다', () => {
    expect(SELECTABLE_EGG_TYPES).not.toContain('gold');
    expect(() => resolveRewardEgg({ isGold: false }, 'gold')).toThrow();
  });
});
