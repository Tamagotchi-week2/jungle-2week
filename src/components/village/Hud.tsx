"use client";

import type { VillageScene } from "./types";

interface HudProps {
  resources: { crop: number; mineral: number; seafood: number };
  eggs: { air: number; land: number; sea: number; gold: number };
  /** 아직 수령하지 않은 보상 알 수. 0 보다 크면 수령 진입점을 띄운다 (설계 6장) */
  unclaimedRewards: number;
  onOpenScene(scene: VillageScene): void;
}

export default function Hud({
  resources,
  eggs,
  unclaimedRewards,
  onOpenScene,
}: HudProps) {
  return (
    <div className="shrink-0 z-40 border-b border-slate-700/80 bg-slate-950/95 px-4 py-3 backdrop-blur-md">
      <div className="mx-auto flex max-w-none items-center justify-between gap-4">
        <div className="flex items-center gap-6 text-sm text-slate-300">
          <div className="flex items-center gap-3">
            <span className="text-slate-500 uppercase tracking-[0.25em] text-xs">Resources</span>
            <div className="flex gap-4 font-mono text-slate-100">
              <span>🌱 {resources.crop}</span>
              <span>🪨 {resources.mineral}</span>
              <span>🐟 {resources.seafood}</span>
            </div>
          </div>

          <div className="w-px h-6 bg-slate-700/40" />

          <div className="flex items-center gap-3">
            <span className="text-slate-500 uppercase tracking-[0.25em] text-xs">Eggs</span>
            <div className="flex gap-3 font-mono text-xs text-slate-100">
              <span>⬆️ {eggs.air}</span>
              <span>⬇️ {eggs.land}</span>
              <span>🌊 {eggs.sea}</span>
              <span>⭐ {eggs.gold}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unclaimedRewards > 0 ? (
            // 성체를 완성하면 보상 알이 쌓인다. 진입점이 없으면 받을 방법이 없다.
            <a
              href="/reward"
              className="animate-pulse rounded-2xl border border-amber-300 bg-amber-400/20 px-3 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/30"
            >
              🥚 보상 알 {unclaimedRewards}
            </a>
          ) : null}
          <button
            type="button"
            className="rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-xs text-slate-200 transition hover:bg-slate-800 hover:border-emerald-300"
            onClick={() => onOpenScene("dex")}
          >
            📚 Dex
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-xs text-slate-200 transition hover:bg-slate-800 hover:border-sky-300"
            onClick={() => onOpenScene("trade")}
          >
            💱 Trade
          </button>
        </div>
      </div>
    </div>
  );
}
