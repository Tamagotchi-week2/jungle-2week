/**
 * 게임 공용 타입.
 * 설계 문서 docs/design.md 2·3장 기준.
 *
 * 이 파일은 A(코어) 가 소유하며, 나머지 트랙이 공통으로 import 한다.
 * 변경 시 팀에 공유할 것.
 */

/** 알 종류 4종 */
export type EggType = 'air' | 'land' | 'sea' | 'gold';

/** 성향 3종. 먹인 음식의 종류로 결정된다 (3장) */
export type Trait = 'a' | 'b' | 'c';

/** 3차 성체 조합 6종. 항상 sort(X, Y) 형태 */
export type Combo = 'aa' | 'ab' | 'ac' | 'bb' | 'bc' | 'cc';

/** 진화 단계 */
export type Stage = 0 | 1 | 2 | 3;

export const STAGE = {
  EGG: 0,
  BABY: 1,
  TEEN: 2,
  ADULT: 3,
} as const;

/** 채집으로 얻는 자원. 성향과 1:1 대응한다 */
export type ResourceType = 'crop' | 'mineral' | 'seafood';

/** 자원 → 성향 매핑 (3장) */
export const RESOURCE_TRAIT: Record<ResourceType, Trait> = {
  crop: 'a',
  mineral: 'b',
  seafood: 'c',
};

/** 성향 → 자원 역매핑 */
export const TRAIT_RESOURCE: Record<Trait, ResourceType> = {
  a: 'crop',
  b: 'mineral',
  c: 'seafood',
};

/** 단계 내에서 누적되는 성향 카운터. 단계 전환 시 리셋된다 (3장) */
export type TraitCounter = Record<Trait, number>;

/**
 * 성향별로 "마지막에 먹인 순번".
 * 값은 그 성향을 마지막으로 먹였을 때의 feedCount, 0 이면 이번 단계에서 먹인 적 없음.
 *
 * 동점 처리 규칙이 "동점 그룹 중 가장 마지막에 먹인 성향"(3장)이므로,
 * 단일 lastFedTrait 만으로는 판정할 수 없다.
 * 예) a=4, b=4, c=2 이고 마지막이 c 인 경우 a·b 중 나중 쪽을 알아야 한다.
 */
export type LastFedSeq = Record<Trait, number>;

export const EGG_TYPES: readonly EggType[] = ['air', 'land', 'sea', 'gold'];
export const TRAITS: readonly Trait[] = ['a', 'b', 'c'];
export const COMBOS: readonly Combo[] = ['aa', 'ab', 'ac', 'bb', 'bc', 'cc'];

/** 도감 1칸에 대응하는 성체 1종 */
export interface Species {
  eggType: EggType;
  combo: Combo;
  /** 표시명 (한글) */
  name: string;
}

/**
 * 개체의 진화 관련 상태.
 * DB 의 pets 레코드에서 진화 판정에 필요한 필드만 뽑은 형태다.
 * 모든 진화 로직은 이 구조체만 보고 동작하며 DB·UI 를 알지 못한다.
 */
export interface PetEvolutionState {
  eggType: EggType;
  stage: Stage;
  isAlbino: boolean;
  /** 현재 단계에서 누적된 성향 카운터. 단계 전환 시 리셋 */
  traits: TraitCounter;
  /** 현재 단계에서 먹인 총 횟수. 단계 전환 시 리셋 */
  feedCount: number;
  /** 현재 단계에서 성향별 마지막 급여 순번. 단계 전환 시 리셋 */
  lastFedSeq: LastFedSeq;
  /** 2차에서 확정된 성향 X. 성장기 진입 후에만 존재 */
  stage2Trait: Trait | null;
  /** 3차에서 확정된 조합. 성체가 된 후에만 존재 */
  combo: Combo | null;
}
