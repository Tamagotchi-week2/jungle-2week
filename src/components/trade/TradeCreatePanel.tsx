'use client';

import { useEffect, useRef, useState } from 'react';

import { createTrade, getTradeStatus, resolveTrade, type TradeStatusView } from '@/lib/client/trade';
import TradeScene from '@/components/village/scenes/TradeScene';
import type { TradePetView } from '@/types/api';

const POLL_INTERVAL_MS = 3000;

interface TradeCreatePanelProps {
  /** 교환에 걸 내 3차 성체. 목록 조회는 이 트랙의 책임 범위가 아니므로 상위에서 골라 넘겨준다 */
  pet: { id: string; label: string };
  onTraded?: (received: TradePetView) => void;
}

type Phase = 'idle' | 'waiting' | 'joined' | 'done';

export function TradeCreatePanel({ pet, onTraded }: TradeCreatePanelProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<TradeStatusView | null>(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      const created = await createTrade({ petId: pet.id });
      setStatus({
        tradeId: '',
        status: 'proposed',
        code: created.code,
        expiresAt: created.expiresAt,
        myPet: created.myPet,
        theirPet: null,
      });
      setPhase('waiting');

      pollRef.current = setInterval(async () => {
        try {
          const latest = await getTradeStatus(created.code);
          setStatus(latest);
          if (latest.status === 'joined') {
            setPhase('joined');
            if (pollRef.current) clearInterval(pollRef.current);
          } else if (latest.status !== 'proposed') {
            setPhase('done');
            if (pollRef.current) clearInterval(pollRef.current);
          }
        } catch {
          // 일시적 폴링 실패는 무시하고 다음 주기에 재시도한다
        }
      }, POLL_INTERVAL_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : '코드 발급에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function handleResolve(accept: boolean) {
    if (!status?.tradeId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await resolveTrade({ tradeId: status.tradeId, accept });
      setPhase('done');
      if (result.status === 'accepted' && result.received) {
        onTraded?.(result.received);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '처리에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  if (phase === 'idle') {
    return (
      <div className="flex flex-col gap-3">
        <p>
          <span className="font-medium">{pet.label}</span> 을(를) 교환에 걸까요?
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="button"
          onClick={handleCreate}
          disabled={busy}
          className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
        >
          {busy ? '발급 중...' : '교환 코드 발급'}
        </button>
      </div>
    );
  }

  if (phase === 'waiting') {
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          상대에게 아래 코드를 알려주세요. 10분간 유효합니다.
        </p>
        <p className="text-3xl font-mono font-bold tracking-widest">{status?.code}</p>
        {/* B 의 교환 콘솔. 상대 슬롯은 참여 전까지 비어 있다 */}
        <TradeScene myPet={status?.myPet ?? null} theirPet={null} status="trading" />
        <p className="text-sm text-zinc-500">상대의 참여를 기다리는 중...</p>
      </div>
    );
  }

  if (phase === 'joined' && status?.theirPet) {
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          상대가 참여했습니다. 최종 확인해 주세요.
        </p>
        {/* 콘솔의 교환하기/취소를 실제 수락·거절에 연결한다 */}
        <TradeScene
          myPet={status.myPet}
          theirPet={status.theirPet}
          status={busy ? 'trading' : 'idle'}
          onConfirm={() => handleResolve(true)}
          onCancel={() => handleResolve(false)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="flex flex-col items-center gap-3">
        <TradeScene
          myPet={status?.theirPet ?? null}
          theirPet={status?.myPet ?? null}
          status="completed"
        />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">교환이 완료되었습니다.</p>
      </div>
    );
  }

  return <p className="text-sm text-zinc-600 dark:text-zinc-400">교환이 종료되었습니다.</p>;
}
