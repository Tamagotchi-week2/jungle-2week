/**
 * 도감 서비스 (설계 문서 8장).
 *
 * 완성도는 (hasNormal OR hasAlbino) 기준으로 센다.
 * 알비노만 보유해도 해당 칸은 완성 처리된다 — 알비노가 상위 호환이다.
 */

import type { Prisma } from '@/generated/prisma';
import { db } from '@/lib/server/db';
import { DEX_TOTAL } from '@/lib/game/constants';
import { SPECIES_LIST } from '@/lib/game/species';
import type { Combo, EggType } from '@/lib/game/types';
import type { DexCell, DexResponse } from '@/types/api';

/** 트랜잭션 안에서도 쓸 수 있도록 클라이언트를 주입받는다 */
type Db = Prisma.TransactionClient | typeof db;

/**
 * 도감 등록.
 *
 * 진화·교환 양쪽에서 호출되며, 반드시 호출부의 트랜잭션 안에서 실행해야 한다.
 * 소유권 이전과 도감 등록이 갈라지면 개체는 넘어갔는데 도감은 비어 있는 상태가 생긴다.
 */
export async function registerSpecies(
  tx: Db,
  userId: string,
  speciesId: number,
  isAlbino: boolean,
): Promise<void> {
  await tx.dexEntry.upsert({
    where: { userId_speciesId: { userId, speciesId } },
    update: isAlbino ? { hasAlbino: true } : { hasNormal: true },
    create: {
      userId,
      speciesId,
      hasNormal: !isAlbino,
      hasAlbino: isAlbino,
    },
  });
}

/**
 * 도감 24칸 전체.
 *
 * 보유하지 않은 칸도 빠짐없이 내려준다. 미획득 칸을 실루엣으로 표시해야 하고,
 * 클라이언트가 24칸을 스스로 만들어내면 순서와 이름이 서버와 갈릴 수 있다.
 */
export async function getDex(userId: string): Promise<DexResponse> {
  const [species, entries] = await Promise.all([
    db.species.findMany(),
    db.dexEntry.findMany({ where: { userId } }),
  ]);

  const speciesId = new Map(
    species.map((s) => [`${s.eggType}:${s.combo}`, s.id]),
  );
  const owned = new Map(entries.map((e) => [e.speciesId, e]));

  // 순서는 코드의 SPECIES_LIST 를 따른다. 알 종류별 6칸씩 4묶음이며,
  // 3열 8행 그리드에서 각 종류가 정확히 2행을 차지한다 (8장).
  const cells: DexCell[] = SPECIES_LIST.map((s) => {
    const id = speciesId.get(`${s.eggType}:${s.combo}`);
    const entry = id === undefined ? undefined : owned.get(id);
    return {
      eggType: s.eggType as EggType,
      combo: s.combo as Combo,
      name: s.name,
      hasNormal: entry?.hasNormal ?? false,
      hasAlbino: entry?.hasAlbino ?? false,
    };
  });

  const completed = cells.filter((c) => c.hasNormal || c.hasAlbino).length;

  return { cells, completed, total: DEX_TOTAL };
}
