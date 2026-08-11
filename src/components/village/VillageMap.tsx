"use client";

import { useEffect, useMemo, useState } from "react";
import type { VillageScene } from "./types";
import {
  FACILITY_BY_TYPE,
  getCellAt,
  MAP_HEIGHT,
  MAP_START,
  MAP_WIDTH,
  PLAYER_FACING_ICONS,
  VILLAGE_MAP,
} from "./constants";

const DIRECTION_VECTORS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
} as const;

type Facing = keyof typeof DIRECTION_VECTORS;

interface VillageMapProps {
  activeScene: VillageScene;
  onOpenScene(scene: VillageScene): void;
}

export default function VillageMap({ activeScene, onOpenScene }: VillageMapProps) {
  const [playerPosition, setPlayerPosition] = useState(MAP_START);
  const [facing, setFacing] = useState<Facing>("down");

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
          onOpenScene(FACILITY_BY_TYPE[nextCell.facility].scene);
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
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeScene, facing, onOpenScene, playerPosition]);

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
                  <span className="text-3xl text-emerald-200 drop-shadow-[0_0_8px_rgba(16,185,129,0.45)]">
                    {PLAYER_FACING_ICONS[facing]}
                  </span>
                </div>
              );
            }

            return (
              <button
                key={`facility-${x}-${y}`}
                type="button"
                style={style}
                className="absolute flex items-center justify-center"
                onClick={() => onOpenScene(facility!.scene)}
              >
                <img
                  src={facility!.image}
                  alt={facility!.label}
                  className="h-full w-full object-contain p-1"
                  draggable={false}
                />
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
