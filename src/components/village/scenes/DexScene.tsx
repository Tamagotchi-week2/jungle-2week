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
  { id: 1, eggType: "air", combo: "skyhatch", name: "오목눈이" },
  { id: 2, eggType: "air", combo: "nimbus", name: "닭" },
  { id: 3, eggType: "air", combo: "stormling", name: "펭귄" },
  { id: 4, eggType: "air", combo: "breezelet", name: "황조롱이" },
  { id: 5, eggType: "air", combo: "gustling", name: "대머리독수리" },
  { id: 6, eggType: "air", combo: "featherball", name: "호랑이" },
  { id: 7, eggType: "land", combo: "pebblebeast", name: "고양이" },
  { id: 8, eggType: "land", combo: "thornback", name: "개" },
  { id: 9, eggType: "land", combo: "furrow", name: "판다" },
  { id: 10, eggType: "land", combo: "boulderhoof", name: "코끼리" },
  { id: 11, eggType: "land", combo: "blazemaul", name: "멧돼지" },
  { id: 12, eggType: "land", combo: "verdash", name: "해마" },
  { id: 13, eggType: "sea", combo: "coralfin", name: "해마" },
  { id: 14, eggType: "sea", combo: "tidewalker", name: "해달" },
  { id: 15, eggType: "sea", combo: "shellspirit", name: "흰수염고래" },
  { id: 16, eggType: "sea", combo: "waveglow", name: "흰동가리" },
  { id: 17, eggType: "sea", combo: "currentail", name: "아귀" },
  { id: 18, eggType: "sea", combo: "sailshade", name: "킹크랩" },
  { id: 19, eggType: "gold", combo: "aurorix", name: "공작" },
  { id: 20, eggType: "gold", combo: "glimmerclaw", name: "돌고래" },
  { id: 21, eggType: "gold", combo: "dawnflare", name: "티라노" },
  { id: 22, eggType: "gold", combo: "goldenveil", name: "용" },
  { id: 23, eggType: "gold", combo: "lustrous", name: "유니콘" },
  { id: 24, eggType: "gold", combo: "radiant", name: "구미호" },
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
    <div className="dex-book-bg">
      <div className="dex-book-shell">
        <div className="dex-book-cover-detail" aria-hidden="true" />
        <div className="dex-book-pages">
          <section className="dex-book-page dex-book-left-page">
            <div className="dex-book-title-card">
              <div className="dex-book-title-panel"><p className="dex-book-kicker">도감 완성도</p><p className="dex-book-completion">{`${completionCount} / ${DEX_SPECIES.length}`}</p></div>
            </div>
            <div className="dex-book-grid">
              {DEX_SPECIES.map((species) => {
                const entry = entries.find((item) => item.speciesId === species.id) ?? { has_normal: false, has_albino: false };
                const acquired = entry.has_normal || entry.has_albino;
                const hasAlbino = entry.has_albino;
                const cardClasses = ["dex-book-slot", acquired ? "dex-book-slot-acquired" : "dex-book-slot-locked", species.id === selectedSpeciesId ? "dex-book-slot-selected" : "", hasAlbino ? "dex-book-slot-albino" : ""].filter(Boolean).join(" ");
                return <button key={species.id} type="button" className={cardClasses} onClick={() => { setSelectedSpeciesId(species.id); setShowAlbino(false); }}>
                  <span className="dex-book-slot-number">{String(species.id).padStart(2, "0")}</span><div className="dex-book-slot-image dex-dotted-paper"><img src={`/sprites/adult/${species.eggType}_${species.combo}.png`} alt={species.name} style={{ imageRendering: "pixelated" }} />{!acquired ? <div className="dex-book-slot-mask">???</div> : null}</div><span className="dex-book-slot-name">{species.name}</span>{hasAlbino ? <span className="dex-book-albino-mark" title="Albino acquired">✦</span> : null}
                </button>;
              })}
            </div><span className="dex-book-page-number">01</span>
          </section>
          <div className="dex-book-spine" aria-hidden="true" />
          <section className="dex-book-page dex-book-right-page">
            <div className="dex-book-detail">
              <div className="dex-book-detail-heading"><div><p className="dex-book-kicker">Selected entry</p><h2>{selectedSpecies ? selectedSpecies.name : "Select a species"}</h2></div></div>
              <div className="dex-book-portrait-frame"><div className="dex-book-portrait"><div className="dex-book-portrait-flip" style={{ transform: showAlbino ? "rotateY(180deg)" : "rotateY(0deg)" }}><div className="dex-book-portrait-face"><img src={selectedSpecies ? `/sprites/adult/${selectedSpecies.eggType}_${selectedSpecies.combo}.png` : "/sprites/adult/air_skyhatch.png"} alt={selectedSpecies?.name ?? "Dex Preview"} style={{ imageRendering: "pixelated" }} />{!selectedEntry?.has_normal ? <div className="dex-book-portrait-mask">Unknown</div> : null}</div><div className="dex-book-portrait-face dex-book-portrait-back"><img src={selectedSpecies ? `/sprites/adult/${selectedSpecies.eggType}_${selectedSpecies.combo}_albino.png` : "/sprites/adult/air_skyhatch_albino.png"} alt={selectedSpecies ? `${selectedSpecies.name} Albino` : "Albino Preview"} style={{ imageRendering: "pixelated" }} />{!selectedHasAlbino ? <div className="dex-book-portrait-mask">Albino unavailable</div> : null}</div></div></div></div>
              <div className="dex-book-detail-copy"><p>발견한 종의 기본 모습과 희귀한 알비노 모습을 이 도감에서 확인할 수 있습니다.</p><p>알비노는 보유 시에만 뒤집어서 확인할 수 있습니다.</p></div>
              <button type="button" disabled={!selectedHasAlbino} onClick={() => setShowAlbino((current) => !current)} className="dex-book-albino-button">알비노 보기</button>
            </div><span className="dex-book-page-number">02</span>
          </section>
        </div>
        <div className="dex-book-bookmark" aria-hidden="true">DEX</div>
      </div>
    </div>
  );
}
