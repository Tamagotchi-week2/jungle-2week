/**
 * 진화 엔진 불변식 테스트 (설계 문서 13장).
 * 여기가 깨지면 게임 규칙이 깨진 것이다.
 */

import { describe, expect, it } from 'vitest';

import { BALANCE } from './constants';
import {
  canEvolve,
  createEgg,
  decideTrait,
  evolve,
  feed,
  hatch,
  reachableCombos,
  resolveCombo,
} from './evolution';
import { SPECIES_LIST, getSpecies, speciesKey } from './species';
import type { Combo, EggType, PetEvolutionState, Trait } from './types';
import { COMBOS, EGG_TYPES, STAGE, TRAITS } from './types';

const never: () => number = () => 1; // 알비노가 절대 나오지 않는 rng
const always: () => number = () => 0; // 알비노가 항상 나오는 rng

/** 지정한 성향만 먹여 다음 단계까지 진화시킨다 */
function feedAndEvolve(state: PetEvolutionState, trait: Trait) {
  let s = state;
  const need = s.stage === STAGE.BABY
    ? BALANCE.STAGE2_FEED_COUNT
    : BALANCE.STAGE3_FEED_COUNT;
  for (let i = 0; i < need; i += 1) s = feed(s, trait);
  return evolve(s);
}

/** 알에서 시작해 X → Y 순서로 키운 성체 */
function raise(eggType: EggType, x: Trait, y: Trait) {
  let s = hatch(createEgg(eggType), never);
  s = feedAndEvolve(s, x);
  s = feedAndEvolve(s, y);
  return s;
}

describe('resolveCombo', () => {
  it('sort(X, Y) 가 대칭이다 — a,b 와 b,a 가 같은 조합을 낸다', () => {
    for (const x of TRAITS) {
      for (const y of TRAITS) {
        expect(resolveCombo(x, y)).toBe(resolveCombo(y, x));
      }
    }
  });

  it('항상 유효한 6종 조합만 낸다', () => {
    for (const x of TRAITS) {
      for (const y of TRAITS) {
        expect(COMBOS).toContain(resolveCombo(x, y));
      }
    }
  });
});

describe('분기 제약', () => {
  it('X = a 에서는 aa / ab / ac 만 도달 가능하다', () => {
    expect(new Set(reachableCombos('a'))).toEqual(new Set(['aa', 'ab', 'ac']));
  });

  it('X = b 에서는 ab / bb / bc 만 도달 가능하다', () => {
    expect(new Set(reachableCombos('b'))).toEqual(new Set(['ab', 'bb', 'bc']));
  });

  it('X = c 에서는 ac / bc / cc 만 도달 가능하다', () => {
    expect(new Set(reachableCombos('c'))).toEqual(new Set(['ac', 'bc', 'cc']));
  });
});

describe('24종 도달 가능성', () => {
  it('실제 육성 경로로 24종 전부에 도달한다', () => {
    const reached = new Set<string>();

    for (const eggType of EGG_TYPES) {
      for (const x of TRAITS) {
        for (const y of TRAITS) {
          const adult = raise(eggType, x, y);
          expect(adult.stage).toBe(STAGE.ADULT);
          expect(adult.combo).not.toBeNull();
          reached.add(speciesKey(eggType, adult.combo as Combo));
        }
      }
    }

    expect(reached.size).toBe(24);
    for (const s of SPECIES_LIST) {
      expect(reached.has(speciesKey(s.eggType, s.combo))).toBe(true);
    }
  });

  it('마스터 데이터가 24종이고 이름이 모두 다르다', () => {
    expect(SPECIES_LIST).toHaveLength(24);
    expect(new Set(SPECIES_LIST.map((s) => s.name)).size).toBe(24);
    expect(getSpecies('gold', 'bb').name).toBe('용');
    expect(getSpecies('air', 'aa').name).toBe('오목눈이');
  });
});

