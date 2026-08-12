'use client';

/**
 * 보상 알 수령 화면 (설계 문서 6장).
 *
 * 핵심은 **결과와 무관하게 선택 화면이 항상 동일하다**는 것이다.
 * 금색 판정이어도 선택을 건너뛰지 않는다. 화면이 달라지면 고르기 전에 결과가
 * 노출되어 변신 연출이 무의미해진다.
 *
 * 판정 결과는 claim 응답에서 처음 도착한다. open 응답에는 들어 있지 않다.
 */

import { useCallback, useEffect, useState } from 'react';

import { eggSprite } from '@/lib/sprites';
import type { EggType } from '@/lib/game/types';
import type { RewardClaimResponse, RewardOpenResponse } from '@/types/api';

const EGG_LABEL: Record<EggType, string> = {
  air: '공 · 조류',
  land: '육 · 육상',
  sea: '해 · 해상',
  gold: '금 · 금색',
};

/** 스프라이트가 아직 없어도 화면이 성립하도록 색으로 대체한다 */
const EGG_TINT: Record<EggType, string> = {
  air: 'bg-sky-200',
  land: 'bg-amber-200',
  sea: 'bg-teal-200',
  gold: 'bg-yellow-300',
};

type Phase = 'loading' | 'choosing' | 'revealing' | 'done' | 'error';

export default function RewardPage() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [choices, setChoices] = useState<EggType[]>([]);
  const [picked, setPicked] = useState<EggType | null>(null);
  const [result, setResult] = useState<RewardClaimResponse | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/egg/reward/open', { method: 'POST' });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setMessage(body.error ?? '보상 알을 열 수 없다');
        setPhase('error');
        return;
      }
      const body = (await res.json()) as RewardOpenResponse;
      setChoices(body.choices);
      setPhase('choosing');
    })();
  }, []);

  const choose = useCallback(
    async (chosen: EggType) => {
      if (phase !== 'choosing') return;
      setPicked(chosen);
      setPhase('revealing');

      const res = await fetch('/api/egg/reward/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chosen }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setMessage(body.error ?? '수령에 실패했다');
        setPhase('error');
        return;
      }

      const body = (await res.json()) as RewardClaimResponse;
      // 변신 연출을 눈으로 확인할 시간을 준다
      setTimeout(() => {
        setResult(body);
        setPhase('done');
      }, 900);
    },
    [phase],
  );

  if (phase === 'loading') {
    return <Centered>여는 중…</Centered>;
  }

  if (phase === 'error') {
    return (
      <Centered>
        <p className="text-red-600">{message}</p>
        <a href="/game" className="mt-6 underline">
          마을로 돌아가기
        </a>
      </Centered>
    );
  }

  const revealed = phase === 'done' && result;
  const shownType: EggType | null = revealed ? result.granted : picked;

  return (
    <Centered>
      <h1 className="text-2xl font-bold">보상 알</h1>
      <p className="mt-2 text-sm text-zinc-500">
        {phase === 'choosing'
          ? '알을 하나 고르세요'
          : revealed
            ? result.transformed
              ? '알이 금빛으로 변했다!'
              : '알을 받았다'
            : '…'}
      </p>

      {phase === 'choosing' ? (
        <div className="mt-10 flex gap-8">
          {choices.map((type) => (
            <button
              key={type}
              onClick={() => choose(type)}
              className="flex flex-col items-center gap-3 transition hover:scale-105"
            >
              <Egg type={type} />
              <span className="text-sm">{EGG_LABEL[type]}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-10 flex flex-col items-center gap-3">
          <Egg type={shownType ?? 'air'} transformed={revealed ? result.transformed : false} />
          <span className="text-sm">{shownType ? EGG_LABEL[shownType] : ''}</span>
        </div>
      )}

      {revealed && (
        <a
          href="/game"
          className="mt-10 rounded bg-zinc-900 px-6 py-2 text-white"
        >
          마을로 돌아가기
        </a>
      )}
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      {children}
    </main>
  );
}

/**
 * 알 하나.
 *
 * 스프라이트 파일이 준비되면 자동으로 교체된다. 아직 없으면 img 가 실패하고
 * 배경색만 남으므로, 아트를 기다리지 않고 화면을 완성할 수 있다.
 */
function Egg({
  type,
  transformed = false,
}: {
  type: EggType;
  transformed?: boolean;
}) {
  const [hasSprite, setHasSprite] = useState(true);

  return (
    <div
      className={[
        'relative h-32 w-24 overflow-hidden border-2 border-zinc-800',
        'rounded-[50%_50%_50%_50%/60%_60%_40%_40%]',
        EGG_TINT[type],
        transformed ? 'animate-pulse ring-4 ring-yellow-400' : '',
      ].join(' ')}
      style={{ imageRendering: 'pixelated' }}
    >
      {hasSprite && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={eggSprite(type)}
          alt=""
          className="h-full w-full object-contain"
          onError={() => setHasSprite(false)}
          draggable={false}
        />
      )}
    </div>
  );
}
