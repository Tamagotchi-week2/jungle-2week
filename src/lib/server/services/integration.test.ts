/**
 * 서비스 계층 통합 테스트.
 *
 * 순수 함수 테스트가 잡지 못하는 것을 본다 — 트랜잭션, 유니크 제약, 잠금,
 * 여러 서비스가 맞물리는 지점. 실제로 여기서만 드러난 버그가 있었다.
 * setupNewUser 가 "알이 없으면 아무것도 없다"고 가정해 제약에 걸린 건이 그렇다.
 *
 * 실행 조건:
 *   TEST_DATABASE_URL 이 설정된 경우에만 돈다. 없으면 통째로 건너뛴다.
 *   공유 개발 DB 를 가리키면 팀 데이터가 날아가므로 vitest.setup.ts 가 막는다.
 *
 *   $ TEST_DATABASE_URL="<개발 URL>&schema=test_integration" npm test
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/lib/server/db';
import { BALANCE } from '@/lib/game/constants';
import { SPECIES_LIST } from '@/lib/game/species';
import { GameRuleError } from '@/lib/game/errors';
import { getMeSnapshot, setupNewUser } from './user';
import { evolvePet, feedPet, hatchEgg, listAdultPets } from './pet';
import { claimRewardEgg, openRewardEgg } from './egg';
import { getDex } from './dex';
import {
  castFish,
  finishMine,
  harvestFarm,
  plantFarm,
  startMine,
  strikeFish,
} from './gather';
import {
  cancelTrade,
  createTrade,
  getActiveTrade,
  joinTrade,
  releaseExpiredTrades,
  resolveTrade,
} from './trade';
import {
  createGuestbookEntry,
  deleteGuestbookEntry,
  listGuestbookEntries,
} from './guestbook';

const enabled = Boolean(process.env.TEST_DATABASE_URL);
const suite = enabled ? describe : describe.skip;

/** 테스트마다 새 계정을 만든다. 이름이 겹치면 유니크 제약에 걸린다 */
let seq = 0;
async function newUser() {
  seq += 1;
  const user = await db.user.create({
    data: { nickname: `t${Date.now()}_${seq}`, passwordHash: 'x' },
  });
  await setupNewUser(user.id);
  return user.id;
}

/** 특정 알을 확실히 손에 쥐여준다. 가챠 결과에 의존하면 테스트가 불안정해진다 */
async function giveEgg(userId: string, eggType: 'air' | 'land' | 'sea' | 'gold') {
  await db.userEgg.upsert({
    where: { userId_eggType: { userId, eggType } },
    update: { count: { increment: 1 } },
    create: { userId, eggType, count: 1 },
  });
}

async function fillResources(userId: string, count = 999) {
  await db.inventory.updateMany({ where: { userId }, data: { count } });
}

/** 요구치만큼 먹이고 진화시킨다 */
async function raiseOneStage(
  userId: string,
  petId: string,
  resource: 'crop' | 'mineral' | 'seafood',
  need: number,
) {
  for (let i = 0; i < need; i += 1) await feedPet(userId, petId, resource);
  return evolvePet(userId, petId);
}

async function raiseToAdult(userId: string, eggType: 'air' | 'land' = 'air') {
  await giveEgg(userId, eggType);
  await fillResources(userId);
  const { pet } = await hatchEgg(userId, eggType);
  await raiseOneStage(userId, pet.id, 'crop', BALANCE.STAGE2_FEED_COUNT);
  const adult = await raiseOneStage(
    userId,
    pet.id,
    'crop',
    BALANCE.STAGE3_FEED_COUNT,
  );
  return adult.pet;
}

