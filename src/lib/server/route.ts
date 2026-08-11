/**
 * API 라우트 공통 처리.
 *
 * 라우트마다 try/catch 를 반복하면 어떤 곳은 500 을, 어떤 곳은 400 을 돌려주는
 * 식으로 응답이 갈린다. 오류 → 상태 코드 변환은 여기 한 곳에서만 한다.
 */

import { NextResponse } from 'next/server';

import { GameRuleError } from '@/lib/game/errors';
import { UnauthenticatedError, getCurrentUserId } from './session';

/**
 * 인증된 핸들러를 감싼다.
 *
 * 행위자는 세션에서만 도출한다. 핸들러는 userId 를 인자로 받을 뿐,
 * 요청 바디에서 사용자를 읽지 않는다.
 */
export function withUser<T>(
  handler: (userId: string, req: Request) => Promise<T>,
) {
  return async (req: Request): Promise<NextResponse> => {
    try {
      const userId = await getCurrentUserId();
      return NextResponse.json(await handler(userId, req));
    } catch (e) {
      if (e instanceof UnauthenticatedError) {
        return NextResponse.json({ error: e.message }, { status: 401 });
      }
      if (e instanceof GameRuleError) {
        // 규칙 위반은 클라이언트가 고칠 수 있는 문제이므로 400 이다
        return NextResponse.json({ error: e.message }, { status: 400 });
      }

      console.error('[api] 처리되지 않은 오류:', e);
      return NextResponse.json(
        { error: '서버 오류가 발생했다' },
        { status: 500 },
      );
    }
  };
}

/** 요청 본문 파싱. 본문이 없거나 JSON 이 아니면 규칙 위반으로 취급한다 */
export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new GameRuleError('요청 본문이 올바른 JSON 이 아니다');
  }
}

/** 허용된 값 중 하나인지 확인한다 */
export function expectOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new GameRuleError(
      `${field} 값이 올바르지 않다. 허용: ${allowed.join(', ')}`,
    );
  }
  return value as T;
}

export function expectString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new GameRuleError(`${field} 가 필요하다`);
  }
  return value;
}

export function expectInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new GameRuleError(`${field} 는 0 이상의 정수여야 한다`);
  }
  return value;
}
