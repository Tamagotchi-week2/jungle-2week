/**
 * 시드 스크립트.
 *
 * 1. species 24종 마스터 — src/lib/game/species.ts 를 유일한 출처로 삼아 DB 에 반영한다.
 *    DB 에 별도로 표를 적어두면 코드와 어긋날 수 있으므로 반드시 코드에서 가져온다.
 * 2. 개발용 테스트 계정 2개 — 교환은 두 계정이 필요해 혼자서는 테스트할 수 없다.
 *
 * 몇 번을 돌려도 같은 결과가 되도록 전부 upsert 로 작성했다.
 *
 *   npx prisma db seed
 */

import { PrismaClient } from '../src/generated/prisma';
import bcrypt from 'bcryptjs';

import { SPECIES_LIST } from '../src/lib/game/species';
import { setupNewUser } from '../src/lib/server/services/user';

const db = new PrismaClient();

/** 개발 전용. 운영 배포에는 넣지 않는다 */
const TEST_ACCOUNTS = [
  { nickname: '테스터1', password: 'test1234' },
  { nickname: '테스터2', password: 'test1234' },
];

async function seedSpecies() {
  for (const s of SPECIES_LIST) {
    await db.species.upsert({
      where: { eggType_combo: { eggType: s.eggType, combo: s.combo } },
      update: { name: s.name },
      create: { eggType: s.eggType, combo: s.combo, name: s.name },
    });
  }

  const count = await db.species.count();
  if (count !== 24) {
    throw new Error(`species 가 24행이어야 하는데 ${count}행이다`);
  }
  console.log(`species  : ${count}종`);
}

async function seedTestAccounts() {
  for (const account of TEST_ACCOUNTS) {
    const passwordHash = await bcrypt.hash(account.password, 10);

    const user = await db.user.upsert({
      where: { nickname: account.nickname },
      update: {},
      create: { nickname: account.nickname, passwordHash },
    });

    // 초기 알 가챠·밭·인벤토리는 가입 경로와 같은 함수를 쓴다.
    // 여기서 따로 만들면 실제 가입과 상태가 달라져, 시드 계정으로만 재현되는
    // 버그가 생긴다. 이미 받은 계정이면 다시 굴리지 않는다.
    const eggs = await setupNewUser(user.id);

    console.log(`account  : ${account.nickname} (${user.id}) 알 ${eggs.join(', ')}`);
  }

  console.log('  비밀번호는 두 계정 모두 test1234 — 개발 전용이다');
}

async function main() {
  console.log('시드 시작');
  await seedSpecies();
  await seedTestAccounts();
  console.log('시드 완료');
}

main()
  .catch((e) => {
    console.error('시드 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
