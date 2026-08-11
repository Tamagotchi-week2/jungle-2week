"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [mineStatus, setMineStatus] = useState("Press SPACE to start mining.");
  const [mineFeedback, setMineFeedback] = useState("Awaiting your first mine.");
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
      const response = await fetch("/api/gather/farm/state");
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
    }
    setFarmLoading(false);
  }

  async function startMine() {
    if (mineLoading) {
      return;
    }
    setMineLoading(true);
    setMineFeedback("Starting mine session...");

    const response = await fetch("/api/gather/mine/start", {
      method: "POST",
    });
    const payload = await response.json();
    setMineLoading(false);

    if (!response.ok) {
      setMineStatus("Mine failed to start.");
      setMineFeedback(payload?.error ?? "Could not start mining.");
      return;
    }

    const data = payload as MineStartResponse;
    setMineSessionId(data.sessionId);
    setMineTarget(data.clickTarget);
    setMineClicks(0);
    setMineStatus("Tap SPACE to mine.");
    setMineFeedback("Mining started. Press Space repeatedly.");
  }

  async function completeMine(clicks: number) {
    if (!mineSessionId || mineLoading) {
      return;
    }
    setMineLoading(true);
    setMineFeedback("Submitting mine result...");

    const response = await fetch("/api/gather/mine/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: mineSessionId, clicks }),
    });
    const payload = (await response.json()) as MineFinishResponse;
    setMineLoading(false);
    setMineSessionId(null);
    setMineClicks(0);
    setMineTarget(MINE_CLICK_TARGET);

    if (!response.ok || !payload.success) {
      setMineStatus("Mine failed.");
      setMineFeedback("Too fast or insufficient clicks. Try again.");
      return;
    }

    setMineStatus("Mine complete!");
    setMineFeedback(`Gained ${payload.gained} mineral.`);
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

      setMineClicks((current) => {
        const nextCount = Math.min(mineTarget, current + 1);
        if (nextCount === mineTarget) {
          completeMine(nextCount);
        }
        return nextCount;
      });
      return;
    }

    onOpenScene(scene);
  }

  useEffect(() => {
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
    <div className="relative h-full w-full overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: "url('/sprites/backgrounds/village.png')",
          imageRendering: "pixelated",
        }}
      />
      <div className="relative aspect-[15/11] w-full">
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
                {mineSessionId ? `Mining ${mineClicks} / ${mineTarget}` : "Ready to start"}
              </p>
              <p className="text-sm text-slate-400">{mineSessionId ? "Keep tapping Space until complete." : "Start mine session with Space."}</p>
              {mineFeedback ? <p className="text-sm text-emerald-200">{mineFeedback}</p> : null}
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