describe('단계 전환 시 카운터 리셋', () => {
  it('2차 진화 후 성향 카운터와 급여 횟수가 0이 된다', () => {
    let s = hatch(createEgg('land'), never);
    s = feedAndEvolve(s, 'a');

    expect(s.stage).toBe(STAGE.TEEN);
    expect(s.stage2Trait).toBe('a');
    expect(s.feedCount).toBe(0);
    expect(s.traits).toEqual({ a: 0, b: 0, c: 0 });
    expect(s.lastFedSeq).toEqual({ a: 0, b: 0, c: 0 });
  });

  it('리셋 덕분에 X 와 다른 Y 를 선택할 수 있다 — ab 계열이 도달 가능하다', () => {
    // 리셋이 없으면 유아기 a 10회가 성장기 판정까지 누적되어
    // 성장기에 b 를 15회 먹여도 a(10) vs b(15) 가 아니라 X=Y 로 굳어진다.
    const adult = raise('land', 'a', 'b');
    expect(adult.combo).toBe('ab');
    expect(getSpecies('land', adult.combo as Combo).name).toBe('고양이');
  });

  it('혼합 조합 6종이 모두 서로 다른 두 성향에서 나온다', () => {
    expect(raise('air', 'a', 'b').combo).toBe('ab');
    expect(raise('air', 'b', 'a').combo).toBe('ab');
    expect(raise('air', 'a', 'c').combo).toBe('ac');
    expect(raise('air', 'c', 'b').combo).toBe('bc');
  });
});

describe('동점 처리', () => {
  it('단독 최다 성향이 있으면 그대로 채택한다', () => {
    expect(decideTrait({ a: 5, b: 3, c: 2 }, { a: 8, b: 9, c: 10 })).toBe('a');
  });

  it('동점이면 동점 그룹 중 나중에 먹인 쪽을 채택한다', () => {
    expect(decideTrait({ a: 4, b: 4, c: 2 }, { a: 7, b: 9, c: 10 })).toBe('b');
    expect(decideTrait({ a: 4, b: 4, c: 2 }, { a: 9, b: 7, c: 10 })).toBe('a');
  });

  it('마지막에 먹인 성향이 동점 그룹 밖이면 무시한다', () => {
    // c 를 마지막에 먹었지만 c 는 최다가 아니므로 a·b 중에서 고른다
    const traits = { a: 4, b: 4, c: 2 };
    const lastFedSeq = { a: 3, b: 8, c: 10 };
    expect(decideTrait(traits, lastFedSeq)).toBe('b');
  });

  it('3자 동점도 나중에 먹인 쪽으로 결정된다', () => {
    expect(decideTrait({ a: 3, b: 3, c: 3 }, { a: 7, b: 8, c: 9 })).toBe('c');
  });

  it('먹인 기록이 없으면 판정할 수 없다', () => {
    expect(() => decideTrait({ a: 0, b: 0, c: 0 }, { a: 0, b: 0, c: 0 })).toThrow();
  });
});

describe('알비노', () => {
  it('부화 시 판정되며 3차 성체까지 유지된다', () => {
    let s = hatch(createEgg('gold'), always);
    expect(s.isAlbino).toBe(true);

    s = feedAndEvolve(s, 'b');
    expect(s.isAlbino).toBe(true);
    s = feedAndEvolve(s, 'b');
    expect(s.isAlbino).toBe(true);
    expect(s.stage).toBe(STAGE.ADULT);
    expect(s.combo).toBe('bb');
  });

  it('일반 개체는 끝까지 일반으로 유지된다', () => {
    const adult = raise('sea', 'c', 'c');
    expect(adult.isAlbino).toBe(false);
  });

  it('확률 경계 — 0.01 미만에서만 발현한다', () => {
    expect(hatch(createEgg('air'), () => 0.009).isAlbino).toBe(true);
    expect(hatch(createEgg('air'), () => 0.01).isAlbino).toBe(false);
  });
});

describe('급여·진화 가드', () => {
  it('알 상태에서는 먹일 수 없다', () => {
    expect(() => feed(createEgg('air'), 'a')).toThrow();
  });

  it('요구치를 채우기 전에는 진화할 수 없다', () => {
    let s = hatch(createEgg('air'), never);
    s = feed(s, 'a');
    expect(canEvolve(s)).toBe(false);
    expect(() => evolve(s)).toThrow();
  });

  it('요구치를 채운 뒤에는 더 먹일 수 없다', () => {
    let s = hatch(createEgg('air'), never);
    for (let i = 0; i < BALANCE.STAGE2_FEED_COUNT; i += 1) s = feed(s, 'a');
    expect(canEvolve(s)).toBe(true);
    expect(() => feed(s, 'a')).toThrow();
  });

  it('성체는 더 이상 진화하지 않는다', () => {
    const adult = raise('land', 'a', 'a');
    expect(canEvolve(adult)).toBe(false);
    expect(() => evolve(adult)).toThrow();
  });

  it('feed 는 원본을 변경하지 않는다', () => {
    const s = hatch(createEgg('air'), never);
    const next = feed(s, 'a');
    expect(s.feedCount).toBe(0);
    expect(next.feedCount).toBe(1);
    expect(s.traits.a).toBe(0);
  });
});
