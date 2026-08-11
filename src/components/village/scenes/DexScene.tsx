"use client";

import { useEffect, useMemo, useState } from "react";

type EggType = "air" | "land" | "sea" | "gold";

type DexSpecies = {
  id: number;
  eggType: EggType;
  combo: string;
  name: string;
};

type DexEntry = {
  speciesId: number;
  has_normal: boolean;
  has_albino: boolean;
};

const DEX_SPECIES: DexSpecies[] = [
  { id: 1, eggType: "air", combo: "skyhatch", name: "Sky Hatch" },
  { id: 2, eggType: "air", combo: "nimbus", name: "Nimbus" },
  { id: 3, eggType: "air", combo: "stormling", name: "Stormling" },
  { id: 4, eggType: "air", combo: "breezelet", name: "Breezelet" },
  { id: 5, eggType: "air", combo: "gustling", name: "Gustling" },
  { id: 6, eggType: "air", combo: "featherball", name: "Featherball" },
  { id: 7, eggType: "land", combo: "pebblebeast", name: "Pebble Beast" },
  { id: 8, eggType: "land", combo: "thornback", name: "Thornback" },
  { id: 9, eggType: "land", combo: "furrow", name: "Furrow" },
  { id: 10, eggType: "land", combo: "boulderhoof", name: "Boulder Hoof" },
  { id: 11, eggType: "land", combo: "blazemaul", name: "Blaze Maul" },
  { id: 12, eggType: "land", combo: "verdash", name: "Verdash" },
  { id: 13, eggType: "sea", combo: "coralfin", name: "Coral Fin" },
  { id: 14, eggType: "sea", combo: "tidewalker", name: "Tide Walker" },
  { id: 15, eggType: "sea", combo: "shellspirit", name: "Shell Spirit" },
  { id: 16, eggType: "sea", combo: "waveglow", name: "Wave Glow" },
  { id: 17, eggType: "sea", combo: "currentail", name: "Currentail" },
  { id: 18, eggType: "sea", combo: "sailshade", name: "Sail Shade" },
  { id: 19, eggType: "gold", combo: "aurorix", name: "Aurorix" },
  { id: 20, eggType: "gold", combo: "glimmerclaw", name: "Glimmer Claw" },
  { id: 21, eggType: "gold", combo: "dawnflare", name: "Dawn Flare" },
  { id: 22, eggType: "gold", combo: "goldenveil", name: "Golden Veil" },
  { id: 23, eggType: "gold", combo: "lustrous", name: "Lustrous" },
  { id: 24, eggType: "gold", combo: "radiant", name: "Radiant" },
];

const MOCK_DEX_ENTRIES: DexEntry[] = [
  { speciesId: 1, has_normal: true, has_albino: false },
  { speciesId: 2, has_normal: true, has_albino: true },
  { speciesId: 3, has_normal: false, has_albino: false },
  { speciesId: 4, has_normal: true, has_albino: false },
  { speciesId: 5, has_normal: true, has_albino: false },
  { speciesId: 6, has_normal: false, has_albino: false },
  { speciesId: 7, has_normal: true, has_albino: true },
  { speciesId: 8, has_normal: true, has_albino: false },
  { speciesId: 9, has_normal: true, has_albino: false },
  { speciesId: 10, has_normal: false, has_albino: false },
  { speciesId: 11, has_normal: true, has_albino: false },
  { speciesId: 12, has_normal: false, has_albino: false },
  { speciesId: 13, has_normal: true, has_albino: false },
  { speciesId: 14, has_normal: false, has_albino: false },
  { speciesId: 15, has_normal: true, has_albino: true },
  { speciesId: 16, has_normal: true, has_albino: false },
  { speciesId: 17, has_normal: false, has_albino: false },
  { speciesId: 18, has_normal: false, has_albino: false },
  { speciesId: 19, has_normal: true, has_albino: false },
  { speciesId: 20, has_normal: true, has_albino: true },
  { speciesId: 21, has_normal: true, has_albino: false },
  { speciesId: 22, has_normal: false, has_albino: false },
  { speciesId: 23, has_normal: false, has_albino: false },
  { speciesId: 24, has_normal: true, has_albino: false },
];

function fetchDexEntries(): Promise<DexEntry[]> {
  return Promise.resolve(MOCK_DEX_ENTRIES);
}