suite('서비스 계층 통합', () => {
  beforeAll(async () => {
    // 설정만 믿지 않고 격리를 실증한다.
    //
    // 이 스위트는 users·pets·trades 를 통째로 비운다. 개발 DB 에 붙어 있으면
    // 팀 데이터가 날아간다. 실제로 env 덮어쓰기가 무효화되어 그런 사고가 있었다.
    // 그래서 지우기 전에 "쓴 것이 격리 스키마에 들어갔는지"를 직접 확인한다.
    const marker = `__isolation_check_${Date.now()}`;
    const probe = await db.user.create({
      data: { nickname: marker, passwordHash: 'x' },
    });
    const landed = await db.$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM test_integration.users WHERE nickname = $1`,
      marker,
    );
    await db.user.delete({ where: { id: probe.id } });

    if (landed[0].n !== 1) {
      throw new Error(
        '통합 테스트가 격리 스키마(test_integration)에 붙어 있지 않다. ' +
          '이대로 진행하면 개발 DB 의 데이터를 지운다. TEST_DATABASE_URL 설정을 확인할 것.',
      );
    }

    // species 마스터가 없으면 성체 진화가 실패한다.
    // 원격 DB 왕복이 느려 24회 순차 upsert 는 훅 타임아웃을 넘긴다. 한 번에 넣는다.
    await db.species.createMany({
      data: SPECIES_LIST.map((s) => ({
        eggType: s.eggType,
        combo: s.combo,
        name: s.name,
      })),
      skipDuplicates: true,
    });
  });

  beforeEach(async () => {
    // 계정과 그에 딸린 것만 지운다. species 는 유지한다
    await db.trade.deleteMany({});
    await db.pet.deleteMany({});
    await db.user.deleteMany({});
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  describe('계정 초기 셋업', () => {
    it('알 4개와 밭 1구획, 자원 3행을 만든다', async () => {
      const userId = await newUser();

      const eggs = await db.userEgg.findMany({ where: { userId } });
      expect(eggs.reduce((n, e) => n + e.count, 0)).toBe(
        BALANCE.STARTER_EGG_COUNT,
      );
      expect(await db.farmPlot.count({ where: { userId } })).toBe(
        BALANCE.FARM_PLOTS,
      );
      expect(await db.inventory.count({ where: { userId } })).toBe(3);
    });

    it('재호출해도 알을 다시 굴리지 않는다', async () => {
      const userId = await newUser();
      const before = await db.userEgg.findMany({ where: { userId } });

      await setupNewUser(userId);

      const after = await db.userEgg.findMany({ where: { userId } });
      expect(after).toEqual(before);
    });
  });

  describe('개체 생애주기', () => {
    it('부화부터 성체까지 진행하고 도감에 등록된다', async () => {
      const userId = await newUser();
      const adult = await raiseToAdult(userId);

      expect(adult.stage).toBe(3);
      expect(adult.combo).toBe('aa');
      expect(adult.speciesName).toBe('오목눈이');

      const dex = await getDex(userId);
      expect(dex.completed).toBe(1);
      expect(dex.cells).toHaveLength(24);
      expect(dex.cells.find((c) => c.name === '오목눈이')?.hasNormal).toBe(true);
    });

    it('단계 전환 시 카운터가 리셋되어 다른 조합이 나온다', async () => {
      const userId = await newUser();
      await giveEgg(userId, 'land');
      await fillResources(userId);

      const { pet } = await hatchEgg(userId, 'land');
      await raiseOneStage(userId, pet.id, 'crop', BALANCE.STAGE2_FEED_COUNT);
      const adult = await raiseOneStage(
        userId,
        pet.id,
        'mineral',
        BALANCE.STAGE3_FEED_COUNT,
      );

      // 리셋이 없으면 a 가 계속 누적되어 aa 가 된다
      expect(adult.pet.combo).toBe('ab');
      expect(adult.pet.speciesName).toBe('고양이');
    });

    it('육성 중인 개체가 있으면 새로 부화할 수 없다', async () => {
      const userId = await newUser();
      await giveEgg(userId, 'air');
      await giveEgg(userId, 'air');
      await hatchEgg(userId, 'air');

      await expect(hatchEgg(userId, 'air')).rejects.toThrow(GameRuleError);
    });

    it('타인의 개체는 먹이거나 진화시킬 수 없다', async () => {
      const owner = await newUser();
      const other = await newUser();
      await giveEgg(owner, 'air');
      const { pet } = await hatchEgg(owner, 'air');

      await expect(feedPet(other, pet.id, 'crop')).rejects.toThrow(GameRuleError);
      await expect(evolvePet(other, pet.id)).rejects.toThrow(GameRuleError);
    });

    it('자원이 없으면 먹일 수 없고 자원이 줄어든다', async () => {
      const userId = await newUser();
      await giveEgg(userId, 'air');
      const { pet } = await hatchEgg(userId, 'air');

      await expect(feedPet(userId, pet.id, 'crop')).rejects.toThrow(
        GameRuleError,
      );

      await fillResources(userId, 5);
      const res = await feedPet(userId, pet.id, 'crop');
      expect(res.resources.crop).toBe(5 - BALANCE.FEED_COST);
    });
  });

  describe('보상 알', () => {
    it('성체 완성으로 자격이 생기고 최초 1회는 금색이 확정된다', async () => {
      const userId = await newUser();
      await raiseToAdult(userId);

      let me = await getMeSnapshot(userId);
      expect(me.unclaimedRewards).toBe(1);
      expect(me.hasPendingReward).toBe(false);

      const open = await openRewardEgg(userId);
      expect(open.choices).not.toContain('gold');

      me = await getMeSnapshot(userId);
      expect(me.hasPendingReward).toBe(true);

      const claim = await claimRewardEgg(userId, 'sea');
      expect(claim.granted).toBe('gold'); // 선택과 무관하게 금색
      expect(claim.transformed).toBe(true);

      me = await getMeSnapshot(userId);
      expect(me.unclaimedRewards).toBe(0);
    });

    it('자격이 없으면 열 수 없고, 중복 수령도 막힌다', async () => {
      const userId = await newUser();
      await expect(openRewardEgg(userId)).rejects.toThrow(GameRuleError);

      await raiseToAdult(userId);
      await openRewardEgg(userId);
      await claimRewardEgg(userId, 'air');

      await expect(claimRewardEgg(userId, 'air')).rejects.toThrow(GameRuleError);
    });

    it('재호출해도 판정을 다시 굴리지 않는다', async () => {
      const userId = await newUser();
      await raiseToAdult(userId);

      await openRewardEgg(userId);
      const first = await db.user.findUniqueOrThrow({ where: { id: userId } });
      await openRewardEgg(userId);
      const second = await db.user.findUniqueOrThrow({ where: { id: userId } });

      expect(second.pendingRewardIsGold).toBe(first.pendingRewardIsGold);
    });
  });

  describe('채집', () => {
    it('농사는 시간이 지나야 수확된다', async () => {
      const userId = await newUser();

      await expect(harvestFarm(userId)).rejects.toThrow(GameRuleError);

      await plantFarm(userId);
      await expect(plantFarm(userId)).rejects.toThrow(GameRuleError);
      await expect(harvestFarm(userId)).rejects.toThrow(GameRuleError);

      // 서버 시각을 과거로 돌려 경과를 재현한다
      const plot = await db.farmPlot.findFirstOrThrow({ where: { userId } });
      await db.farmPlot.update({
        where: { id: plot.id },
        data: {
          plantedAt: new Date(
            Date.now() - (BALANCE.FARM_GROW_SECONDS + 1) * 1000,
          ),
        },
      });

      const harvest = await harvestFarm(userId);
      expect(harvest.gained).toBe(BALANCE.FARM_YIELD);
    });

    it('광산은 사람이 낼 수 없는 속도를 거절하고 세션을 재사용할 수 없다', async () => {
      const userId = await newUser();

      const started = await startMine(userId);
      expect(started.clickTarget).toBe(BALANCE.MINE_CLICK_TARGET);

      // 사람이 낼 수 없는 속도를 스스로 보고 → 하한 미달
      const tooFast = await finishMine(
        userId,
        started.sessionId,
        BALANCE.MINE_CLICK_TARGET,
        10,
      );
      expect(tooFast.success).toBe(false);
      expect(tooFast.reason).toBe('too_fast');

      await expect(
        finishMine(userId, started.sessionId, BALANCE.MINE_CLICK_TARGET, 10),
      ).rejects.toThrow(GameRuleError);
    });

    it('광산은 세션 수명보다 긴 소요 시간 주장을 믿지 않는다', async () => {
      const userId = await newUser();
      const started = await startMine(userId);

      // 세션은 방금 열렸다. 하한을 넘기려고 한 시간을 주장해도 서버가 본
      // 경과로 깎여 하한 미달이 된다.
      const inflated = await finishMine(
        userId,
        started.sessionId,
        BALANCE.MINE_CLICK_TARGET,
        3_600_000,
      );
      expect(inflated.success).toBe(false);
      expect(inflated.reason).toBe('too_fast');
    });

    it('광산은 충분히 연타하고 시간도 채우면 성공한다', async () => {
      const userId = await newUser();
      const started = await startMine(userId);

      // 세션을 과거로 밀어 서버 경과를 확보한다. 주장한 시간이 그 안에 들어간다.
      await db.gatherSession.update({
        where: { id: started.sessionId },
        data: { startedAt: new Date(Date.now() - 60_000) },
      });

      const ok = await finishMine(
        userId,
        started.sessionId,
        BALANCE.MINE_CLICK_TARGET,
        BALANCE.MINE_CLICK_TARGET * BALANCE.MINE_MIN_MS_PER_CLICK + 1_000,
      );
      expect(ok.success).toBe(true);
      expect(ok.gained).toBe(BALANCE.MINE_YIELD);
      expect(ok.resources.mineral).toBe(BALANCE.MINE_YIELD);
    });

    it('광산은 연타 수가 모자라면 실패한다', async () => {
      const userId = await newUser();
      const started = await startMine(userId);

      const session = await db.gatherSession.findUniqueOrThrow({
        where: { id: started.sessionId },
      });
      await db.gatherSession.update({
        where: { id: session.id },
        data: { startedAt: new Date(Date.now() - 60_000) },
      });

      const result = await finishMine(userId, started.sessionId, 1, 60_000);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('not_enough');
    });

    it('어업은 입질 전 입력과 윈도우 초과를 구분해 거절한다', async () => {
      const userId = await newUser();

      const early = await castFish(userId);
      expect(early.biteDelayMs).toBeGreaterThanOrEqual(
        BALANCE.FISH_BITE_DELAY_MIN,
      );
      // 입질 전 입력. 클라이언트가 반응시간 0 을 보고한다
      const earlyResult = await strikeFish(userId, early.sessionId, 0);
      expect(earlyResult.success).toBe(false);
      expect(earlyResult.reason).toBe('too_early');

      // 입질 시각을 앞당겨 정타를 재현한다
      const hit = await castFish(userId);
      await db.gatherSession.update({
        where: { id: hit.sessionId },
        data: { startedAt: new Date(Date.now() - hit.biteDelayMs - 200) },
      });
      const hitResult = await strikeFish(userId, hit.sessionId, 250);
      expect(hitResult.success).toBe(true);
      expect(hitResult.gained).toBe(BALANCE.FISH_YIELD);

      const late = await castFish(userId);
      await db.gatherSession.update({
        where: { id: late.sessionId },
        data: {
          startedAt: new Date(
            Date.now() - late.biteDelayMs - BALANCE.FISH_QTE_WINDOW_MS - 1000,
          ),
        },
      });
      // 로컬 반응시간 자체가 창을 넘긴 경우
      const lateResult = await strikeFish(
        userId,
        late.sessionId,
        BALANCE.FISH_QTE_WINDOW_MS + 300,
      );
      expect(lateResult.success).toBe(false);
      expect(lateResult.reason).toBe('too_late');
    });

    it('도착이 늦으면 반응시간 주장을 믿지 않는다', async () => {
      const userId = await newUser();
      const session = await castFish(userId);

      // 허용 지연을 크게 넘겨 도착한 상황
      await db.gatherSession.update({
        where: { id: session.sessionId },
        data: {
          startedAt: new Date(
            Date.now() -
              session.biteDelayMs -
              BALANCE.FISH_QTE_WINDOW_MS -
              BALANCE.FISH_MAX_LATENCY_MS -
              1000,
          ),
        },
      });

      const result = await strikeFish(userId, session.sessionId, 200);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('too_late');
    });

    it('왕복 지연이 있어도 로컬 반응시간이 창 안이면 성공한다', async () => {
      const userId = await newUser();
      const session = await castFish(userId);

      // 입질 후 2초 뒤에 도착 — 서버 기준으로는 창을 넘겼지만 허용 지연 안이다
      await db.gatherSession.update({
        where: { id: session.sessionId },
        data: {
          startedAt: new Date(Date.now() - session.biteDelayMs - 2000),
        },
      });

      const result = await strikeFish(userId, session.sessionId, 300);
      expect(result.success).toBe(true);
    });
  });

  describe('도감', () => {
    it('알비노를 얻으면 같은 종의 일반 칸도 함께 열린다', async () => {
      const userId = await newUser();
      await giveEgg(userId, 'air');
      await fillResources(userId);

      // 부화 판정은 5% 라 그대로 두면 시험이 불안정하다. 부화시킨 뒤 알비노로
      // 바꿔 진화 경로(registerSpecies)만 결정적으로 확인한다.
      const { pet } = await hatchEgg(userId, 'air');
      await db.pet.update({ where: { id: pet.id }, data: { isAlbino: true } });

      await raiseOneStage(userId, pet.id, 'crop', BALANCE.STAGE2_FEED_COUNT);
      await raiseOneStage(userId, pet.id, 'crop', BALANCE.STAGE3_FEED_COUNT);

      const cell = (await getDex(userId)).cells.find((c) => c.name === '오목눈이');
      expect(cell?.hasAlbino).toBe(true);
      // 알비노는 상위 호환이다. 같은 종을 일반으로 한 번 더 키우게 만들지 않는다.
      expect(cell?.hasNormal).toBe(true);
    });

    it('교환으로 개체를 넘겨도 도감 칸은 닫히지 않는다', async () => {
      const a = await newUser();
      const b = await newUser();
      const petA = await raiseToAdult(a, 'air');
      const petB = await raiseToAdult(b, 'land');

      const beforeCompleted = (await getDex(a)).completed;
      expect(beforeCompleted).toBe(1);

      const created = await createTrade(a, petA.id);
      const joined = await joinTrade(b, created.code, petB.id);
      await resolveTrade(a, joined.tradeId, true);

      // 오목눈이는 이제 b 의 것이다. 그래도 a 의 도감에는 남아야 한다 —
      // 도감은 "지금 가진 것" 이 아니라 "본 적 있는 것" 의 기록이다.
      const after = await getDex(a);
      expect(after.cells.find((c) => c.name === '오목눈이')?.hasNormal).toBe(true);
      expect(after.completed).toBe(2);

      expect((await db.pet.findUniqueOrThrow({ where: { id: petA.id } })).ownerId).toBe(b);
    });
  });

  describe('교환', () => {
    it('두 계정이 개체를 주고받고 양쪽 도감에 등록된다', async () => {
      const a = await newUser();
      const b = await newUser();
      const petA = await raiseToAdult(a, 'air');
      const petB = await raiseToAdult(b, 'land');

      const created = await createTrade(a, petA.id);
      expect(created.code).toHaveLength(6);

      const joined = await joinTrade(b, created.code, petB.id);
      const resolved = await resolveTrade(a, joined.tradeId, true);
      expect(resolved.status).toBe('accepted');

      // 소유권이 실제로 넘어갔는가
      expect((await db.pet.findUniqueOrThrow({ where: { id: petA.id } })).ownerId).toBe(b);
      expect((await db.pet.findUniqueOrThrow({ where: { id: petB.id } })).ownerId).toBe(a);

      // 양쪽 도감이 2칸이 되었는가
      expect((await getDex(a)).completed).toBe(2);
      expect((await getDex(b)).completed).toBe(2);
    });

    it('교환한 개체는 다시 교환할 수 없다', async () => {
      const a = await newUser();
      const b = await newUser();
      const petA = await raiseToAdult(a, 'air');
      const petB = await raiseToAdult(b, 'land');

      const created = await createTrade(a, petA.id);
      const joined = await joinTrade(b, created.code, petB.id);
      await resolveTrade(a, joined.tradeId, true);

      await expect(createTrade(b, petA.id)).rejects.toThrow(GameRuleError);
    });

    it('교환됨 표시는 실제로 성사됐을 때만 켜진다', async () => {
      const a = await newUser();
      const b = await newUser();
      const petA = await raiseToAdult(a, 'air');
      const petB = await raiseToAdult(b, 'land');

      const traded = async (id: string) =>
        (await db.pet.findUniqueOrThrow({ where: { id } })).isTraded;

      // 발급만 한 상태 — 아직 아무것도 오가지 않았다
      const created = await createTrade(a, petA.id);
      expect(await traded(petA.id)).toBe(false);

      // 상대가 들어왔지만 제안자가 확정하기 전 — 여전히 아니다
      const joined = await joinTrade(b, created.code, petB.id);
      expect(await traded(petA.id)).toBe(false);
      expect(await traded(petB.id)).toBe(false);

      // 거절 — 잠금만 풀리고 표시는 그대로 꺼져 있어야 한다
      await resolveTrade(a, joined.tradeId, false);
      expect(await traded(petA.id)).toBe(false);
      expect(await traded(petB.id)).toBe(false);

      // 다시 걸었다가 취소 — 마찬가지다
      const again = await createTrade(a, petA.id);
      const joinedAgain = await joinTrade(b, again.code, petB.id);
      await cancelTrade(a, joinedAgain.tradeId);
      expect(await traded(petA.id)).toBe(false);
      expect(await traded(petB.id)).toBe(false);

      // 성사됐을 때 비로소 양쪽 다 켜진다
      const final = await createTrade(a, petA.id);
      const finalJoined = await joinTrade(b, final.code, petB.id);
      await resolveTrade(a, finalJoined.tradeId, true);
      expect(await traded(petA.id)).toBe(true);
      expect(await traded(petB.id)).toBe(true);
    });

    it('교환됨 개체는 내놓을 후보에서 빠진다', async () => {
      const a = await newUser();
      const b = await newUser();
      const petA = await raiseToAdult(a, 'air');
      const petB = await raiseToAdult(b, 'land');

      const created = await createTrade(a, petA.id);
      const joined = await joinTrade(b, created.code, petB.id);
      await resolveTrade(a, joined.tradeId, true);

      // 교환 후 a 는 petB 를 갖고 있지만, 그 개체도 이미 교환된 것이라
      // 다시 내놓을 수 없다 (개체당 1회 한정, 9장).
      const mine = await listAdultPets(a);
      expect(mine.pets.map((p) => p.id)).toContain(petB.id);
      expect(mine.pets.filter((p) => !p.isTraded)).toHaveLength(0);
      expect(mine.tradableCount).toBe(0);
    });

    it('다른 교환에 걸린 개체는 isLocked 로 구분된다', async () => {
      const a = await newUser();
      const b = await newUser();
      const petA = await raiseToAdult(a, 'air');
      const petB = await raiseToAdult(b, 'land');

      const before = await listAdultPets(a);
      expect(before.pets[0].isLocked).toBe(false);

      const created = await createTrade(a, petA.id);

      // 아직 성사되지 않았으므로 isTraded 는 false 다. 화면이 이것만 보고
      // 거르면 잠긴 개체가 후보로 남는다 — isLocked 가 그 구멍을 메운다.
      const locked = await listAdultPets(a);
      expect(locked.pets[0].isTraded).toBe(false);
      expect(locked.pets[0].isLocked).toBe(true);

      const joined = await joinTrade(b, created.code, petB.id);
      await cancelTrade(a, joined.tradeId);

      const unlocked = await listAdultPets(a);
      expect(unlocked.pets[0].isLocked).toBe(false);
    });

    it('유효 시간이 지난 교환은 아무도 건드리지 않아도 회수된다', async () => {
      const a = await newUser();
      const petA = await raiseToAdult(a, 'air');

      // 코드만 발급하고 방치한 상황. 예전에는 join/resolve 로 그 교환을 건드려야
      // 만료가 반영돼서, 아무도 참여하지 않으면 개체가 영구히 묶였다.
      const created = await createTrade(a, petA.id);
      await db.trade.update({
        where: { code: created.code },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      expect((await listAdultPets(a)).pets[0].isLocked).toBe(true);

      expect(await releaseExpiredTrades(a)).toBe(1);

      expect((await listAdultPets(a)).pets[0].isLocked).toBe(false);
      expect((await listAdultPets(a)).tradableCount).toBe(1);
      // 회수된 뒤에는 곧바로 다시 걸 수 있어야 한다
      await expect(createTrade(a, petA.id)).resolves.toBeTruthy();
    });

    it('진행 중인 교환을 조회해 화면이 이어붙을 수 있다', async () => {
      const a = await newUser();
      const b = await newUser();
      const petA = await raiseToAdult(a, 'air');
      const petB = await raiseToAdult(b, 'land');

      expect(await getActiveTrade(a)).toBeNull();

      const created = await createTrade(a, petA.id);
      const proposed = await getActiveTrade(a);
      expect(proposed?.status).toBe('proposed');
      expect(proposed?.code).toBe(created.code);
      expect(proposed?.iAmProposer).toBe(true);
      expect(proposed?.theirPet).toBeNull();

      const joined = await joinTrade(b, created.code, petB.id);

      // 같은 교환이라도 보는 사람에 따라 권한이 다르다. 이걸 뒤집으면
      // 참여자에게 확정 버튼이 열리거나 제안자의 버튼이 죽는다.
      const forProposer = await getActiveTrade(a);
      expect(forProposer?.iAmProposer).toBe(true);
      expect(forProposer?.myPet.id).toBe(petA.id);
      expect(forProposer?.theirPet?.id).toBe(petB.id);

      const forJoiner = await getActiveTrade(b);
      expect(forJoiner?.iAmProposer).toBe(false);
      expect(forJoiner?.myPet.id).toBe(petB.id);
      expect(forJoiner?.theirPet?.id).toBe(petA.id);

      // 끝난 교환은 더 이상 진행 중이 아니다
      await resolveTrade(a, joined.tradeId, true);
      expect(await getActiveTrade(a)).toBeNull();
      expect(await getActiveTrade(b)).toBeNull();
    });

    it('진행 중인 교환은 계정당 하나뿐이다', async () => {
      const a = await newUser();
      const petA = await raiseToAdult(a, 'air');
      const petB = await raiseToAdult(a, 'land');

      const first = await createTrade(a, petA.id);
      // 두 번째를 발급하면 상대 없는 첫 건은 잊은 것으로 보고 정리된다.
      // 그러지 않으면 하나를 취소해도 화면이 남은 건으로 복귀해 버린다.
      const second = await createTrade(a, petB.id);

      const active = await getActiveTrade(a);
      expect(active?.code).toBe(second.code);
      expect(active?.code).not.toBe(first.code);

      // 정리된 건에 걸려 있던 개체는 잠금이 풀려야 한다
      const pets = await listAdultPets(a);
      expect(pets.pets.find((p) => p.id === petA.id)?.isLocked).toBe(false);
      expect(pets.pets.find((p) => p.id === petB.id)?.isLocked).toBe(true);

      // 취소하면 남은 진행 건이 없다
      await cancelTrade(a, (await getActiveTrade(a))!.tradeId);
      expect(await getActiveTrade(a)).toBeNull();
    });

    it('상대가 참여한 교환이 있으면 새로 발급하지 않는다', async () => {
      const a = await newUser();
      const b = await newUser();
      const petA = await raiseToAdult(a, 'air');
      const petB = await raiseToAdult(b, 'land');
      const spare = await raiseToAdult(a, 'land');

      const created = await createTrade(a, petA.id);
      await joinTrade(b, created.code, petB.id);

      // joined 는 상대가 내 확정을 기다리는 중이다. 말없이 없애면 안 된다.
      await expect(createTrade(a, spare.id)).rejects.toThrow(GameRuleError);
    });

    it('성체가 아니면 교환에 걸 수 없다', async () => {
      const userId = await newUser();
      await giveEgg(userId, 'air');
      const { pet } = await hatchEgg(userId, 'air');

      await expect(createTrade(userId, pet.id)).rejects.toThrow(GameRuleError);
    });

    it('취소하면 양쪽 잠금이 풀리고 즉시 재발급할 수 있다', async () => {
      const a = await newUser();
      const b = await newUser();
      const petA = await raiseToAdult(a, 'air');
      const petB = await raiseToAdult(b, 'land');

      const created = await createTrade(a, petA.id);
      await joinTrade(b, created.code, petB.id);

      expect((await listAdultPets(a)).tradableCount).toBe(0);
      expect((await listAdultPets(b)).tradableCount).toBe(0);

      const status = await db.trade.findFirstOrThrow({
        where: { code: created.code },
      });
      await cancelTrade(a, status.id);

      expect((await listAdultPets(a)).tradableCount).toBe(1);
      expect((await listAdultPets(b)).tradableCount).toBe(1);

      // 만료를 기다리지 않고 다시 걸 수 있다
      await expect(createTrade(a, petA.id)).resolves.toBeTruthy();
    });

    it('제안자만 취소할 수 있다', async () => {
      const a = await newUser();
      const b = await newUser();
      const petA = await raiseToAdult(a, 'air');

      const created = await createTrade(a, petA.id);
      const trade = await db.trade.findFirstOrThrow({
        where: { code: created.code },
      });

      await expect(cancelTrade(b, trade.id)).rejects.toThrow(GameRuleError);
    });

    it('만료된 코드는 거절되고 잠금이 풀린다', async () => {
      const a = await newUser();
      const b = await newUser();
      const petA = await raiseToAdult(a, 'air');
      const petB = await raiseToAdult(b, 'land');

      const created = await createTrade(a, petA.id);
      await db.trade.updateMany({
        where: { code: created.code },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await expect(joinTrade(b, created.code, petB.id)).rejects.toThrow(
        GameRuleError,
      );
      expect((await listAdultPets(a)).tradableCount).toBe(1);
    });
  });

  describe('방명록', () => {
    it('전역 게시판이라 남의 글도 보인다', async () => {
      const a = await newUser();
      const b = await newUser();

      await createGuestbookEntry(a, 'A 의 글');
      await createGuestbookEntry(b, 'B 의 글');

      const list = await listGuestbookEntries(a);
      expect(list.entries).toHaveLength(2);
      expect(list.entries.map((e) => e.message)).toContain('B 의 글');
      // 내 글만 mine 이다
      expect(list.entries.filter((e) => e.mine)).toHaveLength(1);
    });

    it('길이 제한과 작성 쿨다운이 적용된다', async () => {
      const userId = await newUser();

      await expect(
        createGuestbookEntry(userId, 'x'.repeat(BALANCE.GUESTBOOK_MAX_LENGTH + 1)),
      ).rejects.toThrow(GameRuleError);

      await createGuestbookEntry(userId, '첫 글');
      await expect(createGuestbookEntry(userId, '연속 작성')).rejects.toThrow(
        GameRuleError,
      );
    });

    it('작성자만 삭제할 수 있다', async () => {
      const a = await newUser();
      const b = await newUser();
      const entry = await createGuestbookEntry(a, '지울 글');

      await expect(deleteGuestbookEntry(b, entry.id)).rejects.toThrow(
        GameRuleError,
      );
      await expect(deleteGuestbookEntry(a, entry.id)).resolves.toBeUndefined();
      expect((await listGuestbookEntries(a)).entries).toHaveLength(0);
    });
  });
});
