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

export default function DexScene() {
  const [dex, setDex] = useState<DexResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showAlbino, setShowAlbino] = useState(false);

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

  const cells: DexCell[] = dex?.cells ?? [];
  const selected = selectedIndex === null ? null : (cells[selectedIndex] ?? null);
  const selectedHasAlbino = selected?.hasAlbino ?? false;

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