export default function DexScene() {
  const [entries, setEntries] = useState<DexEntry[]>([]);
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<number | null>(null);
  const [showAlbino, setShowAlbino] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchDexEntries().then((result) => {
      if (mounted) {
        setEntries(result);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const speciesById = useMemo(
    () => Object.fromEntries(DEX_SPECIES.map((item) => [item.id, item])) as Record<number, DexSpecies>,
    [],
  );

  const selectedSpecies = selectedSpeciesId ? speciesById[selectedSpeciesId] : null;
  const selectedEntry = selectedSpeciesId ? entries.find((item) => item.speciesId === selectedSpeciesId) ?? null : null;
  const completionCount = entries.filter((item) => item.has_normal || item.has_albino).length;
  const selectedHasAlbino = selectedEntry?.has_albino ?? false;

  return (
    <div className="text-slate-100">
      <div className="mb-6 flex flex-col gap-4 rounded-[28px] border border-slate-700/80 bg-slate-900/90 p-5 shadow-inner shadow-black/20 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Dex Completion</p>
          <p className="mt-2 text-3xl font-semibold text-amber-300">{`${completionCount} / ${DEX_SPECIES.length}`}</p>
        </div>
        <div className="rounded-3xl border border-slate-700/80 bg-slate-950/80 px-4 py-3 text-sm text-slate-300">
          <p className="uppercase tracking-[0.35em] text-slate-500">Egg groups</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-300 sm:grid-cols-4">
            <span>Air 1-2</span>
            <span>Land 3-4</span>
            <span>Sea 5-6</span>
            <span>Gold 7-8</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="grid grid-cols-3 gap-4">
          {DEX_SPECIES.map((species) => {
            const entry = entries.find((item) => item.speciesId === species.id) ?? { has_normal: false, has_albino: false };
            const acquired = entry.has_normal || entry.has_albino;
            const hasAlbino = entry.has_albino;
            const cardClasses = [
              "relative overflow-hidden rounded-[22px] border p-3 text-left transition",
              acquired ? "border-slate-600 bg-slate-950/90 hover:border-amber-300" : "border-slate-800 bg-slate-900/80 text-slate-500",
              hasAlbino ? "border-amber-400/90 shadow-[0_0_0_1px_rgba(245,158,11,0.3)]" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <button
                key={species.id}
                type="button"
                className={cardClasses}
                onClick={() => {
                  setSelectedSpeciesId(species.id);
                  setShowAlbino(false);
                }}
              >
                <div className="mb-3 aspect-square overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                  <img
                    src={`/sprites/adult/${species.eggType}_${species.combo}.png`}
                    alt={species.name}
                    style={{ imageRendering: "pixelated" }}
                    className="h-full w-full object-cover"
                  />
                  {!acquired ? (
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-slate-950/90 text-center text-xs uppercase tracking-[0.35em] text-slate-500">
                      ???
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="block truncate text-sm font-semibold text-slate-100">{species.name}</span>
                  {hasAlbino ? (
                    <span className="rounded-full bg-amber-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.35em] text-amber-200">Albino</span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>

        <div className="space-y-4 rounded-[28px] border border-slate-700/80 bg-slate-900/90 p-5 shadow-inner shadow-black/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Selected</p>
              <p className="mt-2 text-xl font-semibold text-slate-100">
                {selectedSpecies ? selectedSpecies.name : "Select a species"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-xs uppercase tracking-[0.35em] text-slate-300">
              {selectedSpecies ? selectedSpecies.eggType : "--"}
            </div>
          </div>

          <div className="mx-auto w-full max-w-[320px] rounded-[26px] border border-slate-800 bg-slate-950/90 p-4">
            <div className="relative mx-auto h-[280px] w-full max-w-[280px] perspective-[1000px]">
              <div
                className="relative h-full w-full"
                style={{ transformStyle: "preserve-3d", transition: "transform 0.7s", transform: showAlbino ? "rotateY(180deg)" : "rotateY(0deg)" }}
              >
                <div
                  className="absolute inset-0"
                  style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
                >
                  <img
                    src={
                      selectedSpecies
                        ? `/sprites/adult/${selectedSpecies.eggType}_${selectedSpecies.combo}.png`
                        : "/sprites/adult/air_skyhatch.png"
                    }
                    alt={selectedSpecies?.name ?? "Dex Preview"}
                    style={{ imageRendering: "pixelated" }}
                    className="h-full w-full rounded-[22px] object-cover"
                  />
                  {!selectedEntry?.has_normal ? (
                    <div className="absolute inset-0 flex items-center justify-center rounded-[22px] bg-slate-950/90 text-center text-sm uppercase tracking-[0.35em] text-slate-500">
                      Unknown
                    </div>
                  ) : null}
                </div>

                <div
                  className="absolute inset-0"
                  style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                >
                  <img
                    src={
                      selectedSpecies
                        ? `/sprites/adult/${selectedSpecies.eggType}_${selectedSpecies.combo}_albino.png`
                        : "/sprites/adult/air_skyhatch_albino.png"
                    }
                    alt={selectedSpecies ? `${selectedSpecies.name} Albino` : "Albino Preview"}
                    style={{ imageRendering: "pixelated" }}
                    className="h-full w-full rounded-[22px] object-cover"
                  />
                  {!selectedHasAlbino ? (
                    <div className="absolute inset-0 flex items-center justify-center rounded-[22px] bg-slate-950/90 text-center text-sm uppercase tracking-[0.35em] text-slate-500">
                      Albino unavailable
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              disabled={!selectedHasAlbino}
              onClick={() => setShowAlbino((current) => !current)}
              className="inline-flex w-full items-center justify-center rounded-full border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-amber-100 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              알비노 보기
            </button>
            <p className="text-xs text-slate-400">
              알비노는 보유 시에만 뒤집어서 확인할 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
