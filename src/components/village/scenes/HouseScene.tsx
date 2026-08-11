"use client";

/**
 * 집 — 육성 화면 (설계 17.2).
 *
 * 표시하는 것은 **단계 · 진행도 · 성향 카운터** 셋뿐이다. 배고픔·청결 같은
 * 스탯은 존재하지 않으며 만들지 않는다. 소비할 시스템이 없다.
 *
 * 성향 카운터를 그대로 노출하는 이유는, 목표 조합을 겨냥해 먹이려면 현재
 * 분포를 알아야 하기 때문이다. 숨기면 유저가 조합을 통제할 수 없다.
 */

import { useState } from "react";

import { useMe } from "../MeContext";
import { petSprite } from "@/lib/sprites";
import type { EggType, ResourceType } from "@/lib/game/types";
import type { EvolveResponse, FeedResponse, HatchResponse } from "@/types/api";

const STAGE_NAME = ["알", "유아기", "성장기", "성체"] as const;

const FEEDS: {
  type: ResourceType;
  label: string;
  trait: string;
  ring: string;
  icon: string;
}[] = [
  { type: "crop", label: "작물", trait: "a", ring: "hover:border-emerald-300", icon: "/sprites/house/crop.png" },
  { type: "mineral", label: "광물", trait: "b", ring: "hover:border-amber-300", icon: "/sprites/house/mineral.png" },
  { type: "seafood", label: "어패", trait: "c", ring: "hover:border-sky-300", icon: "/sprites/house/seafood.png" },
];

const EGG_LABEL: Record<EggType, string> = {
  air: "공",
  land: "육",
  sea: "해",
  gold: "금",
};

export default function HouseScene() {
  const { me, refresh } = useMe();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [spriteBroken, setSpriteBroken] = useState(false);

  const pet = me?.activePet ?? null;
  const resources = me?.resources ?? { crop: 0, mineral: 0, seafood: 0 };
  const eggs = me?.eggs ?? { air: 0, land: 0, sea: 0, gold: 0 };

  /** 서버 응답의 오류 메시지를 그대로 보여준다. 규칙 위반은 전부 400 으로 온다 */
  async function call<T>(path: string, body?: unknown): Promise<T | null> {
    setBusy(true);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const payload = await res.json();
      if (!res.ok) {
        setFeedback((payload as { error?: string }).error ?? "요청에 실패했습니다.");
        return null;
      }
      setFeedback(null);
      return payload as T;
    } finally {
      setBusy(false);
    }
  }

  async function hatch(eggType: EggType) {
    const result = await call<HatchResponse>("/api/pet/hatch", { eggType });
    if (result) {
      setFeedback(
        result.pet.isAlbino ? "알비노가 부화했습니다!" : "알이 부화했습니다.",
      );
      await refresh();
    }
  }

  async function feed(resourceType: ResourceType) {
    if (!pet) return;
    const result = await call<FeedResponse>("/api/pet/feed", {
      petId: pet.id,
      resourceType,
    });
    if (result) {
      await refresh();
      if (result.canEvolve) setFeedback("진화할 수 있습니다.");
    }
  }

  async function evolve() {
    if (!pet) return;
    const result = await call<EvolveResponse>("/api/pet/evolve", { petId: pet.id });
    if (result) {
      setFeedback(
        result.pet.speciesName
          ? `${result.pet.speciesName} 으로 진화했습니다!`
          : "진화했습니다.",
      );
      await refresh();
    }
  }

  const canEvolve =
    pet !== null &&
    pet.feedRequired !== null &&
    pet.feedCount >= pet.feedRequired;

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
        <div className="absolute inset-0 bg-slate-950/70" />

        <div className="relative space-y-6 p-6">
          {feedback ? (
            <p className="rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-center text-sm text-amber-100">
              {feedback}
            </p>
          ) : null}

          {pet === null ? (
            <div className="rounded-[28px] border border-slate-800/90 bg-slate-900/90 p-6 text-center">
              <p className="text-sm text-slate-400">
                육성 중인 개체가 없습니다. 알을 하나 부화시키세요.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                {(Object.keys(eggs) as EggType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    disabled={busy || eggs[type] <= 0}
                    onClick={() => hatch(type)}
                    className="rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {EGG_LABEL[type]} 알 · {eggs[type]}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                <div className="rounded-[28px] border border-slate-800/90 bg-slate-900/90 p-5">
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
                    Stage · Progress
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-slate-100">
                    {STAGE_NAME[pet.stage]}
                    {pet.isAlbino ? " · 알비노" : ""}
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    {pet.feedRequired === null
                      ? pet.speciesName ?? "완성"
                      : `${pet.feedCount} / ${pet.feedRequired}회`}
                  </p>
                </div>
                <div className="rounded-[28px] border border-slate-800/90 bg-slate-900/90 p-5">
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
                    Trait Counter
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
                    {(["a", "b", "c"] as const).map((t) => (
                      <span
                        key={t}
                        className="rounded-2xl border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-slate-100"
                      >
                        {t} {pet.traits[t]}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-[34px] border border-amber-400/20 bg-slate-900/90 p-5">
                <div className="mx-auto grid h-[260px] w-[260px] place-items-center overflow-hidden rounded-[28px] border border-slate-700/80 bg-slate-900">
                  {spriteBroken ? (
                    // 아직 준비되지 않은 단계 스프라이트가 있다(성장기 24장).
                    // 깨진 이미지 아이콘 대신 단계 이름을 보여준다.
                    <span className="text-sm text-slate-500">
                      {STAGE_NAME[pet.stage]} 스프라이트 준비 중
                    </span>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={petSprite(pet)}
                      alt={pet.speciesName ?? STAGE_NAME[pet.stage]}
                      className="h-full w-full object-contain"
                      style={{ imageRendering: "pixelated" }}
                      onError={() => setSpriteBroken(true)}
                    />
                  )}
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-4">
                {FEEDS.map((f) => (
                  <button
                    key={f.type}
                    type="button"
                    className={`relative h-24 w-24 rounded-[24px] border border-slate-700/90 bg-slate-900/90 p-2 transition hover:scale-105 ${f.ring} active:scale-95 disabled:cursor-not-allowed disabled:opacity-40`}
                    onClick={() => feed(f.type)}
                    disabled={busy || resources[f.type] <= 0 || canEvolve}
                    title={`${f.label} · 성향 ${f.trait}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={f.icon}
                      alt={f.label}
                      className="h-12 w-full object-contain"
                      style={{ imageRendering: "pixelated" }}
                    />
                    <span className="mt-1 block text-xs font-semibold">
                      {f.label} · {f.trait}
                    </span>
                    <span className="absolute bottom-1 right-2 rounded-full bg-slate-950/90 px-1.5 text-[10px] text-slate-200">
                      {resources[f.type]}
                    </span>
                  </button>
                ))}
              </div>

              {canEvolve ? (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={evolve}
                    disabled={busy}
                    className="rounded-2xl border border-amber-300 bg-amber-400/20 px-8 py-3 font-semibold text-amber-100 transition hover:bg-amber-400/30 disabled:opacity-50"
                  >
                    진화
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
