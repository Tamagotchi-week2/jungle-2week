'use client';

import { useState } from 'react';

import { TradeCreatePanel } from './TradeCreatePanel';
import { TradeJoinPanel } from './TradeJoinPanel';

interface TradeOverlayProps {
  /** 교환 코드를 발급할 때 걸 개체. 없으면 "발급" 탭을 숨긴다 */
  selectedPet?: { id: string; label: string };
  /** 참여할 때 내놓을 수 있는 성체 후보 */
  myAdultPets: { id: string; label: string }[];
  onClose?: () => void;
}

type Tab = 'create' | 'join';

export function TradeOverlay({ selectedPet, myAdultPets, onClose }: TradeOverlayProps) {
  const [tab, setTab] = useState<Tab>(selectedPet ? 'create' : 'join');

  return (
    <div className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">교환</h2>
        {onClose && (
          <button type="button" onClick={onClose} className="text-sm text-zinc-500">
            닫기
          </button>
        )}
      </div>
      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setTab('create')}
          disabled={!selectedPet}
          className={`px-3 py-2 text-sm ${tab === 'create' ? 'border-b-2 border-foreground font-medium' : 'text-zinc-500'} disabled:opacity-40`}
        >
          코드 발급
        </button>
        <button
          type="button"
          onClick={() => setTab('join')}
          className={`px-3 py-2 text-sm ${tab === 'join' ? 'border-b-2 border-foreground font-medium' : 'text-zinc-500'}`}
        >
          코드 입력
        </button>
      </div>
      {tab === 'create' && selectedPet && <TradeCreatePanel pet={selectedPet} />}
      {tab === 'join' && <TradeJoinPanel myAdultPets={myAdultPets} />}
    </div>
  );
}
