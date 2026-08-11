/**
 * 스프라이트 경로 규칙 테스트 (설계 문서 11장).
 *
 * 물량이 규격과 맞는지도 함께 검증한다.
 * 경로가 규칙에서 벗어나면 아트 파일과 코드가 어긋나 런타임에야 드러난다.
 */

import { describe, expect, it } from 'vitest';

import {
  adultSprite,
  babySprite,
  buildingSprite,
  eggSprite,
  petSprite,
  playerSprite,
  teenSprite,
  tileSprite,
} from './sprites';
import { COMBOS, EGG_TYPES, TRAITS } from './game/types';

describe('경로 규칙', () => {
  it('알 — 알비노 구분이 없다', () => {
    expect(eggSprite('gold')).toBe('/sprites/egg/gold.png');
  });

  it('유아기', () => {
    expect(babySprite('air', false)).toBe('/sprites/baby/air.png');
    expect(babySprite('air', true)).toBe('/sprites/baby/air_albino.png');
  });

  it('성장기', () => {
    expect(teenSprite('land', 'b', false)).toBe('/sprites/teen/land_b.png');
    expect(teenSprite('land', 'b', true)).toBe('/sprites/teen/land_b_albino.png');
  });

  it('성체', () => {
    expect(adultSprite('sea', 'ac', false)).toBe('/sprites/adult/sea_ac.png');
    expect(adultSprite('sea', 'ac', true)).toBe('/sprites/adult/sea_ac_albino.png');
  });

  it('마을 에셋', () => {
    expect(playerSprite('down', 0)).toBe('/sprites/player/down_0.png');
    expect(playerSprite('left', 2)).toBe('/sprites/player/left_2.png');
    expect(tileSprite('grass')).toBe('/sprites/tiles/grass.png');
    expect(buildingSprite('mailbox')).toBe('/sprites/buildings/mailbox.png');
  });
});

describe('물량', () => {
  it('알 4장, 유아기 8장, 성장기 24장, 성체 48장으로 총 84장', () => {
    const paths = new Set<string>();

    for (const egg of EGG_TYPES) {
      paths.add(eggSprite(egg));
      for (const albino of [false, true]) {
        paths.add(babySprite(egg, albino));
        for (const t of TRAITS) paths.add(teenSprite(egg, t, albino));
        for (const c of COMBOS) paths.add(adultSprite(egg, c, albino));
      }
    }

    expect(paths.size).toBe(84);
  });

  it('알비노 경로가 일반 경로와 겹치지 않는다', () => {
    for (const egg of EGG_TYPES) {
      expect(babySprite(egg, false)).not.toBe(babySprite(egg, true));
      for (const c of COMBOS) {
        expect(adultSprite(egg, c, false)).not.toBe(adultSprite(egg, c, true));
      }
    }
  });
});

describe('petSprite — 개체 상태로 경로 선택', () => {
  it('단계별로 알맞은 경로를 고른다', () => {
    expect(petSprite({ eggType: 'air', stage: 0, isAlbino: false })).toBe(
      '/sprites/egg/air.png',
    );
    expect(petSprite({ eggType: 'air', stage: 1, isAlbino: true })).toBe(
      '/sprites/baby/air_albino.png',
    );
    expect(
      petSprite({ eggType: 'air', stage: 2, isAlbino: false, stage2Trait: 'c' }),
    ).toBe('/sprites/teen/air_c.png');
    expect(
      petSprite({ eggType: 'air', stage: 3, isAlbino: false, combo: 'bc' }),
    ).toBe('/sprites/adult/air_bc.png');
  });

  it('알 단계는 알비노여도 같은 경로다 — 부화 전 결과 노출 방지', () => {
    expect(petSprite({ eggType: 'gold', stage: 0, isAlbino: true })).toBe(
      petSprite({ eggType: 'gold', stage: 0, isAlbino: false }),
    );
  });

  it('필요한 정보가 없으면 예외를 던진다', () => {
    expect(() =>
      petSprite({ eggType: 'air', stage: 2, isAlbino: false }),
    ).toThrow();
    expect(() =>
      petSprite({ eggType: 'air', stage: 3, isAlbino: false }),
    ).toThrow();
  });
});
