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
  ring: string;
  icon: string;
}[] = [
  { type: "crop", label: "작물", ring: "hover:border-emerald-300", icon: "/sprites/house/crop.webp" },
  { type: "mineral", label: "광물", ring: "hover:border-amber-300", icon: "/sprites/house/mineral.webp" },
  { type: "seafood", label: "어패", ring: "hover:border-sky-300", icon: "/sprites/house/seafood.webp" },
];

const EGG_LABEL: Record<EggType, string> = {
  air: "하늘",
  land: "대지",
  sea: "바다",
  gold: "금색",
};

/** 화면에 성체를 그리는 데 필요한 최소 정보. activePet(PetView)·adults(TradePetView) 양쪽에서 만들 수 있다 */
interface AdultDisplayPet {
  eggType: EggType;
  isAlbino: boolean;
  combo: Combo;
  speciesName: string | null;
}

/** 드래그 중인 대상. 밥(자원)과 알 보상(EggType)은 서로 다른 타입이라 종류를 함께 들고 다닌다 */
type DragPayload = { kind: "feed"; type: ResourceType };

export default function HouseScene() {
  const { me, refresh } = useMe();
  const [busy, setBusy] = useState(false);
  const [, setFeedback] = useState<string | null>(null);
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
  const autoEvolvingPetRef = useRef<string | null>(null);

  // 알 보상 선택 상태. choices 는 /open 이 내려준 선택지, selected 는 아직
  // 서버에 보내지 않은 하이라이트된 선택(로컬 저장)이다.
  const [rewardChoices, setRewardChoices] = useState<EggType[] | null>(null);
  const [selectedReward, setSelectedReward] = useState<EggType | null>(null);

  /**
   * 알 획득 연출. 수령 직후 고른 알을 먼저 보여주고, 잠시 뒤 실제로 받은 알로
   * 바꾼다. 금색 판정이었다면 이 순간 알이 금빛으로 변한다 (설계 6장).
   */
  const [rewardReveal, setRewardReveal] = useState<{
    chosen: EggType;
    granted: EggType;
    transformed: boolean;
  } | null>(null);
  /** 바뀐 뒤인가. false 면 아직 고른 알을 보여주는 중이다 */
  const [rewardRevealed, setRewardRevealed] = useState(false);
  const rewardRevealTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (rewardRevealTimerRef.current !== null) {
        window.clearTimeout(rewardRevealTimerRef.current);
      }
    },
    [],
  );

  // 최종 성장 단계에 막 도달했을 때만 짧게 연출한다.
  const [celebrating, setCelebrating] = useState(false);
  const [evolving, setEvolving] = useState(false);
  /** 마지막 급여 뒤 서버 진화 전에 진행 바를 먼저 완충해서 보여주기 위한 화면 값 */
  const [feedProgressPreview, setFeedProgressPreview] = useState<{
    petId: string;
    stage: number;
    count: number;
  } | null>(null);
  const [hatchedPet, setHatchedPet] = useState<HatchResponse["pet"] | null>(null);
  const [grownPet, setGrownPet] = useState<EvolveResponse["pet"] | null>(null);

  // 방금 완성한 성체가 이 계정에 처음 등록되는 폼인지. 서버가 도감 갱신 직전
  // 상태와 비교해 판정한 값이라, "예전에 이미 봤던 종"을 새것으로 잘못 알리지
  // 않는다 (클라이언트에만 저장된 기록은 이 계정의 과거 전체를 알 수 없다).
  const [lastAdultNewFlags, setLastAdultNewFlags] = useState<{
    isNewSpecies: boolean;
    isNewAlbino: boolean;
  } | null>(null);

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
      setHatchedPet(result.pet);
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
      setFeedProgressPreview({
        petId: result.pet.id,
        stage: result.pet.stage,
        count: result.pet.feedCount,
      });
      if (result.canEvolve) {
        // 마지막 칸이 화면에 그려지고 CSS 전환이 끝난 다음 진화 연출을 시작한다.
        setEvolving(true);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 550));
        await evolve(result.pet.id);
      } else {
        await refresh();
      }
    }
  }

  function canFeed(type: ResourceType) {
    return !busy && !evolving && !canEvolve && resources[type] > 0;
  }

  /** 선택만 하는 단계 — 로컬 state 에 저장하고 하이라이트만 한다. 서버 전송은 claimSelectedReward() 몫 */
  function selectReward(type: EggType) {
    if (busy) return;
    setSelectedReward(type);
  }

  async function claimSelectedReward() {
    if (!selectedReward) return;
    const chosen = selectedReward;
    const result = await call<RewardClaimResponse>("/api/egg/reward/claim", {
      chosen,
    });
    if (!result) return;

    // 획득 연출을 띄운다. 처음에는 **고른 알**을 그대로 보여준다 — 금색 판정을
    // 곧바로 드러내면 "평범하게 고른 알이 금색으로 변한다"는 연출 자체가
    // 성립하지 않는다 (설계 6장).
    setRewardReveal({ chosen, granted: result.granted, transformed: result.transformed });
    setRewardRevealed(false);
    if (rewardRevealTimerRef.current !== null) {
      window.clearTimeout(rewardRevealTimerRef.current);
    }
    rewardRevealTimerRef.current = window.setTimeout(() => {
      setRewardRevealed(true);
    }, 900);

    setSelectedReward(null);
    setRewardChoices(null);
    await refresh();
  }

  function closeRewardReveal() {
    if (rewardRevealTimerRef.current !== null) {
      window.clearTimeout(rewardRevealTimerRef.current);
      rewardRevealTimerRef.current = null;
    }
    setRewardReveal(null);
    setRewardRevealed(false);
  }

  // ---- 드래그 앤 드롭: 밥 주기 · 알 보상 선택 공용 --------------------
  // 마우스는 HTML5 Drag and Drop API, 모바일은 이 API가 터치를 지원하지
  // 않으므로 터치 이벤트로 좌표를 직접 추적한다.

  function handleDragStart(event: React.DragEvent<HTMLButtonElement>, payload: DragPayload) {
    if (payload.kind === "feed" && !canFeed(payload.type)) {
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
    if (canFeed(payload.type)) {
      feed(payload.type);
    }
  }

  function isPointOverPortrait(x: number, y: number) {
    const rect = portraitRef.current?.getBoundingClientRect();
    if (!rect) return false;
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  function handleDragTouchStart(event: React.TouchEvent<HTMLButtonElement>, payload: DragPayload) {
    if (!canFeed(payload.type)) return;
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
    if (canFeed(payload.type)) {
      feed(payload.type);
    }
  }

  async function evolve(petId: string) {
    setEvolving(true);
    const result = await call<EvolveResponse>("/api/pet/evolve", { petId });
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
        setLastAdultNewFlags({
          isNewSpecies: result.isNewSpecies,
          isNewAlbino: result.isNewAlbino,
        });
        // 스스로 닫지 않는다. 성체 완성은 한 마리에 한 번뿐인 순간이라,
        // 다른 곳을 보고 있는 사이에 지나가 버리면 다시 볼 방법이 없다.
        // 확인 버튼을 눌러야만 닫힌다.
        setCelebrating(true);
      } else {
        setGrownPet(result.pet);
      }
      await refresh();
    }
    window.setTimeout(() => setEvolving(false), 900);
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

  /** 축하 모달의 NEW 배지 — 방금 진화가 이 계정에 처음 등록한 폼인가 (서버 판정) */
  const isLastAdultNewAlbino = lastAdultNewFlags?.isNewAlbino ?? false;
  const isLastAdultNew = isLastAdultNewAlbino || (lastAdultNewFlags?.isNewSpecies ?? false);

  const canEvolve =
    pet !== null &&
    pet.feedRequired !== null &&
    pet.feedCount >= pet.feedRequired;

  const visibleFeedCount =
    pet &&
    feedProgressPreview?.petId === pet.id &&
    feedProgressPreview.stage === pet.stage
      ? feedProgressPreview.count
      : pet?.feedCount ?? 0;

  // 이전 버전에서 이미 조건을 채운 채 남은 개체도 버튼 없이 자동 진화시킨다.
  useEffect(() => {
    if (!canEvolve || !pet || autoEvolvingPetRef.current === pet.id) return;
    autoEvolvingPetRef.current = pet.id;
    void evolve(pet.id);
    // evolve 는 현재 pet 스냅샷을 서버에 보내는 일만 하므로 id/조건이 바뀔 때만 실행한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEvolve, pet?.id]);

  const dragGhostIcon = dragPayload
    ? (FEEDS.find((f) => f.type === dragPayload.type)?.icon ?? null)
    : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 text-slate-100">
      <section className="relative overflow-hidden rounded-[32px] border border-slate-700/80 bg-slate-950/95 shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('/sprites/house/bg.webp')",
            imageRendering: "pixelated",
          }}
        />
        <div className="absolute inset-0 bg-slate-950/70" />

        <div className="relative space-y-6 p-6">
          {/*
            isFinalStage 는 `me`(즉시 로딩)에서 나오고, displayPet 은
            lastAdultPet 을 따로 fetch 해야 해서 한 박자 늦게 채워진다. 그 사이
            (pet === null && lastAdultPet === null) 순간에는 displayPet 이 null
            이라 원래 아래 "부화시키세요" 화면이 잠깐 보였다 — 보상이 남아 있는데도
            알을 부화시킬 수 있는 버튼이 눈에 들어오고, 실제로 눌리기도 했다.
            그래서 isFinalStage 를 displayPet 유무보다 먼저 검사해, 그 순간에도
            부화 화면 대신 (로딩 중인) 보상 선택 화면으로 빠지게 한다. 서버도
            hatchEgg 에서 같은 조건을 막는다(pet.ts) — 화면은 사용자 경험을
            위한 것이고 실제 방어는 서버가 한다.
          */}
          {displayPet === null && !isFinalStage ? (
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
                    <span className="flex items-center justify-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={eggSprite(type)}
                        alt={`${EGG_LABEL[type]} 알`}
                        className="h-9 w-9 object-contain"
                        style={{ imageRendering: "pixelated" }}
                        draggable={false}
                      />
                      <span>{eggs[type]}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {pet !== null ? (
                <div>
                  <div className="house-stage-card p-5">
                    <p className="house-stage-card-label text-xs tracking-[0.22em]">
                      성장 단계 · 진행도
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-slate-100">
                      {STAGE_NAME[pet.stage]}
                      {pet.isAlbino ? " · 알비노" : ""}
                    </p>
                    <p className="house-stage-card-count mt-2 text-sm">
                      {pet.feedRequired === null
                        ? pet.speciesName ?? "완성"
                        : `${visibleFeedCount} / ${pet.feedRequired}회`}
                    </p>
                    {pet.feedRequired !== null ? (
                      <div className="house-stage-progress" aria-hidden="true">
                        <span
                          style={{
                            width: `${Math.min(100, (visibleFeedCount / pet.feedRequired) * 100)}%`,
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="house-stage-card p-5 text-center">
                  <p className="house-stage-card-label text-xs tracking-[0.22em]">
                    성장 단계 · 진행도
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-slate-100">
                    {STAGE_NAME[FINAL_GROWTH_STAGE]}
                    {lastAdultPet?.isAlbino ? " · 알비노" : ""}
                  </p>
                  <p className="house-stage-card-count mt-2 text-sm">{lastAdultPet?.speciesName ?? "완성"}</p>
                </div>
              )}

              <div className={`relative mx-auto w-full max-w-[420px] px-5 py-2 ${evolving ? "house-evolving" : ""}`}>
                <div
                  ref={portraitRef}
                  onDragOver={handlePortraitDragOver}
                  onDragLeave={handlePortraitDragLeave}
                  onDrop={handlePortraitDrop}
                  className={`house-portrait-frame mx-auto grid h-[260px] w-[260px] place-items-center overflow-hidden bg-slate-900 transition ${
                    dropActive ? "house-portrait-drop-active" : ""
                  } ${pet === null && lastAdultPet ? "house-portrait-final" : ""}`}
                >
                  {displayPet === null ? (
                    // isFinalStage 인데 lastAdultPet 이 아직 로딩 중인 순간이다.
                    // spritePath 가 빈 문자열이라 그대로 <img> 에 넘기면 깨진
                    // 아이콘이 잠깐 보인다.
                    <span className="text-sm text-slate-500">불러오는 중...</span>
                  ) : brokenSprite === spritePath ? (
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
                      draggable={false}
                    />
                  )}
                </div>
                <p className="mt-3 text-center text-xs text-slate-500">
                  {pet !== null
                    ? evolving
                      ? "새로운 성장 단계로 진화하고 있습니다!"
                      : "아래 먹이를 개체 위로 드래그해서 놓으면 급여됩니다."
                    : isFinalStage
                      ? "알을 선택하세요"
                      : ""}
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
                        dragPayload?.type === f.type ? "opacity-35" : ""
                      }`}
                      disabled={busy || resources[f.type] <= 0 || canEvolve}
                      title={`${f.label} — 개체 위로 드래그하세요`}
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
                        {f.label}
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
                      onClick={() => selectReward(type)}
                      disabled={busy}
                      className={`relative h-24 w-24 rounded-[24px] border p-2 transition hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
                        selectedReward === type
                          ? "border-amber-300 bg-amber-400/15 ring-2 ring-amber-300"
                          : "border-slate-700/90 bg-slate-900/90 hover:border-amber-300/60"
                      }`}
                      title={`${EGG_LABEL[type]} 알 선택`}
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
                      <span className="flex items-center justify-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={eggSprite(type)}
                          alt={`${EGG_LABEL[type]} 알`}
                          className="h-9 w-9 object-contain"
                          style={{ imageRendering: "pixelated" }}
                          draggable={false}
                        />
                        <span>{eggs[type]}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

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
          draggable={false}
        />
      ) : null}
      {/* 여기서 확인해도 도감의 NEW 는 지우지 않는다. 도감을 열었을 때 어떤
          칸이 새로 찼는지 한 번 더 보이는 편이 낫다 — 배지는 도감에서 그 칸을
          직접 눌러야 사라진다. */}
      <Modal
        open={celebrating && lastAdultPet !== null}
        onClose={() => setCelebrating(false)}
        closeOnBackdrop={false}
        closeOnEscape={false}
      >
        <div className="evolution-celebrate pet-event-celebrate adult-celebrate">
          <p className="evolution-celebrate-kicker">최종 성장 완료</p>
          <h2 className="evolution-celebrate-title">
            {isLastAdultNew ? (
              <span
                className={`dex-book-new-mark evolution-celebrate-new-mark ${
                  isLastAdultNewAlbino ? "dex-book-new-mark-gold" : ""
                }`}
              >
                NEW
              </span>
            ) : null}
            {lastAdultPet?.speciesName ?? STAGE_NAME[FINAL_GROWTH_STAGE]}
          </h2>
          <div className="evolution-celebrate-portrait">
            {lastAdultPet ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={petSprite({ ...lastAdultPet, stage: FINAL_GROWTH_STAGE, stage2Trait: null })}
                alt={lastAdultPet.speciesName ?? STAGE_NAME[FINAL_GROWTH_STAGE]}
                style={{ imageRendering: "pixelated" }}
                draggable={false}
              />
            ) : null}
          </div>
          <p className="evolution-celebrate-copy">
            {isLastAdultNew
              ? "도감에 없던 개체입니다! 도감에 새로 기록되었습니다."
              : "개체가 최종 성장 단계에 도달했습니다. 도감에서도 확인할 수 있습니다."}
          </p>
          <button type="button" className="evolution-celebrate-button" onClick={() => setCelebrating(false)}>
            확인
          </button>
        </div>
      </Modal>

      <Modal
        open={grownPet !== null}
        onClose={() => setGrownPet(null)}
        closeOnBackdrop={false}
        closeOnEscape={false}
      >
        {grownPet ? (
          <div className="evolution-celebrate pet-event-celebrate growth-celebrate">
            <p className="evolution-celebrate-kicker">성장 완료</p>
            <h2 className="evolution-celebrate-title">성장기로 진화했어요!</h2>
            <div className="evolution-celebrate-portrait growth-celebrate-portrait">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={petSprite(grownPet)}
                alt="성장기로 진화한 펫"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
            <p className="evolution-celebrate-copy">
              새로운 모습으로 성장했습니다. 계속 먹이를 주며 돌봐주세요.
            </p>
            <button
              type="button"
              className="evolution-celebrate-button"
              onClick={() => setGrownPet(null)}
            >
              확인
            </button>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={hatchedPet !== null}
        onClose={() => setHatchedPet(null)}
        closeOnBackdrop={false}
        closeOnEscape={false}
      >
        {hatchedPet ? (
          <div className="evolution-celebrate pet-event-celebrate hatch-celebrate">
            <p className="evolution-celebrate-kicker">새로운 탄생</p>
            <h2 className="evolution-celebrate-title">
              {hatchedPet.isAlbino ? "알비노 펫이 태어났어요!" : "펫이 태어났어요!"}
            </h2>
            <div className="evolution-celebrate-portrait hatch-celebrate-portrait">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={petSprite(hatchedPet)}
                alt={`${EGG_LABEL[hatchedPet.eggType]} 알에서 태어난 펫`}
                style={{ imageRendering: "pixelated" }}
              />
            </div>
            <p className="evolution-celebrate-copy">
              {EGG_LABEL[hatchedPet.eggType]} 알에서 새로운 친구가 태어났습니다.
            </p>
            <button
              type="button"
              className="evolution-celebrate-button"
              onClick={() => setHatchedPet(null)}
            >
              만나러 가기
            </button>
          </div>
        ) : null}
      </Modal>

      {/* 알 획득 연출. 집 이벤트의 원목 틀을 공유하되 알 전용 색감을 쓴다. */}
      <Modal
        open={rewardReveal !== null}
        onClose={closeRewardReveal}
        // 알 획득도 같다. 변신을 보기 전에 실수로 닫히면 연출이 날아간다.
        closeOnBackdrop={false}
        closeOnEscape={false}
      >
        {rewardReveal ? (
          <div className="evolution-celebrate pet-event-celebrate egg-reward-celebrate">
            <p className="evolution-celebrate-kicker">알 획득</p>
            <h2 className="evolution-celebrate-title">
              {rewardRevealed && rewardReveal.transformed
                ? "금색 알!"
                : `${EGG_LABEL[rewardRevealed ? rewardReveal.granted : rewardReveal.chosen]} 알`}
            </h2>
            <div
              className={`evolution-celebrate-portrait ${
                rewardRevealed && rewardReveal.transformed ? "egg-reveal-gold" : ""
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                // key 를 바꿔 <img> 를 갈아끼운다. 같은 엘리먼트에 src 만 바꾸면
                // 변신 애니메이션이 다시 시작하지 않는다.
                key={rewardRevealed ? "granted" : "chosen"}
                src={eggSprite(rewardRevealed ? rewardReveal.granted : rewardReveal.chosen)}
                alt={EGG_LABEL[rewardRevealed ? rewardReveal.granted : rewardReveal.chosen]}
                className={rewardRevealed && rewardReveal.transformed ? "egg-reveal-pop" : ""}
                style={{ imageRendering: "pixelated" }}
                draggable={false}
              />
            </div>
            <p className="evolution-celebrate-copy">
              {!rewardRevealed
                ? "알을 받는 중입니다..."
                : rewardReveal.transformed
                  ? "고른 알이 금빛으로 변했습니다! 금색 알은 어떤 성향으로도 자랍니다."
                  : "집에서 부화시켜 육성을 시작할 수 있습니다."}
            </p>
            <button
              type="button"
              className="evolution-celebrate-button"
              onClick={closeRewardReveal}
              // 변신을 보기 전에 닫아버리면 연출이 통째로 날아간다
              disabled={!rewardRevealed}
            >
              확인
            </button>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
