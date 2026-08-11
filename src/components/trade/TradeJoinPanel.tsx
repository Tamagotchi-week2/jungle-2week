'use client';

import { useState } from 'react';

import { joinTrade } from '@/lib/client/trade';
import type { TradeJoinResponse } from '@/types/api';

interface TradeJoinPanelProps {
  /** 상대에게 내놓을 수 있는 내 3차 성체 목록. 목록 조회는 이 트랙의 책임 범위가 아니므로 상위에서 넘겨준다 */
  myAdultPets: { id: string; label: string }[];
  onJoined?: (result: TradeJoinResponse) => void;
}

export function TradeJoinPanel({ myAdultPets, onJoined }: TradeJoinPanelProps) {
  const [code, setCode] = useState('');
  const [petId, setPetId] = useState(myAdultPets[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TradeJoinResponse | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!code || !petId) return;

    setBusy(true);
    setError(null);
    try {
      const joined = await joinTrade({ code: code.trim().toUpperCase(), petId });
      setResult(joined);
      onJoined?.(joined);
    } catch (err) {
      setError(err instanceof Error ? err.message : '참여에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          제안자에게 전달되었습니다. 상대의 최종 수락을 기다려 주세요.
        </p>
        <div className="flex justify-between gap-4 text-sm">
          <div>
            <p className="font-medium">내가 내놓은 개체</p>
            <p>{result.myPet.speciesName}{result.myPet.isAlbino ? ' (알비노)' : ''}</p>
          </div>
          <div>
            <p className="font-medium">받게 될 개체</p>
            <p>{result.theirPet.speciesName}{result.theirPet.isAlbino ? ' (알비노)' : ''}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="trade-code" className="text-sm font-medium">
          교환 코드
        </label>
        <input
          id="trade-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={6}
          className="rounded border border-zinc-300 px-3 py-2 font-mono uppercase tracking-widest dark:border-zinc-700 dark:bg-zinc-900"
          required
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="trade-pet" className="text-sm font-medium">
          내놓을 개체
        </label>
        <select
          id="trade-pet"
          value={petId}
          onChange={(e) => setPetId(e.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          required
        >
          {myAdultPets.length === 0 && <option value="">교환 가능한 성체가 없습니다</option>}
          {myAdultPets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy || myAdultPets.length === 0}
        className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
      >
        {busy ? '참여 중...' : '참여하기'}
      </button>
    </form>
  );
}
