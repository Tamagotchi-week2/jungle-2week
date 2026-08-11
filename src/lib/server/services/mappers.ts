/**
 * DB 레코드 → API 응답 형태 변환.
 *
 * 라우트마다 각자 변환하면 필드가 조금씩 달라져 클라이언트가 분기 처리를 하게 된다.
 * 변환은 여기 한 곳에서만 한다.
 */

import type { Pet, Species } from '@/generated/prisma';
import { requiredFeedCount } from '@/lib/game/evolution';
import type { Combo, EggType, Stage, Trait } from '@/lib/game/types';
import { STAGE } from '@/lib/game/types';
import type { PetView, TradePetView } from '@/types/api';

export type PetWithSpecies = Pet & { species: Species | null };

/** 진화 판정에 쓰는 형태로 추린다. 순수 함수(lib/game)는 이 구조만 안다 */
export function toEvolutionState(pet: PetWithSpecies) {
  return {
    eggType: pet.eggType as EggType,
    stage: pet.stage as Stage,
    isAlbino: pet.isAlbino,
    traits: { a: pet.traitA, b: pet.traitB, c: pet.traitC },
    feedCount: pet.feedCount,
    lastFedSeq: {
      a: pet.lastFedSeqA,
      b: pet.lastFedSeqB,
      c: pet.lastFedSeqC,
    },
    stage2Trait: (pet.stage2Trait as Trait | null) ?? null,
    combo: (pet.species?.combo as Combo | undefined) ?? null,
  };
}

export function toPetView(pet: PetWithSpecies): PetView {
  const stage = pet.stage as Stage;
  const canFeed = stage === STAGE.BABY || stage === STAGE.TEEN;

  return {
    id: pet.id,
    eggType: pet.eggType as EggType,
    stage,
    isAlbino: pet.isAlbino,
    traits: { a: pet.traitA, b: pet.traitB, c: pet.traitC },
    feedCount: pet.feedCount,
    feedRequired: canFeed ? requiredFeedCount(stage) : null,
    stage2Trait: (pet.stage2Trait as Trait | null) ?? null,
    combo: (pet.species?.combo as Combo | undefined) ?? null,
    speciesName: pet.species?.name ?? null,
    isTraded: pet.isTraded,
  };
}

/** 교환 화면에서 쓰는 축약형. 성체만 대상이므로 species 가 반드시 있다 */
export function toTradePetView(pet: PetWithSpecies): TradePetView {
  if (!pet.species) {
    throw new Error('성체가 아닌 개체는 교환 대상이 될 수 없다');
  }
  return {
    id: pet.id,
    speciesName: pet.species.name,
    eggType: pet.eggType as EggType,
    combo: pet.species.combo as Combo,
    isAlbino: pet.isAlbino,
  };
}
