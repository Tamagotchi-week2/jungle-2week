"use client";

/**
 * 집 — 육성 화면 (설계 17.2).
 *
 * 표시하는 것은 **단계 · 진행도 · 성향 카운터** 셋뿐이다. 배고픔·청결 같은
 * 스탯은 존재하지 않으며 만들지 않는다. 소비할 시스템이 없다.
 *
 * 성향 카운터를 그대로 노출하는 이유는, 목표 조합을 겨냥해 먹이려면 현재
 * 분포를 알아야 하기 때문이다. 숨기면 유저가 조합을 통제할 수 없다.
 *
 * 중요: `/api/me` 의 activePet 은 stage < 3(육성 중)인 개체만 담는다. 성체가
 * 되는 순간 activePet 은 다시 null 로 돌아간다 — "성체 표시"를 activePet 에서
 * 파생시키면 새로고침 즉시 사라진다. 그래서 마지막으로 완성한 성체는 별도로
 * (evolve 응답에서 즉시, 또는 /api/pet/adults 에서) 받아 lastAdultPet 에 둔다.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { useMe } from "../MeContext";
import Modal from "@/components/ui/Modal";
import { eggSprite, FINAL_GROWTH_STAGE, petSprite } from "@/lib/sprites";
import type { Combo, EggType, ResourceType, Trait } from "@/lib/game/types";
import type {
  AdultPetsResponse,
  EvolveResponse,
  FeedResponse,
  HatchResponse,
  RewardClaimResponse,
  RewardOpenResponse,
} from "@/types/api";

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

/** 화면에 성체를 그리는 데 필요한 최소 정보. activePet(PetView)·adults(TradePetView) 양쪽에서 만들 수 있다 */
interface AdultDisplayPet {
  eggType: EggType;
  isAlbino: boolean;
  combo: Combo;
  speciesName: string | null;
}

/** 드래그 중인 대상. 밥(자원)과 알 보상(EggType)은 서로 다른 타입이라 종류를 함께 들고 다닌다 */
type DragPayload = { kind: "feed"; type: ResourceType } | { kind: "reward"; type: EggType };

