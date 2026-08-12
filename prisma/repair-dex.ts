/**
 * 도감 기록 보정 (1회성).
 *
 * 알비노를 얻으면 같은 종의 일반 칸도 함께 열린다(8장). registerSpecies 는 지금
 * 두 칸을 함께 켜지만, 그 규칙이 자리잡기 전에 쌓인 기록은 hasAlbino 만 켜져
 * 있어 도감 상세에 "미발견" 이 남는다.
 *
 * 읽을 때 보정하면 저장된 값과 화면이 계속 어긋난 채로 남으므로, 어긋난 기록
 * 자체를 고친다. 이미 맞는 기록은 건드리지 않는다.
 *
 *   npx tsx prisma/repair-dex.ts
 */
import { db } from '../src/lib/server/db';

async function main() {
  const broken = await db.dexEntry.findMany({
    where: { hasNormal: false, hasAlbino: true },
    include: { species: true, user: { select: { nickname: true } } },
  });

  if (broken.length === 0) {
    console.log('보정할 기록이 없습니다.');
    await db.$disconnect();
    return;
  }

  console.log(`보정 대상 ${broken.length}건`);
  for (const e of broken) {
    console.log(`  ${e.user.nickname} / ${e.species.name}`);
  }

  const { count } = await db.dexEntry.updateMany({
    where: { hasNormal: false, hasAlbino: true },
    data: { hasNormal: true },
  });
  console.log(`보정 완료: ${count}건`);

  const left = await db.dexEntry.count({
    where: { hasNormal: false, hasAlbino: true },
  });
  console.log(`남은 어긋난 기록: ${left}건`);
  await db.$disconnect();
}

main();
