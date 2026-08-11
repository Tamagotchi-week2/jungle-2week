/**
 * 진화 엔진.
 * 설계 문서 2·3장. 이 게임의 심장이며, DB·UI·네트워크를 알지 못하는 순수 함수만 둔다.
 *
 * 난수는 전부 인자로 주입받는다. 실제 호출부(서버)에서만 Math.random 을 넘기며,
 * 클라이언트에서 이 함수들의 난수 경로를 실행해서는 안 된다 (16장 원칙 1).
 */

import { BALANCE } from './constants';
import { GameRuleError } from './errors';
import type {
  Combo,
  EggType,
  LastFedSeq,
  PetEvolutionState,
  Stage,
  Trait,
  TraitCounter,
} from './types';
import { STAGE, TRAITS } from './types';

/** 0과 1 사이의 난수를 돌려주는 함수. 테스트에서는 고정값을 주입한다 */
export type Rng = () => number;

export function emptyTraits(): TraitCounter {
  return { a: 0, b: 0, c: 0 };
}

export function emptyLastFedSeq(): LastFedSeq {
  return { a: 0, b: 0, c: 0 };
}

/**
 * 두 성향을 사전순으로 정렬해 조합을 만든다 (2.2장).
 * ab 는 a→b 와 b→a 양쪽에서 도달하므로 대칭이어야 한다.
 */
export function resolveCombo(x: Trait, y: Trait): Combo {
  return ([x, y].sort().join('') as Combo);
}

/** 해당 단계를 마치는 데 필요한 먹이 횟수 */
export function requiredFeedCount(stage: Stage): number {
  if (stage === STAGE.BABY) return BALANCE.STAGE2_FEED_COUNT;
  if (stage === STAGE.TEEN) return BALANCE.STAGE3_FEED_COUNT;
  throw new Error(`먹이를 줄 수 없는 단계: ${stage}`);
}

/**
 * 누적 카운터에서 확정 성향을 판정한다 (3장).
 *
 * 최다 성향을 택하되, 동점이면 **동점 그룹 중** 가장 마지막에 먹인 성향을 택한다.
 * 마지막에 먹인 성향이 동점 그룹 밖일 수 있으므로 lastFedSeq 가 필요하다.
 */
export function decideTrait(
  traits: TraitCounter,
  lastFedSeq: LastFedSeq,
): Trait {
  const max = Math.max(...TRAITS.map((t) => traits[t]));
  if (max === 0) {
    throw new GameRuleError('먹인 기록이 없어 성향을 판정할 수 없다');
  }

  const tied = TRAITS.filter((t) => traits[t] === max);
  if (tied.length === 1) return tied[0];

  return tied.reduce((later, t) =>
    lastFedSeq[t] > lastFedSeq[later] ? t : later,
  );
}

/** 알 상태의 새 개체를 만든다 */
export function createEgg(eggType: EggType): PetEvolutionState {
  return {
    eggType,
    stage: STAGE.EGG,
    isAlbino: false,
    traits: emptyTraits(),
    feedCount: 0,
    lastFedSeq: emptyLastFedSeq(),
    stage2Trait: null,
    combo: null,
  };
}

/**
 * 부화. 이 시점에 알비노가 1% 확률로 판정되며 3차까지 유지된다 (7장).
 * 반드시 서버에서만 호출하고 결과를 즉시 영속화한다.
 */
export function hatch(state: PetEvolutionState, rng: Rng): PetEvolutionState {
  if (state.stage !== STAGE.EGG) {
    throw new GameRuleError('알 상태에서만 부화할 수 있다');
  }
  return {
    ...state,
    stage: STAGE.BABY,
    isAlbino: rng() < BALANCE.HATCH_ALBINO_RATE,
  };
}

/** 이번 단계의 급여가 끝나 진화 가능한 상태인가 */
export function canEvolve(state: PetEvolutionState): boolean {
  if (state.stage !== STAGE.BABY && state.stage !== STAGE.TEEN) return false;
  return state.feedCount >= requiredFeedCount(state.stage);
}

/**
 * 먹이 1회. 해당 성향 +1 이며, 진행도는 시간이 아니라 이 횟수로 잰다 (3장).
 * 이번 단계의 요구치를 이미 채웠으면 더 먹일 수 없다.
 */
export function feed(
  state: PetEvolutionState,
  trait: Trait,
): PetEvolutionState {
  if (state.stage !== STAGE.BABY && state.stage !== STAGE.TEEN) {
    throw new GameRuleError('유아기·성장기에만 먹일 수 있다');
  }
  if (canEvolve(state)) {
    throw new GameRuleError('이미 진화 조건을 채웠다. 진화 후 다시 먹일 수 있다');
  }

  const feedCount = state.feedCount + 1;
  return {
    ...state,
    feedCount,
    traits: { ...state.traits, [trait]: state.traits[trait] + 1 },
    lastFedSeq: { ...state.lastFedSeq, [trait]: feedCount },
  };
}

/**
 * 다음 단계로 진화한다.
 *
 * 유아기 → 성장기 : 성향 X 확정 후 **카운터를 전부 리셋**한다.
 * 성장기 → 성체   : 성향 Y 확정 후 sort(X, Y) 로 조합을 결정한다.
 *
 * 리셋을 빠뜨리면 3차 판정이 25회 누적으로 계산되어 X 와 Y 가 사실상 항상 같아지고,
 * ab·ac·bc 계열 12종이 도달 불가능해진다 (3장).
 */
export function evolve(state: PetEvolutionState): PetEvolutionState {
  if (!canEvolve(state)) {
    throw new GameRuleError('진화 조건을 채우지 못했다');
  }

  const decided = decideTrait(state.traits, state.lastFedSeq);

  if (state.stage === STAGE.BABY) {
    return {
      ...state,
      stage: STAGE.TEEN,
      stage2Trait: decided,
      traits: emptyTraits(),
      feedCount: 0,
      lastFedSeq: emptyLastFedSeq(),
    };
  }

  if (state.stage2Trait === null) {
    throw new GameRuleError('성장기 개체에 stage2Trait 가 없다');
  }

  return {
    ...state,
    stage: STAGE.ADULT,
    combo: resolveCombo(state.stage2Trait, decided),
    traits: emptyTraits(),
    feedCount: 0,
    lastFedSeq: emptyLastFedSeq(),
  };
}

/** 성장기 X 에서 도달 가능한 3차 조합 (2.2장) */
export function reachableCombos(x: Trait): Combo[] {
  return TRAITS.map((y) => resolveCombo(x, y));
}
