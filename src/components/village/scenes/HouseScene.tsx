"use client";

import { useEffect, useState } from "react";

const mockPet = {
  stageName: "Growth",
  stageIndex: 2,
  feedCount: 7,
  feedRequired: 10,
  isAlbino: false,
  traitCounts: { a: 3, b: 4, c: 0 },
};

const mockResources = {
  crop: 4,
  mineral: 2,
  seafood: 1,
};

export default function HouseScene() {
  const [selectedFeed, setSelectedFeed] = useState<"crop" | "mineral" | "seafood" | null>(null);

  useEffect(() => {
    if (!selectedFeed) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSelectedFeed(null);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [selectedFeed]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 text-slate-100">
      <section className="relative overflow-hidden rounded-[32px] border border-slate-700/80 bg-slate-950/95 shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('/sprites/house/bg.png')",
            imageRendering: "pixelated",
          }}
        />
        <div className="absolute inset-0 bg-slate-950/75" />

        <div className="relative space-y-6 p-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <div className="rounded-[28px] border border-slate-800/90 bg-slate-900/90 p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Stage · Progress</p>
              <p className="mt-3 text-2xl font-semibold text-slate-100">{mockPet.stageName}</p>
              <p className="mt-2 text-sm text-slate-400">{`${mockPet.feedCount} / ${mockPet.feedRequired}회`}</p>
            </div>
            <div className="rounded-[28px] border border-slate-800/90 bg-slate-900/90 p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Trait Counter</p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
                <span className="rounded-2xl border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-slate-100">a {mockPet.traitCounts.a}</span>
                <span className="rounded-2xl border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-slate-100">b {mockPet.traitCounts.b}</span>
                <span className="rounded-2xl border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-slate-100">c {mockPet.traitCounts.c}</span>
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-[34px] border border-amber-400/20 bg-slate-900/90 p-5 shadow-[0_0_0_12px_rgba(248,213,113,0.08)]">
            <div className="relative overflow-hidden rounded-[30px] border border-slate-800/90 bg-slate-950/90 p-4">
              <div className="mx-auto h-[260px] w-[260px] overflow-hidden rounded-[28px] border border-slate-700/80 bg-slate-900">
                <img
                  src="/sprites/house/pet.png"
                  alt="Pet Sprite"
                  className="h-full w-full object-contain image-rendering-pixelated"
                />
              </div>
              <div className="mt-4 rounded-3xl border border-slate-800/80 bg-slate-950/90 p-3 text-center text-sm text-slate-200">
                <p className="font-semibold text-amber-200">{mockPet.stageName}</p>
                <p className="text-slate-400">Pet and background art placeholder</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            <button
              type="button"
              className="relative h-20 w-20 rounded-[24px] border border-slate-700/90 bg-slate-900/90 p-2 transition hover:scale-105 hover:border-emerald-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setSelectedFeed("crop")}
              disabled={mockResources.crop <= 0}
              aria-label="Feed crop"
            >
              <img src="/sprites/house/crop.png" alt="Crop" className="h-full w-full rounded-[18px] object-cover" />
              <span className="absolute bottom-1 right-1 rounded-full bg-slate-950/90 px-2 py-1 text-[10px] text-slate-100">
                {mockResources.crop}
              </span>
            </button>
            <button
              type="button"
              className="relative h-20 w-20 rounded-[24px] border border-slate-700/90 bg-slate-900/90 p-2 transition hover:scale-105 hover:border-amber-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setSelectedFeed("mineral")}
              disabled={mockResources.mineral <= 0}
              aria-label="Feed mineral"
            >
              <img src="/sprites/house/mineral.png" alt="Mineral" className="h-full w-full rounded-[18px] object-cover" />
              <span className="absolute bottom-1 right-1 rounded-full bg-slate-950/90 px-2 py-1 text-[10px] text-slate-100">
                {mockResources.mineral}
              </span>
            </button>
            <button
              type="button"
              className="relative h-20 w-20 rounded-[24px] border border-slate-700/90 bg-slate-900/90 p-2 transition hover:scale-105 hover:border-sky-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setSelectedFeed("seafood")}
              disabled={mockResources.seafood <= 0}
              aria-label="Feed seafood"
            >
              <img src="/sprites/house/seafood.png" alt="Seafood" className="h-full w-full rounded-[18px] object-cover" />
              <span className="absolute bottom-1 right-1 rounded-full bg-slate-950/90 px-2 py-1 text-[10px] text-slate-100">
                {mockResources.seafood}
              </span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