export default function HouseScene() {
  const { me, refresh } = useMe();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  /**
   * 불러오지 못한 스프라이트 경로. boolean 으로 두면 한 번 실패한 뒤 되돌아오지
   * 못해, 진화해서 멀쩡한 그림이 생겨도 계속 텍스트만 나온다.
   */
  const [brokenSprite, setBrokenSprite] = useState<string | null>(null);

  // 가장 최근에 완성한 성체. activePet 이 null 이어도 이 값이 있으면 표시 박스에
  // 성체를 계속 보여준다. 마운트 시 /api/pet/adults 로 채우고, 방금 진화했다면
  // evolve() 응답으로 즉시 갱신한다 (다음 새로고침을 기다릴 필요가 없다).
  const [lastAdultPet, setLastAdultPet] = useState<AdultDisplayPet | null>(null);

  // 드래그 앤 드롭 상태. 밥 주기·알 보상 선택 둘 다 이 하나로 처리한다 — 둘은
  // 동시에 뜨지 않으므로(육성 중이면 밥, 성체 완료 상태면 보상) 종류(kind)만
  // 함께 들고 다니면 같은 포인터/터치 로직을 재사용할 수 있다.
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [touchPoint, setTouchPoint] = useState<{ x: number; y: number } | null>(null);
  const portraitRef = useRef<HTMLDivElement | null>(null);

  // 알 보상 선택 상태. choices 는 /open 이 내려준 선택지, selected 는 아직
  // 서버에 보내지 않은 하이라이트된 선택(로컬 저장)이다.
  const [rewardChoices, setRewardChoices] = useState<EggType[] | null>(null);
  const [selectedReward, setSelectedReward] = useState<EggType | null>(null);

  // 최종 성장 단계에 막 도달했을 때만 짧게 연출한다.
  const [celebrating, setCelebrating] = useState(false);

  const pet = me?.activePet ?? null;
  const resources = me?.resources ?? { crop: 0, mineral: 0, seafood: 0 };
  const eggs = me?.eggs ?? { air: 0, land: 0, sea: 0, gold: 0 };
  const unclaimedRewards = me?.unclaimedRewards ?? 0;

  /**
   * 지금 "육성 중"이 아니고(activePet 없음) 받을 보상이 있는 상태.
   * 이 상태에서만 하단이 알 보상 선택 UI 로 바뀌고, 상단 HUD 의 보상 링크는
   * 숨는다(Hud.tsx 의 hasActivePet 이 같은 조건을 반대로 판단한다).
   */
  const isFinalStage = pet === null && unclaimedRewards > 0;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/pet/adults");
      if (cancelled || !res.ok) return;
      const body = (await res.json()) as AdultPetsResponse;
      const latest = body.pets[body.pets.length - 1];
      if (!cancelled && latest) {
        setLastAdultPet({
          eggType: latest.eggType,
          isAlbino: latest.isAlbino,
          combo: latest.combo,
          speciesName: latest.speciesName,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** 서버 응답의 오류 메시지를 그대로 보여준다. 규칙 위반은 전부 400 으로 온다 */
  const call = useCallback(async function call<T>(path: string, body?: unknown): Promise<T | null> {
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
  }, []);

  const openRewardChoices = useCallback(async () => {
    const result = await call<RewardOpenResponse>("/api/egg/reward/open");
    if (result) setRewardChoices(result.choices);
  }, [call]);

  useEffect(() => {
    if (isFinalStage && rewardChoices === null) {
      // isFinalStage 로 막 들어섰을 때만 선택지를 연다(idempotent — 이미 굴려둔
      // 판정이 있으면 서버가 다시 굴리지 않고 같은 선택지를 돌려준다). setState 는
      // fetch 의 await 이후에만 일어나므로 실제 연쇄 렌더는 없다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void openRewardChoices();
    }
  }, [isFinalStage, rewardChoices, openRewardChoices]);

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

  function canFeed(type: ResourceType) {
    return !busy && !canEvolve && resources[type] > 0;
  }

  /** 선택만 하는 단계 — 로컬 state 에 저장하고 하이라이트만 한다. 서버 전송은 claimSelectedReward() 몫 */
  function selectReward(type: EggType) {
    if (busy) return;
    setSelectedReward(type);
  }

  async function claimSelectedReward() {
    if (!selectedReward) return;
    const result = await call<RewardClaimResponse>("/api/egg/reward/claim", {
      chosen: selectedReward,
    });
    if (result) {
      setFeedback(
        result.transformed
          ? "알이 금빛으로 변했습니다!"
          : `${EGG_LABEL[result.granted]} 알을 받았습니다.`,
      );
      setSelectedReward(null);
      setRewardChoices(null);
      await refresh();
    }
  }

  // ---- 드래그 앤 드롭: 밥 주기 · 알 보상 선택 공용 --------------------
  // 마우스는 HTML5 Drag and Drop API, 모바일은 이 API가 터치를 지원하지
  // 않으므로 터치 이벤트로 좌표를 직접 추적한다.

  function handleDragStart(event: React.DragEvent<HTMLButtonElement>, payload: DragPayload) {
    if (payload.kind === "feed" && !canFeed(payload.type)) {
      event.preventDefault();
      return;
    }
    if (payload.kind === "reward" && busy) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData("text/plain", JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "move";
    setDragPayload(payload);
  }

  function endDrag() {
    setDragPayload(null);
    setDropActive(false);
  }

  function handlePortraitDragOver(event: React.DragEvent<HTMLDivElement>) {
    if (!dragPayload) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropActive(true);
  }

  function handlePortraitDragLeave() {
    setDropActive(false);
  }

  function resolveDroppedPayload(event: React.DragEvent<HTMLDivElement>): DragPayload | null {
    const raw = event.dataTransfer.getData("text/plain");
    if (raw) {
      try {
        return JSON.parse(raw) as DragPayload;
      } catch {
        // 파싱 실패 시 아래에서 state 로 대체한다
      }
    }
    return dragPayload;
  }

  function handlePortraitDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDropActive(false);
    const payload = resolveDroppedPayload(event);
    setDragPayload(null);
    if (!payload) return;
    if (payload.kind === "feed" && canFeed(payload.type)) {
      feed(payload.type);
    } else if (payload.kind === "reward") {
      selectReward(payload.type);
    }
  }

  function isPointOverPortrait(x: number, y: number) {
    const rect = portraitRef.current?.getBoundingClientRect();
    if (!rect) return false;
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  function handleDragTouchStart(event: React.TouchEvent<HTMLButtonElement>, payload: DragPayload) {
    if (payload.kind === "feed" && !canFeed(payload.type)) return;
    if (payload.kind === "reward" && busy) return;
    const touch = event.touches[0];
    setDragPayload(payload);
    setTouchPoint({ x: touch.clientX, y: touch.clientY });
  }

  function handleDragTouchMove(event: React.TouchEvent<HTMLButtonElement>) {
    if (!dragPayload) return;
    const touch = event.touches[0];
    setTouchPoint({ x: touch.clientX, y: touch.clientY });
    setDropActive(isPointOverPortrait(touch.clientX, touch.clientY));
  }

  function handleDragTouchEnd(event: React.TouchEvent<HTMLButtonElement>) {
    if (!dragPayload) return;
    const touch = event.changedTouches[0];
    const dropped = isPointOverPortrait(touch.clientX, touch.clientY);
    const payload = dragPayload;
    setDragPayload(null);
    setDropActive(false);
    setTouchPoint(null);
    if (!dropped) return;
    if (payload.kind === "feed" && canFeed(payload.type)) {
      feed(payload.type);
    } else if (payload.kind === "reward") {
      selectReward(payload.type);
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
      if (result.pet.stage === FINAL_GROWTH_STAGE && result.pet.combo) {
        // 성체 전환은 즉시 반영한다 — refresh() 이후엔 activePet 이 null 로
        // 바뀌어 이 정보를 다시 얻을 방법이 없다.
        setLastAdultPet({
          eggType: result.pet.eggType,
          isAlbino: result.pet.isAlbino,
          combo: result.pet.combo,
          speciesName: result.pet.speciesName,
        });
        setCelebrating(true);
        window.setTimeout(() => setCelebrating(false), 2400);
      }
      await refresh();
    }
  }

  /** 지금 카드에 그릴 대상. 육성 중이면 그 개체, 아니면 마지막 성체 */
  const displayPet:
    | { eggType: EggType; stage: number; isAlbino: boolean; stage2Trait: Trait | null; combo: Combo | null; speciesName: string | null }
    | null = pet
    ? pet
    : lastAdultPet
      ? { ...lastAdultPet, stage: FINAL_GROWTH_STAGE, stage2Trait: null }
      : null;

  /** 개체가 없으면 그릴 것도 없다. petSprite 는 단계 정보가 모자라면 던진다 */
  const spritePath = displayPet === null ? "" : petSprite(displayPet);

  const canEvolve =
    pet !== null &&
    pet.feedRequired !== null &&
    pet.feedCount >= pet.feedRequired;

  const dragGhostIcon =
    dragPayload?.kind === "feed"
      ? (FEEDS.find((f) => f.type === dragPayload.type)?.icon ?? null)
      : dragPayload?.kind === "reward"
        ? eggSprite(dragPayload.type)
        : null;

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

          {displayPet === null ? (
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
              {pet !== null ? (
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
              ) : (
                <div className="rounded-[28px] border border-slate-800/90 bg-slate-900/90 p-5 text-center">
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
                    Stage · Progress
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-slate-100">
                    {STAGE_NAME[FINAL_GROWTH_STAGE]}
                    {lastAdultPet?.isAlbino ? " · 알비노" : ""}
                  </p>
                  <p className="mt-2 text-sm text-slate-400">{lastAdultPet?.speciesName ?? "완성"}</p>
                </div>
              )}

              <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-[34px] border border-amber-400/20 bg-slate-900/90 p-5">
                <div
                  ref={portraitRef}
                  onDragOver={handlePortraitDragOver}
                  onDragLeave={handlePortraitDragLeave}
                  onDrop={handlePortraitDrop}
                  className={`mx-auto grid h-[260px] w-[260px] place-items-center overflow-hidden rounded-[28px] border bg-slate-900 transition ${
                    dropActive ? "house-portrait-drop-active" : "border-slate-700/80"
                  } ${pet === null && lastAdultPet ? "house-portrait-final" : ""}`}
                >
                  {brokenSprite === spritePath ? (
                    // 84장이 모두 준비된 상태라 여기까지 오면 파일 누락이나 전송
                    // 실패다. 깨진 이미지 아이콘 대신 단계 이름을 보여준다.
                    <span className="text-sm text-slate-500">
                      {displayPet.speciesName ?? STAGE_NAME[displayPet.stage]}
                    </span>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={spritePath}
                      alt={displayPet.speciesName ?? STAGE_NAME[displayPet.stage]}
                      className="h-full w-full object-contain"
                      style={{ imageRendering: "pixelated" }}
                      onError={() => setBrokenSprite(spritePath)}
                    />
                  )}
                </div>
                <p className="mt-3 text-center text-xs text-slate-500">
                  {pet !== null
                    ? canEvolve
                      ? "먹이는 다 채웠습니다. 진화를 눌러 보세요."
                      : "아래 먹이를 개체 위로 드래그해서 놓으면 급여됩니다."
                    : isFinalStage
                      ? "아래 알 보상을 클릭하거나 개체 위로 드래그해서 골라 보세요."
                      : "알을 부화시켜 다음 개체를 키워 보세요."}
                </p>
              </div>

              {pet !== null ? (
                <div className="flex flex-wrap justify-center gap-4">
                  {FEEDS.map((f) => (
                    <button
                      key={f.type}
                      type="button"
                      draggable={canFeed(f.type)}
                      onDragStart={(event) => handleDragStart(event, { kind: "feed", type: f.type })}
                      onDragEnd={endDrag}
                      onTouchStart={(event) => handleDragTouchStart(event, { kind: "feed", type: f.type })}
                      onTouchMove={handleDragTouchMove}
                      onTouchEnd={handleDragTouchEnd}
                      onTouchCancel={endDrag}
                      style={{ touchAction: "none" }}
                      className={`relative h-24 w-24 cursor-grab rounded-[24px] border border-slate-700/90 bg-slate-900/90 p-2 transition hover:scale-105 ${f.ring} active:cursor-grabbing active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
                        dragPayload?.kind === "feed" && dragPayload.type === f.type ? "opacity-35" : ""
                      }`}
                      disabled={busy || resources[f.type] <= 0 || canEvolve}
                      title={`${f.label} · 성향 ${f.trait} — 개체 위로 드래그하세요`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={f.icon}
                        alt={f.label}
                        className="h-12 w-full object-contain"
                        style={{ imageRendering: "pixelated" }}
                        draggable={false}
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
              ) : isFinalStage ? (
                <div className="flex flex-wrap justify-center gap-4">
                  {(rewardChoices ?? []).map((type) => (
                    <button
                      key={type}
                      type="button"
                      draggable={!busy}
                      onDragStart={(event) => handleDragStart(event, { kind: "reward", type })}
                      onDragEnd={endDrag}
                      onTouchStart={(event) => handleDragTouchStart(event, { kind: "reward", type })}
                      onTouchMove={handleDragTouchMove}
                      onTouchEnd={handleDragTouchEnd}
                      onTouchCancel={endDrag}
                      style={{ touchAction: "none" }}
                      onClick={() => selectReward(type)}
                      disabled={busy}
                      className={`relative h-24 w-24 cursor-grab rounded-[24px] border p-2 transition hover:scale-105 active:cursor-grabbing active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
                        selectedReward === type
                          ? "border-amber-300 bg-amber-400/15 ring-2 ring-amber-300"
                          : "border-slate-700/90 bg-slate-900/90 hover:border-amber-300/60"
                      } ${dragPayload?.kind === "reward" && dragPayload.type === type ? "opacity-35" : ""}`}
                      title={`${EGG_LABEL[type]} 알 — 클릭하거나 개체 위로 드래그해서 선택`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={eggSprite(type)}
                        alt={EGG_LABEL[type]}
                        className="h-12 w-full object-contain"
                        style={{ imageRendering: "pixelated" }}
                        draggable={false}
                      />
                      <span className="mt-1 block text-xs font-semibold">{EGG_LABEL[type]} 알</span>
                      {selectedReward === type ? (
                        <span className="absolute -top-2 -right-2 grid h-5 w-5 place-items-center rounded-full bg-amber-400 text-[10px] font-bold text-slate-900">
                          ✓
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap justify-center gap-3">
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
              )}

              {pet !== null && canEvolve ? (
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

              {isFinalStage ? (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={claimSelectedReward}
                    disabled={busy || !selectedReward}
                    className="rounded-2xl border border-amber-300 bg-amber-400/20 px-8 py-3 font-semibold text-amber-100 transition hover:bg-amber-400/30 disabled:opacity-50"
                  >
                    알 받기
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>
      {touchPoint && dragGhostIcon ? (
        // 터치 드래그 중 손끝을 따라다니는 고스트 아이콘. HTML5 DnD 는 자체
        // 드래그 이미지를 브라우저가 그려주지만, 터치 경로는 직접 그려야 한다.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dragGhostIcon}
          alt=""
          aria-hidden="true"
          className="pointer-events-none fixed z-[999] h-16 w-16 -translate-x-1/2 -translate-y-1/2 object-contain opacity-90 drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)]"
          style={{ left: touchPoint.x, top: touchPoint.y, imageRendering: "pixelated" }}
        />
      ) : null}
      <Modal open={celebrating && lastAdultPet !== null} onClose={() => setCelebrating(false)}>
        <div className="evolution-celebrate">
          <p className="evolution-celebrate-kicker">최종 성장 완료</p>
          <h2 className="evolution-celebrate-title">{lastAdultPet?.speciesName ?? STAGE_NAME[FINAL_GROWTH_STAGE]}</h2>
          <div className="evolution-celebrate-portrait">
            {lastAdultPet ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={petSprite({ ...lastAdultPet, stage: FINAL_GROWTH_STAGE, stage2Trait: null })}
                alt={lastAdultPet.speciesName ?? STAGE_NAME[FINAL_GROWTH_STAGE]}
                style={{ imageRendering: "pixelated" }}
              />
            ) : null}
          </div>
          <p className="evolution-celebrate-copy">
            개체가 최종 성장 단계에 도달했습니다. 도감에서도 확인할 수 있습니다.
          </p>
          <button type="button" className="evolution-celebrate-button" onClick={() => setCelebrating(false)}>
            확인
          </button>
        </div>
      </Modal>
    </div>
  );
}
