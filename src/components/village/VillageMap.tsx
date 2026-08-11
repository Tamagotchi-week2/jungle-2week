"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { VillageScene } from "./types";
import type {
  FarmStateResponse,
  HarvestResponse,
  MineFinishResponse,
  MineStartResponse,
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
const MINE_CLICK_TARGET = 35;

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
  const { refresh } = useMe();
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
  const mineStartingRef = useRef(false);
  const [playerPosition, setPlayerPosition] = useState(MAP_START);
  const [facing, setFacing] = useState<Facing>("down");
  const [walkFrame, setWalkFrame] = useState<0 | 1>(0);
  const [farmState, setFarmState] = useState<FarmStateResponse | null>(null);
  const [farmLoading, setFarmLoading] = useState(false);
  const [farmFeedback, setFarmFeedback] = useState("Loading farm state...");
  const [farmTick, setFarmTick] = useState(0);

  const [mineSessionId, setMineSessionId] = useState<string | null>(null);
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

  async function startMine() {
    if (mineLoading) {
      return;
    }
    if (mineStartingRef.current) {
      return;
    }
    mineStartingRef.current = true;
    mineClickRef.current = 0;
    mineCompletingRef.current = false;
    mineStartedAtRef.current = null;
    setMineLoading(true);
    setMineFeedback("");

    const response = await fetch("/api/gather/mine/start", {
      method: "POST",
    });
    const payload = await response.json();
    setMineLoading(false);
    mineStartingRef.current = false;

    if (!response.ok) {
      setMineOk(false);
      setMineFeedback(payload?.error ?? "채굴을 시작하지 못했습니다.");
      return;
    }

    const data = payload as MineStartResponse;
    setMineSessionId(data.sessionId);
    setMineTarget(data.clickTarget);
    setMineClicks(0);
    setMineFeedback("");
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

  async function completeMine(clicks: number, elapsedMs: number) {
    if (!mineSessionId || mineLoading) {
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
      body: JSON.stringify({ sessionId: mineSessionId, clicks, elapsedMs }),
    });
    const payload = (await response.json()) as MineFinishResponse;
    setMineLoading(false);
    setMineSessionId(null);
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
      await refresh();
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
      if (!mineSessionId) {
        startMine();
        return;
      }

      if (mineCompletingRef.current) {
        return;
      }

      // 첫 연타에서 시계를 켠다. 세션 생성 응답을 기다린 시간은 빼야 한다.
      if (mineStartedAtRef.current === null) {
        mineStartedAtRef.current = performance.now();
      }

      mineClickRef.current += 1;
      setMineClicks(Math.min(mineTarget, mineClickRef.current));

      if (mineClickRef.current >= mineTarget) {
        mineCompletingRef.current = true;
        completeMine(
          mineClickRef.current,
          Math.round(performance.now() - mineStartedAtRef.current),
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
  }, [activeScene, facing, onOpenScene, playerPosition, farmReady, mineSessionId, mineClicks, mineTarget]);

  const farmIcon = farmState?.plantedAt
    ? farmReady
      ? FARM_ICON_BY_STATE.ready
      : FARM_ICON_BY_STATE.growing
    : FARM_ICON_BY_STATE.empty;

  return (
    <div className="village-stage grid h-full w-full place-items-center overflow-hidden">
      {/* 배경과 격자를 같은 상자에 담아야 시설 좌표가 그림과 어긋나지 않는다 */}
      <div
        className="village-fit relative bg-cover bg-center"
        style={{
          backgroundImage: "url('/sprites/backgrounds/village.png')",
          imageRendering: "pixelated",
        }}
      >
        {VILLAGE_MAP.flatMap((row, y) =>
          row.map((cell, x) => {
            const facility = cell.facility ? FACILITY_BY_TYPE[cell.facility] : null;
            const isPlayer = playerPosition.x === x && playerPosition.y === y;
            if (!facility && !isPlayer) {
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

            if (isPlayer) {
              return (
                <div
                  key={`player-${x}-${y}`}
                  style={style}
                  className="absolute flex items-center justify-center"
                >
                  <img
                    src={playerSprite(facing, walkFrame)}
                    alt="Player"
                    className="h-full w-full object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)]"
                    style={{ imageRendering: "pixelated" }}
                    draggable={false}
                  />
                </div>
              );
            }

            const facilityImage = facility?.scene === "farm" ? farmIcon : facility!.image;

            return (
              <button
                key={`facility-${x}-${y}`}
                type="button"
                style={style}
                className="absolute flex items-center justify-center"
                onClick={() => handleFacilityInteraction(facility!.scene)}
              >
                <img
                  src={facilityImage}
                  alt={facility!.label}
                  className="h-full w-full object-contain p-1"
                  style={{
                    imageRendering: "pixelated",
                    transform: facility!.scale ? `scale(${facility!.scale})` : undefined,
                    transformOrigin: "center bottom",
                  }}
                  draggable={false}
                />
              </button>
            );
          }),
        )}

        <div className="absolute bottom-4 left-4 max-w-[320px] rounded-3xl border border-slate-800/80 bg-slate-950/95 p-4 text-slate-100 shadow-xl shadow-black/20 backdrop-blur-sm">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Interaction Hint</p>
          {targetFacility?.scene === "farm" ? (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-slate-300">Farm ahead. Press <span className="text-amber-300">SPACE</span>.</p>
              <p className="text-base font-semibold text-slate-100">
                {farmState?.plantedAt
                  ? farmReady
                    ? "Ready to harvest"
                    : `Growing (${formatTime(farmRemainingSeconds ?? 0)})`
                  : "Empty field"}
              </p>
              <p className="text-sm text-slate-400">
                {farmState?.plantedAt
                  ? farmReady
                    ? "Harvest with SPACE"
                    : "Wait until the crop is ready"
                  : "Plant seeds with SPACE"}
              </p>
              {farmFeedback ? <p className="text-sm text-emerald-200">{farmFeedback}</p> : null}
            </div>
          ) : targetFacility?.scene === "mine" ? (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-slate-300">Mine ahead. Press <span className="text-amber-300">SPACE</span>.</p>
              <p className="text-base font-semibold text-slate-100">
                {mineSessionId ? `채굴 ${mineClicks} / ${mineTarget}` : "대기 중"}
              </p>
              <p className="text-sm text-slate-400">{mineSessionId ? "목표까지 SPACE 를 계속 누르세요." : "SPACE 로 채굴을 시작합니다."}</p>
              {mineFeedback ? (
                <p className={`text-sm ${mineOk ? "text-emerald-200" : "text-red-300"}`}>
                  {mineFeedback}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 text-sm text-slate-400">
              Face a facility and press <span className="text-amber-300">SPACE</span> to interact.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
