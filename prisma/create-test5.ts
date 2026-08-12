/**
 * QA 계정 생성 — 도감 24종(일반+알비노) 전부 열린 상태로 시작한다.
 *
 * createUser 를 그대로 써서 초기 셋업(비밀번호 해시, 시작 알 4개, 밭 1구획,
 * 자원 인벤토리 3행)을 실제 가입과 동일하게 맞춘 뒤, dexEntry 만 24종
 * 전부 hasNormal/hasAlbino 를 true 로 채운다. 개체를 24마리 실제로 키우지
 * 않고 도감 열람만 테스트할 목적이라 이 방식이 맞다.
 *
 *   npx tsx prisma/create-test5.ts
 */
import { db } from '../src/lib/server/db';
import { createUser } from '../src/lib/server/services/user';
import { getDex } from '../src/lib/server/services/dex';

const NICKNAME = '테스트5';
const PASSWORD = 'test12345';

async function main() {
  const existing = await db.user.findUnique({ where: { nickname: NICKNAME } });
  if (existing) {
    console.log(`이미 존재한다: ${NICKNAME} (id=${existing.id})`);
    await db.$disconnect();
    return;
  }

  const user = await createUser(NICKNAME, PASSWORD);
  console.log(`계정 생성: ${NICKNAME} (id=${user.id})`);

  const species = await db.species.findMany();
  console.log(`species 마스터 ${species.length}종에 도감 등록 중...`);

  await db.$transaction(
    species.map((s) =>
      db.dexEntry.upsert({
        where: { userId_speciesId: { userId: user.id, speciesId: s.id } },
        update: { hasNormal: true, hasAlbino: true },
        create: { userId: user.id, speciesId: s.id, hasNormal: true, hasAlbino: true },
      }),
    ),
  );

  const dex = await getDex(user.id);
  console.log(`도감 완성도: ${dex.completed} / ${dex.total}`);
  console.log(`로그인: 닉네임=${NICKNAME} / 비밀번호=${PASSWORD}`);

  await db.$disconnect();
}

main();
