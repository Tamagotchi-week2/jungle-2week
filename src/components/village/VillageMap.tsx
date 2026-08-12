"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { VillageScene } from "./types";
import type {
  FarmStateResponse,
  HarvestResponse,
  MineFinishResponse,
} from "@/types/api";
import {
  FACILITY_BY_TYPE,
  getCellAt,
  MAP_HEIGHT,
  MAP_START,
  MAP_WIDTH,
  VILLAGE_MAP,
} from "./constants";
import { buildingSprite, playerSprite, type Direction } from "@/lib/sprites";
import { judgeMine, type MineFailReason } from "@/lib/game/gather";
import { useMe } from "./MeContext";

const DIRECTION_VECTORS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
} as const;

const FARM_GROW_SECONDS = 120;
const MINE_CLICK_TARGET = 20;

// 밭 상태별 아이콘. 전용 empty/growing/ready 스프라이트가 없으므로 실제 존재하는 에셋으로 대체한다
const FARM_ICON_BY_STATE = {
  empty: buildingSprite("farm"),
  growing: "/sprites/farm/seed.png",
  ready: "/sprites/farm/crop.png",
};

type Facing = Direction;

interface VillageMapProps {
  activeScene: VillageScene;
  onOpenScene(scene: VillageScene): void;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`;
}

function getFarmElapsedSeconds(plantedAt: string) {
  const plantedTime = new Date(plantedAt).getTime();
  return Math.max(0, Math.floor((Date.now() - plantedTime) / 1000));
}

export default function VillageMap({ activeScene, onOpenScene }: VillageMapProps) {
  const { refresh, applyResources } = useMe();
  // 연타 수는 ref 로 센다. 키 입력이 한 프레임에 몰리면 state 는 갱신 전 값을 보게 되어
  // 목표치에 영원히 도달하지 못하거나 중복 완료가 발생한다.
  const mineClickRef = useRef(0);
  // 완료 요청은 세션당 1회. 목표 도달 후에도 계속 누르면 같은 세션을 반복 전송해
  // 서버가 "이미 처리된 세션"으로 400 을 돌려주고 성공 메시지를 덮어쓴다.
  const mineCompletingRef = useRef(false);
  /**
   * 첫 연타 시각(performance.now). 소요 시간을 여기서부터 로컬로 잰다.
   * 서버 시각으로 재면 mine/start 왕복이 포함되어 자동 연타에 관대해진다.
   */
  const mineStartedAtRef = useRef<number | null>(null);
  /**
   * 세션 생성 요청이 떠 있는 동안 켜둔다. mineLoading 은 state 라 리렌더 전에는
   * 갱신되지 않아, 빠르게 연타하면 같은 순간의 옛 값을 보고 세션을 여러 번 만든다.
   * 마지막 세션이 이기면서 그 전에 센 연타가 통째로 버려진다.
   */
  const [playerPosition, setPlayerPosition] = useState(MAP_START);
  const [facing, setFacing] = useState<Facing>("down");
  const [walkFrame, setWalkFrame] = useState<0 | 1>(0);
  const [farmState, setFarmState] = useState<FarmStateResponse | null>(null);
  const [farmLoading, setFarmLoading] = useState(false);
  const [farmFeedback, setFarmFeedback] = useState("Loading farm state...");
  const [farmTick, setFarmTick] = useState(0);

  const [mineAttemptId, setMineAttemptId] = useState<string | null>(null);
  const [mineClicks, setMineClicks] = useState(0);
  const [mineTarget, setMineTarget] = useState(MINE_CLICK_TARGET);
  const [mineFeedback, setMineFeedback] = useState("");
  /** 마지막 채굴이 성공이었는가. 실패 문구를 초록색으로 띄우지 않기 위해 쓴다 */
  const [mineOk, setMineOk] = useState(true);

  const [mineLoading, setMineLoading] = useState(false);

  const targetFacility = useMemo(() => {
    const delta = DIRECTION_VECTORS[facing];
    const nextX = playerPosition.x + delta.dx;
    const nextY = playerPosition.y + delta.dy;
    const nextCell = getCellAt(nextX, nextY);

    if (!nextCell || !nextCell.facility) {
      return null;
    }

    return FACILITY_BY_TYPE[nextCell.facility];
  }, [facing, playerPosition]);

  const farmReady = farmState?.plantedAt
    ? getFarmElapsedSeconds(farmState.plantedAt) >= FARM_GROW_SECONDS
    : false;

  const farmRemainingSeconds = farmState?.plantedAt
    ? Math.max(0, FARM_GROW_SECONDS - getFarmElapsedSeconds(farmState.plantedAt))
    : null;

  async function refreshFarmState() {
    try {
      const response = await fetch("/api/gather/farm");
      const payload = await response.json();
      if (!response.ok) {
        setFarmFeedback(payload.error ?? "Failed to load farm state.");
        return;
      }
      setFarmState(payload);
      setFarmFeedback("");
    } catch (error) {
      setFarmFeedback("Farm state could not be loaded.");
    }
  }

  async function plantFarm() {
    if (farmLoading) {
      return;
    }
    setFarmLoading(true);
    setFarmFeedback("");

    const response = await fetch("/api/gather/farm/plant", {
      method: "POST",
    });
    const payload = await response.json();

    if (!response.ok) {
      setFarmFeedback(payload.error ?? "Planting failed.");
    } else {
      setFarmState(payload);
      setFarmFeedback("Seed planted. Come back after it grows.");
    }

    setFarmLoading(false);
  }

  async function harvestFarm() {
    if (farmLoading) {
      return;
    }
    if (!farmReady) {
      setFarmFeedback("Crop is still growing. Wait until it is ready.");
      return;
    }

    setFarmLoading(true);
    setFarmFeedback("");

    const response = await fetch("/api/gather/farm/harvest", {
      method: "POST",
    });
    const payload = await response.json();
    if (!response.ok) {
      setFarmFeedback(payload.error ?? "Harvest failed.");
    } else {
      const result = payload as HarvestResponse;
      setFarmFeedback(`Harvest complete! Gained ${result.gained} crop.`);
      await refreshFarmState();
      // 자원이 늘었으므로 상단 HUD 도 갱신한다
      await refresh();
    }
    setFarmLoading(false);
  }

  function startMineLocally(): string {
    const attemptId = crypto.randomUUID();
    mineClickRef.current = 0;
    mineCompletingRef.current = false;
    mineStartedAtRef.current = performance.now();
    setMineAttemptId(attemptId);
    setMineClicks(0);
    setMineTarget(MINE_CLICK_TARGET);
    setMineOk(true);
    setMineFeedback("");

    return attemptId;
  }

  /** 판정 결과를 화면 문구로 옮긴다. 로컬 판정과 서버 판정이 같은 표현을 쓴다 */
  function showMineVerdict(verdict: {
    success: boolean;
    reason?: MineFailReason;
  }) {
    if (verdict.success) {
      setMineOk(true);
      setMineFeedback("채굴 성공!");
      return;
    }
    setMineOk(false);
    setMineFeedback(
      verdict.reason === "too_fast"
        ? "너무 빠릅니다. 자동 연타로 보입니다."
        : "연타 횟수가 모자랍니다.",
    );
  }

  async function completeMine(attemptId: string, clicks: number, elapsedMs: number) {
    if (mineLoading) {
      return;
    }

    // 판정을 로컬에서 끝낸다. 서버 왕복을 기다리면 35번째 연타의 결과만 늦게 떠
    // 연타가 끊긴 것처럼 느껴진다. 서버도 같은 규칙으로 다시 판정한다.
    const verdict = judgeMine(clicks, elapsedMs);

    setMineLoading(true);
    showMineVerdict(verdict);

    const response = await fetch("/api/gather/mine/finish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId, clicks, elapsedMs }),
    });
    const payload = (await response.json()) as MineFinishResponse;
    setMineLoading(false);
    setMineAttemptId(null);
    setMineClicks(0);
    setMineTarget(MINE_CLICK_TARGET);
    mineClickRef.current = 0;
    mineCompletingRef.current = false;
    mineStartedAtRef.current = null;

    if (!response.ok) {
      setMineOk(false);
      setMineFeedback("서버와 통신하지 못했습니다.");
      return;
    }

    // 서버가 다른 결론을 냈다면 서버 쪽이 맞다. 자원을 쥔 쪽이 서버다.
    if (payload.success !== verdict.success) {
      showMineVerdict({ success: payload.success, reason: payload.reason });
    }

    if (payload.success) {
      setMineFeedback(`광물 ${payload.gained}개 획득!`);
      applyResources(payload.resources);
    }
  }

  function handleFacilityInteraction(scene: VillageScene) {
    if (scene === "farm") {
      if (!farmState?.plantedAt) {
        plantFarm();
      } else if (farmReady) {
        harvestFarm();
      } else {
        setFarmFeedback("Crop is still growing. Please wait.");
      }
      return;
    }

    if (scene === "mine") {
      if (mineCompletingRef.current) {
        return;
      }

      const attemptId = mineAttemptId ?? startMineLocally();

      // 첫 연타에서 시계를 켠다. 세션 생성 응답을 기다린 시간은 빼야 한다.
      if (mineStartedAtRef.current === null) {
        mineStartedAtRef.current = performance.now();
      }

      mineClickRef.current += 1;
      setMineClicks(Math.min(mineTarget, mineClickRef.current));

      if (mineClickRef.current >= mineTarget) {
        mineCompletingRef.current = true;
        completeMine(
          attemptId,
          mineClickRef.current,
          Math.round(performance.now() - (mineStartedAtRef.current ?? performance.now())),
        );
      }
      return;
    }

    onOpenScene(scene);
  }

  useEffect(() => {
  // 마운트 시 1회 데이터 로드. setState 는 await 이후에만 일어나므로 실제
  // 연쇄 렌더는 없지만, 규칙이 호출을 동기 setState 로 보수적으로 판단한다.
  // 후속 과제: TanStack Query(이미 의존성에 있음)로 옮기면 이 예외가 사라진다.
  // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshFarmState();
  }, []);

  useEffect(() => {
    if (!farmState?.plantedAt) {
      return;
    }

    const interval = window.setInterval(() => {
      setFarmTick((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [farmState?.plantedAt]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) {
        return;
      }

      if (event.key === "Escape") {
        return;
      }

      if (activeScene !== "none") {
        return;
      }

      const movementKeys: Record<string, Facing | undefined> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
      };

      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        const delta = DIRECTION_VECTORS[facing];
        const nextX = playerPosition.x + delta.dx;
        const nextY = playerPosition.y + delta.dy;
        const nextCell = getCellAt(nextX, nextY);

        if (nextCell?.facility) {
          handleFacilityInteraction(FACILITY_BY_TYPE[nextCell.facility].scene);
        }
        return;
      }

      const requestedFacing = movementKeys[event.key];
      if (!requestedFacing) {
        return;
      }

      event.preventDefault();
      setFacing(requestedFacing);

      const delta = DIRECTION_VECTORS[requestedFacing];
      const nextX = playerPosition.x + delta.dx;
      const nextY = playerPosition.y + delta.dy;
      const nextCell = getCellAt(nextX, nextY);

      if (!nextCell || !nextCell.passable) {
        return;
      }

      setPlayerPosition({ x: nextX, y: nextY });
      setWalkFrame((current) => (current === 0 ? 1 : 0));
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeScene, facing, onOpenScene, playerPosition, farmReady, mineAttemptId, mineClicks, mineTarget]);

  const farmIcon = farmState?.plantedAt
    ? farmReady
      ? FARM_ICON_BY_STATE.ready
      : FARM_ICON_BY_STATE.growing
    : FARM_ICON_BY_STATE.empty;

  return (
    <div className="village-stage relative grid h-full w-full place-items-center overflow-hidden">
      {/* 화면 비율에 따라 생기는 여백은 원본 맵과 같은 결의 숲으로 채운다.
          플레이 맵과 별도 레이어이므로 좌표/충돌 판정에는 영향을 주지 않는다. */}
      <div className="village-surroundings" aria-hidden="true" />
      {/* 배경과 격자를 같은 상자에 담아야 시설 좌표가 그림과 어긋나지 않는다 */}
      <div
        className="village-fit village-play-map relative bg-cover bg-center"
        style={{
          backgroundImage: "url('/sprites/backgrounds/village.png')",
          imageRendering: "pixelated",
        }}
      >
        {VILLAGE_MAP.flatMap((row, y) =>
          row.map((cell, x) => {
            const facility = cell.facility ? FACILITY_BY_TYPE[cell.facility] : null;
            if (!facility) {
              return null;
            }

            const width = 100 / MAP_WIDTH;
            const height = 100 / MAP_HEIGHT;
            const style = {
              top: `${y * height}%`,
              left: `${x * width}%`,
              width: `${width}%`,
              height: `${height}%`,
            };

            const facilityImage = facility.scene === "farm" ? farmIcon : facility.image;

            return (
              <button
                key={`facility-${x}-${y}`}
                type="button"
                style={style}
                className="absolute flex items-center justify-center"
                onClick={() => handleFacilityInteraction(facility.scene)}
              >
                <img
                  src={facilityImage}
                  alt={facility.label}
                  className="h-full w-full object-contain p-1"
                  style={{
                    imageRendering: "pixelated",
                    transform: facility.scale ? `scale(${facility.scale})` : undefined,
                    transformOrigin: "center bottom",
                  }}
                  draggable={false}
                />
              </button>
            );
          }),
        )}

        {/* 플레이어는 시설 격자와 별개로 그린다. 같은 칸에 있어도 시설 위에
            항상 얹혀 보여야 하고, 시설 자체가 가려져 사라지면 안 된다. */}
        <div
          style={{
            top: `${playerPosition.y * (100 / MAP_HEIGHT)}%`,
            left: `${playerPosition.x * (100 / MAP_WIDTH)}%`,
            width: `${100 / MAP_WIDTH}%`,
            height: `${100 / MAP_HEIGHT}%`,
          }}
          className="pointer-events-none absolute z-20 flex items-center justify-center"
        >
          <img
            src={playerSprite(facing, walkFrame)}
            alt="Player"
            className="h-full w-full object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)]"
            style={{ imageRendering: "pixelated" }}
            draggable={false}
          />
        </div>
      </div>

      {/* 힌트는 지도(village-fit) 밖, 화면(village-stage) 기준으로 붙인다.
          지도 안에 두면 화면이 넓을 때 지도가 가운데로 모이면서 힌트도 함께
          안쪽으로 딸려 들어가 왼쪽에 빈 공간이 크게 남는다. */}
      <div className="village-hint-card absolute bottom-4 left-4 z-10 max-w-[320px] p-4">
        <p className="text-xs tracking-[0.22em]">상호작용 안내</p>
        {targetFacility?.scene === "farm" ? (
          <div className="mt-3 space-y-2">
            <p className="text-sm">앞에 농장이 있습니다. <span className="text-amber-200">스페이스바</span>를 누르세요.</p>
            <p className="text-base font-semibold text-slate-100">
              {farmState?.plantedAt
                ? farmReady
                  ? "수확할 수 있습니다"
                  : `성장 중 (${formatTime(farmRemainingSeconds ?? 0)})`
                : "비어 있는 밭"}
            </p>
            <p className="text-sm text-slate-400">
              {farmState?.plantedAt
                ? farmReady
                  ? "스페이스바를 눌러 수확하세요"
                  : "작물이 자랄 때까지 기다리세요"
                : "스페이스바를 눌러 씨앗을 심으세요"}
            </p>
            {farmFeedback ? <p className="text-sm text-emerald-200">{farmFeedback}</p> : null}
          </div>
        ) : targetFacility?.scene === "mine" ? (
          <div className="mt-3 space-y-2">
            <p className="text-sm">앞에 광산이 있습니다. <span className="text-amber-200">스페이스바</span>를 누르세요.</p>
            <p className="text-base font-semibold text-slate-100">
              {mineAttemptId ? `채굴 ${mineClicks} / ${mineTarget}` : "대기 중"}
            </p>
            <p className="text-sm">{mineAttemptId ? "목표까지 스페이스바를 계속 누르세요." : "스페이스바로 채굴을 시작합니다."}</p>
            {mineFeedback ? (
              <p className={`text-sm ${mineOk ? "text-emerald-200" : "text-red-300"}`}>
                {mineFeedback}
              </p>
            ) : null}
          </div>
        ) : targetFacility?.scene === "house" ? (
          <div className="mt-3 space-y-2">
            <p className="text-sm">앞에 집이 있습니다.</p>
            <p className="text-base font-semibold text-slate-100">펫 돌보기</p>
            <p className="text-sm">스페이스바를 눌러 알을 부화시키고 펫에게 먹이를 주세요.</p>
          </div>
        ) : targetFacility?.scene === "mailbox" ? (
          <div className="mt-3 space-y-2">
            <p className="text-sm">앞에 우체통이 있습니다.</p>
            <p className="text-base font-semibold text-slate-100">마을 방명록</p>
            <p className="text-sm">스페이스바를 눌러 이웃의 편지를 읽거나 새 편지를 남기세요.</p>
          </div>
        ) : targetFacility?.scene === "shore" ? (
          <div className="mt-3 space-y-2">
            <p className="text-sm">앞에 낚시터가 있습니다.</p>
            <p className="text-base font-semibold text-slate-100">물고기 낚기</p>
            <p className="text-sm">스페이스바를 눌러 낚싯대를 드리우고 어패 자원을 모으세요.</p>
          </div>
        ) : (
          <div className="mt-3 text-sm">
            시설을 바라보고 <span className="text-amber-200">스페이스바</span>를 눌러 상호작용하세요.
          </div>
        )}
      </div>
    </div>
  );
}
