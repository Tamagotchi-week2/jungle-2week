/**
 * 스프라이트 경로 리졸버.
 * 설계 문서 11장의 경로 규칙에 대한 **유일한 출처**다.
 *
 * B(마을·집)와 D(도감·연출)가 함께 쓰므로, 경로를 문자열로 직접 조립하지 말고
 * 반드시 이 파일의 함수를 거친다. 각자 조립하면 규칙이 갈라진다.
 *
 * 소유자: A. 경로 규칙이 바뀌면 여기만 고치면 된다.
 */

import type { Combo, EggType, Trait } from './game/types';

const ROOT = '/sprites';

/** 알비노 접미사. 알 단계에는 붙지 않는다 */
function albinoSuffix(isAlbino: boolean): string {
  return isAlbino ? '_albino' : '';
}

/**
 * 알 (4장).
 *
 * 알비노 구분이 **없다.** 알비노는 부화 시점에 판정되므로,
 * 알 그림이 갈리면 부화 전에 결과가 노출되어 1% 연출이 무너진다 (11장).
 */
export function eggSprite(eggType: EggType): string {
  return `${ROOT}/egg/${eggType}.webp`;
}

/** 유아기 (8장) */
export function babySprite(eggType: EggType, isAlbino: boolean): string {
  return `${ROOT}/baby/${eggType}${albinoSuffix(isAlbino)}.webp`;
}

/** 성장기 (24장) — 알 종류 × 성향 a/b/c × 알비노 */
export function teenSprite(
  eggType: EggType,
  trait: Trait,
  isAlbino: boolean,
): string {
  return `${ROOT}/teen/${eggType}_${trait}${albinoSuffix(isAlbino)}.webp`;
}

/** 성체 (48장) — 알 종류 × 조합 6종 × 알비노 */
export function adultSprite(
  eggType: EggType,
  combo: Combo,
  isAlbino: boolean,
): string {
  return `${ROOT}/adult/${eggType}_${combo}${albinoSuffix(isAlbino)}.webp`;
}

export interface PetSpriteState {
  eggType: EggType;
  stage: number;
  isAlbino: boolean;
  stage2Trait?: Trait | null;
  combo?: Combo | null;
}

/** 마지막 성장 단계(성체). 도달하면 growthStageImages 가 자동으로 최종 전용 이미지를 고른다 */
export const FINAL_GROWTH_STAGE = 3;

export function isFinalGrowthStage(stage: number): boolean {
  return stage === FINAL_GROWTH_STAGE;
}

/**
 * 성장 단계 → 스프라이트 리졸버 매핑.
 * 단계가 바뀌면 petSprite() 가 자동으로 이 매핑을 다시 타서 그림이 갈린다 —
 * 최종 단계(3)도 별도 분기 없이 이 매핑 하나로 처리된다.
 */
export const growthStageImages: Record<number, (pet: PetSpriteState) => string> = {
  0: (pet) => eggSprite(pet.eggType),
  1: (pet) => babySprite(pet.eggType, pet.isAlbino),
  2: (pet) => {
    if (!pet.stage2Trait) {
      throw new Error('성장기 개체에 stage2Trait 가 없다');
    }
    return teenSprite(pet.eggType, pet.stage2Trait, pet.isAlbino);
  },
  [FINAL_GROWTH_STAGE]: (pet) => {
    if (!pet.combo) {
      throw new Error('성체 개체에 combo 가 없다');
    }
    return adultSprite(pet.eggType, pet.combo, pet.isAlbino);
  },
};

/**
 * 개체 상태로부터 알맞은 스프라이트를 고른다.
 * 단계에 필요한 정보가 없으면 경로를 만들 수 없으므로 예외를 던진다.
 */
export function petSprite(pet: PetSpriteState): string {
  const resolve = growthStageImages[pet.stage];
  if (!resolve) {
    throw new Error(`알 수 없는 단계: ${pet.stage}`);
  }
  return resolve(pet);
}

// ---------------------------------------------------------------- 마을 필드

export type Direction = 'up' | 'down' | 'left' | 'right';

/** 플레이어 걷기 프레임. frame 은 0부터 */
export function playerSprite(dir: Direction, frame: number): string {
  return `${ROOT}/player/${dir}_${frame}.webp`;
}

/** 바닥·길·물 등 타일 */
export function tileSprite(name: string): string {
  return `${ROOT}/tiles/${name}.webp`;
}

/** 마을 시설. 우편함은 집 앞에 놓인다 (4.2장) */
export type BuildingName = 'house' | 'mailbox' | 'farm' | 'mine' | 'shore';

export function buildingSprite(name: BuildingName): string {
  return `${ROOT}/buildings/${name}.webp`;
}
