"use client";

/**
 * 도감 (설계 8장).
 *
 * 24칸은 서버가 순서대로 내려준다. 클라이언트가 목록을 직접 들고 있으면
 * 명세의 24종 매핑과 어긋난다. 실제로 초기 구현에는 호랑이가 조류로,
 * 해마가 두 번 들어가 있었다.
 *
 * 완성도는 hasNormal 이든 hasAlbino 든 하나만 있으면 채운 것으로 센다.
 * 알비노는 보유했을 때만 카드를 뒤집어 볼 수 있다.
 */

import { useEffect, useState } from "react";

import { adultSprite } from "@/lib/sprites";
import type { DexCell, DexResponse } from "@/types/api";
import { useMe } from "../MeContext";
import { dexFormKey, markDexFormsSeen, seedSeenDexFormsOnce } from "@/lib/client/dexSeen";

export default function DexScene() {
  const { me } = useMe();
  const [dex, setDex] = useState<DexResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showAlbino, setShowAlbino] = useState(false);
  const [seen, setSeen] = useState<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await fetch("/api/dex");
      if (!mounted) return;
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(body.error ?? "도감을 불러오지 못했습니다.");
        return;
      }
      setDex((await res.json()) as DexResponse);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // 닉네임과 도감 데이터가 모두 오면(최초 1회) 확인한 폼 목록을 저장소에서
  // 읽어온다. 이 계정에 baseline 기록이 아예 없으면(이 기능이 막 배포된
  // 직후) 지금 이미 보유한 폼을 전부 확인함으로 깔아, 예전부터 갖고 있던
  // 칸들이 한꺼번에 NEW 로 뜨는 걸 막는다.
  useEffect(() => {
    if (!me || !dex) return;
    const owned: string[] = [];
    for (const cell of dex.cells) {
      if (cell.hasNormal) owned.push(dexFormKey(cell.eggType, cell.combo, "normal"));
      if (cell.hasAlbino) owned.push(dexFormKey(cell.eggType, cell.combo, "albino"));
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeen(seedSeenDexFormsOnce(me.nickname, owned));
    // 닉네임 문자열 + dex 로만 재실행한다. me 객체 전체를 넣으면 다른 화면의
    // refresh() 로 me 참조가 바뀔 때마다(자원 변동 등) 불필요하게 재실행된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.nickname, dex]);

  const cells: DexCell[] = dex?.cells ?? [];
  const selected = selectedIndex === null ? null : (cells[selectedIndex] ?? null);
  const selectedHasAlbino = selected?.hasAlbino ?? false;

  /** 칸을 열람하면 지금 보유한 폼(들)을 전부 확인 처리한다 — 나중에 다시 봐도 NEW 가 뜨지 않는다 */
  const markSeen = (cell: DexCell) => {
    if (!me) return;
    const keys: string[] = [];
    if (cell.hasNormal) keys.push(dexFormKey(cell.eggType, cell.combo, "normal"));
    if (cell.hasAlbino) keys.push(dexFormKey(cell.eggType, cell.combo, "albino"));
    if (keys.length === 0) return;
    setSeen((current) => markDexFormsSeen(me.nickname, keys, current));
  };

  return (
    <div className="dex-book-bg">
      <div className="dex-book-shell">
        <div className="dex-book-cover-detail" aria-hidden="true" />
        <div className="dex-book-pages">
          <section className="dex-book-page dex-book-left-page">
            <div className="dex-book-title-card">
              <div className="dex-book-title-panel">
                <p className="dex-book-kicker">도감 완성도</p>
                <p className="dex-book-completion">
                  {error ? "—" : `${dex?.completed ?? 0} / ${dex?.total ?? 24}`}
                </p>
              </div>
            </div>
            <div className="dex-book-grid">
              {cells.map((cell, index) => {
                const acquired = cell.hasNormal || cell.hasAlbino;
                const isNewAlbino = cell.hasAlbino && !seen.has(dexFormKey(cell.eggType, cell.combo, "albino"));
                const isNewNormal = cell.hasNormal && !seen.has(dexFormKey(cell.eggType, cell.combo, "normal"));
                const isNew = isNewNormal || isNewAlbino;
                const cardClasses = [
                  "dex-book-slot",
                  acquired ? "dex-book-slot-acquired" : "dex-book-slot-locked",
                  index === selectedIndex ? "dex-book-slot-selected" : "",
                  cell.hasAlbino ? "dex-book-slot-albino" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <button
                    key={`${cell.eggType}-${cell.combo}`}
                    type="button"
                    className={cardClasses}
                    onClick={() => {
                      setSelectedIndex(index);
                      setShowAlbino(false);
                      markSeen(cell);
                    }}
                  >
                    <span className="dex-book-slot-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="dex-book-slot-image dex-dotted-paper">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={adultSprite(cell.eggType, cell.combo, false)}
                        alt={cell.name}
                        style={{ imageRendering: "pixelated" }}
                      />
                      {!acquired ? <div className="dex-book-slot-mask">???</div> : null}
                    </div>
                    <span className="dex-book-slot-name">{cell.name}</span>
                    {cell.hasAlbino ? (
                      <span className="dex-book-albino-mark" title="Albino acquired">
                        ✦
                      </span>
                    ) : null}
                    {isNew ? (
                      <span
                        className={`dex-book-new-mark ${isNewAlbino ? "dex-book-new-mark-gold" : ""}`}
                      >
                        NEW
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <span className="dex-book-page-number">01</span>
          </section>
          <div className="dex-book-spine" aria-hidden="true" />
          <section className="dex-book-page dex-book-right-page">
            <div className="dex-book-detail">
              <div className="dex-book-detail-heading">
                <div>
                  <p className="dex-book-kicker">선택한 항목</p>
                  <h2>{selected ? selected.name : error ?? "종을 선택하세요"}</h2>
                </div>
              </div>
              <div className="dex-book-portrait-wrap">
                <div className={`dex-book-portrait-frame ${selectedHasAlbino ? "dex-book-portrait-frame-albino" : ""}`}>
                  <div className="dex-book-portrait">
                    <div
                      className="dex-book-portrait-flip"
                      style={{ transform: showAlbino ? "rotateY(180deg)" : "rotateY(0deg)" }}
                    >
                    <div className="dex-book-portrait-face">
                      {selected ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={adultSprite(selected.eggType, selected.combo, false)}
                          alt={selected.name}
                          style={{ imageRendering: "pixelated" }}
                        />
                      ) : null}
                      {!selected?.hasNormal ? (
                        <div className="dex-book-portrait-mask">미발견</div>
                      ) : null}
                    </div>
                    <div className="dex-book-portrait-face dex-book-portrait-back">
                      {selected ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={adultSprite(selected.eggType, selected.combo, true)}
                          alt={`${selected.name} 알비노`}
                          style={{ imageRendering: "pixelated" }}
                        />
                      ) : null}
                      {!selectedHasAlbino ? (
                        <div className="dex-book-portrait-mask">알비노 미발견</div>
                      ) : null}
                    </div>
                    </div>
                  </div>
                </div>
                {selectedHasAlbino ? (
                  <button
                    type="button"
                    onClick={() => setShowAlbino((current) => !current)}
                    className={`dex-book-form-switch ${showAlbino ? "dex-book-form-switch-active" : ""}`}
                    aria-label={showAlbino ? "일반 모습으로 전환" : "알비노 모습으로 전환"}
                    title={showAlbino ? "일반 모습 보기" : "알비노 모습 보기"}
                  >
                    <span aria-hidden="true">↗</span>
                    <span aria-hidden="true">↙</span>
                  </button>
                ) : null}
              </div>
              <div className="dex-book-detail-copy">
                <p>발견한 종의 기본 모습과 희귀한 알비노 모습을 이 도감에서 확인할 수 있습니다.</p>
                <p>알비노는 보유 시에만 뒤집어서 확인할 수 있습니다.</p>
              </div>
            </div>
            <span className="dex-book-page-number">02</span>
          </section>
        </div>
        <div className="dex-book-bookmark" aria-hidden="true">
          DEX
        </div>
      </div>
    </div>
  );
}
