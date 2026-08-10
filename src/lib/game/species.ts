/**
 * 24종 성체 마스터 데이터.
 * 설계 문서 2.3장의 매핑 표를 그대로 옮긴 것으로, 이 파일이 유일한 출처다.
 */

import type { Combo, EggType, Species } from './types';
import { COMBOS, EGG_TYPES } from './types';

/** eggType → combo → 표시명 */
const NAME_TABLE: Record<EggType, Record<Combo, string>> = {
  air: {
    aa: '오목눈이',
    ab: '닭',
    ac: '대머리수리',
    bb: '펭귄',
    bc: '타조',
    cc: '황조롱이',
  },
  land: {
    aa: '호랑이',
    ab: '고양이',
    ac: '멧돼지',
    bb: '개',
    bc: '판다',
    cc: '코끼리',
  },
  sea: {
    aa: '고래',
    ab: '흰동가리',
    ac: '아귀',
    bb: '해달',
    bc: '해마',
    cc: '킹크랩',
  },
  gold: {
    aa: '유니콘',
    ab: '티라노',
    ac: '구미호',
    bb: '용',
    bc: '돌고래',
    cc: '공작',
  },
};

/** 도감 순서대로 나열된 24종. 알 종류별 6칸씩 4묶음 (8장) */
export const SPECIES_LIST: readonly Species[] = EGG_TYPES.flatMap((eggType) =>
  COMBOS.map((combo) => ({
    eggType,
    combo,
    name: NAME_TABLE[eggType][combo],
  })),
);

/** `air:aa` 형태의 안정적인 식별자 */
export function speciesKey(eggType: EggType, combo: Combo): string {
  return `${eggType}:${combo}`;
}

const BY_KEY = new Map(
  SPECIES_LIST.map((s) => [speciesKey(s.eggType, s.combo), s]),
);

export function getSpecies(eggType: EggType, combo: Combo): Species {
  const found = BY_KEY.get(speciesKey(eggType, combo));
  if (!found) {
    throw new Error(`존재하지 않는 종: ${eggType}:${combo}`);
  }
  return found;
}
