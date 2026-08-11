"use client";

/**
 * 교환 씬 (설계 9장 · 17.4).
 *
 * 실제 교환 흐름은 C 가 만든 TradeOverlay 가 담당한다. 여기서는 서버에서
 * 내 성체 목록을 받아 넘겨주는 일만 한다.
 *
 * TradeScene(표시 전용 콘솔)은 교환 진행 상태를 보여주는 연출용이라
 * 실제 플로우와는 별개다. 두 개를 합치는 것은 후속 과제로 둔다.
 */

import { useEffect, useState } from "react";

import { TradeOverlay } from "@/components/trade/TradeOverlay";
import type { AdultPetsResponse, TradePetView } from "@/types/api";

function label(pet: TradePetView) {
  return `${pet.speciesName}${pet.isAlbino ? " (알비노)" : ""}`;
}

export default function TradeSceneContainer({ onClose }: { onClose?: () => void }) {
  const [pets, setPets] = useState<TradePetView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await fetch("/api/pet/adults");
      if (!mounted) return;
      setLoading(false);
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(body.error ?? "성체 목록을 불러오지 못했습니다.");
        return;
      }
      const body = (await res.json()) as AdultPetsResponse;
      setPets(body.pets);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <p className="p-6 text-center text-sm text-slate-400">불러오는 중…</p>;
  }

  if (error) {
    return <p className="p-6 text-center text-sm text-red-400">{error}</p>;
  }

  // 이미 교환한 개체는 다시 걸 수 없다 (개체당 1회 한정)
  const tradable = pets.filter((p) => !p.isTraded);

  if (tradable.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-slate-400">
        교환할 수 있는 성체가 없습니다. 3차 성체까지 키운 개체만 교환할 수 있고,
        한 번 교환한 개체는 다시 교환할 수 없습니다.
      </p>
    );
  }

  return (
    <div className="flex justify-center p-4">
      <TradeOverlay
        selectedPet={{ id: tradable[0].id, label: label(tradable[0]) }}
        myAdultPets={tradable.map((p) => ({ id: p.id, label: label(p) }))}
        onClose={onClose}
      />
    </div>
  );
}
