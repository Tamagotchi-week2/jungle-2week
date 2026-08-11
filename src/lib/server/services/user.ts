import bcrypt from 'bcryptjs';
import { Prisma } from '@/generated/prisma';

import { db } from '@/lib/server/db';
import { rollStarterEggs } from '@/lib/game/eggs';
import type { EggType } from '@/lib/game/types';

const PASSWORD_HASH_ROUNDS = 10;

export class NicknameTakenError extends Error {}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

/**
 * 가입 처리. 비밀번호 해시 저장 + 초기 알 가챠 4회를 단일 트랜잭션으로 영속화한다 (17.1 / 6장).
 */
export async function createUser(nickname: string, password: string) {
  const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
  const starterEggs = rollStarterEggs(Math.random);

  const counts = new Map<EggType, number>();
  for (const eggType of starterEggs) {
    counts.set(eggType, (counts.get(eggType) ?? 0) + 1);
  }

  try {
    return await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { nickname, passwordHash },
      });

      await tx.userEgg.createMany({
        data: Array.from(counts.entries()).map(([eggType, count]) => ({
          userId: user.id,
          eggType,
          count,
        })),
      });

      return user;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new NicknameTakenError('이미 사용 중인 닉네임입니다.');
    }
    throw error;
  }
}
