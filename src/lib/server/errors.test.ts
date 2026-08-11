/**
 * 규칙 위반 예외가 한 종류로 유지되는지 지킨다.
 *
 * 두 트랙이 각자 예외 클래스를 만들었던 적이 있고, 그때 한쪽 래퍼가 다른 쪽
 * 예외를 못 알아봐 400 이어야 할 응답이 500 으로 나갔다. 다시 갈라지면
 * 이 테스트가 먼저 깨진다.
 */

import { describe, expect, it } from 'vitest';

import { GameRuleError } from '@/lib/game/errors';
import { DomainError } from '@/lib/server/errors';

class TradeError extends DomainError {}

describe('규칙 위반 예외', () => {
  it('DomainError 와 GameRuleError 는 같은 클래스다', () => {
    expect(DomainError).toBe(GameRuleError);
  });

  it('어느 쪽 래퍼로 잡아도 규칙 위반으로 인식된다', () => {
    const fromGame = new GameRuleError('진화 조건을 채우지 못했다');
    const fromServer = new DomainError('본인 소유의 개체가 아니다');

    expect(fromGame).toBeInstanceOf(DomainError);
    expect(fromServer).toBeInstanceOf(GameRuleError);
  });

  it('파생 클래스도 양쪽에서 잡힌다', () => {
    const e = new TradeError('이미 교환된 개체다');
    expect(e).toBeInstanceOf(GameRuleError);
    expect(e).toBeInstanceOf(DomainError);
  });
});
