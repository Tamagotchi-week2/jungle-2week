import type {
  FarmStateResponse,
  HarvestResponse,
  MineFinishRequest,
  MineFinishResponse,
  MineStartResponse,
  FishCastResponse,
  FishStrikeRequest,
  FishStrikeResponse,
} from "@/types/api";
import type { ResourceType } from "@/lib/game/types";

const FARM_GROW_SECONDS = 120;
const FARM_YIELD = 12;
const MINE_CLICK_TARGET = 35;
const MINE_MIN_MS_PER_CLICK = 80;
const FISH_BITE_DELAY_MIN = 3000;
const FISH_BITE_DELAY_MAX = 9000;
const FISH_QTE_WINDOW_MS = 700;
const FISH_MIN_HUMAN_MS = 100;

const farmState = {
  plantedAt: null as number | null,
};

const mineSessions = new Map<
  string,
  {
    startedAt: number;
    clickTarget: number;
  }
>();

const fishSessions = new Map<
  string,
  {
    castAt: number;
    biteDelayMs: number;
    resolved: boolean;
  }
>();

const emptyResources: Record<ResourceType, number> = {
  crop: 0,
  mineral: 0,
  seafood: 0,
};

function serializeFarmState(): FarmStateResponse {
  if (farmState.plantedAt === null) {
    return {
      plantedAt: null,
      remainingSeconds: null,
      ready: false,
    };
  }

  const now = Date.now();
  const elapsedMs = now - farmState.plantedAt;
  const remainingSeconds = Math.max(
    0,
    Math.ceil((FARM_GROW_SECONDS * 1000 - elapsedMs) / 1000),
  );

  return {
    plantedAt: new Date(farmState.plantedAt).toISOString(),
    remainingSeconds,
    ready: elapsedMs >= FARM_GROW_SECONDS * 1000,
  };
}

export function getFarmState(): FarmStateResponse {
  return serializeFarmState();
}

export function plantFarm(): FarmStateResponse {
  if (farmState.plantedAt !== null) {
    throw new Error("A plot is already planted.");
  }
  farmState.plantedAt = Date.now();
  return serializeFarmState();
}

export function harvestFarm(): HarvestResponse {
  if (farmState.plantedAt === null) {
    throw new Error("No planted crop to harvest.");
  }

  const elapsedMs = Date.now() - farmState.plantedAt;
  if (elapsedMs < FARM_GROW_SECONDS * 1000) {
    throw new Error("Harvest is not ready yet.");
  }

  farmState.plantedAt = null;
  return {
    gained: FARM_YIELD,
    resources: {
      ...emptyResources,
      crop: FARM_YIELD,
    },
  };
}

export function createMineSession(): MineStartResponse {
  const sessionId = crypto.randomUUID();
  mineSessions.set(sessionId, {
    startedAt: Date.now(),
    clickTarget: MINE_CLICK_TARGET,
  });
  return {
    sessionId,
    clickTarget: MINE_CLICK_TARGET,
  };
}

export function completeMineSession(
  request: MineFinishRequest,
): MineFinishResponse {
  const session = mineSessions.get(request.sessionId);
  if (!session) {
    return {
      success: false,
      gained: 0,
      resources: { ...emptyResources },
    };
  }

  mineSessions.delete(request.sessionId);
  const elapsedMs = Date.now() - session.startedAt;
  const clickCount = request.clicks;
  const minDuration = session.clickTarget * MINE_MIN_MS_PER_CLICK;

  const success = clickCount >= session.clickTarget && elapsedMs >= minDuration;
  return {
    success,
    gained: success ? 1 : 0,
    resources: success
      ? {
          ...emptyResources,
          mineral: 1,
        }
      : { ...emptyResources },
  };
}

export function createFishSession(): FishCastResponse {
  const sessionId = crypto.randomUUID();
  const biteDelayMs =
    Math.floor(Math.random() * (FISH_BITE_DELAY_MAX - FISH_BITE_DELAY_MIN + 1)) +
    FISH_BITE_DELAY_MIN;

  fishSessions.set(sessionId, {
    castAt: Date.now(),
    biteDelayMs,
    resolved: false,
  });

  return {
    sessionId,
    biteDelayMs,
  };
}

export function strikeFishSession(
  request: FishStrikeRequest,
): FishStrikeResponse {
  const session = fishSessions.get(request.sessionId);
  if (!session || session.resolved) {
    return {
      success: false,
      reason: "too_late",
      gained: 0,
      resources: { ...emptyResources },
    };
  }

  session.resolved = true;
  fishSessions.delete(request.sessionId);

  const now = Date.now();
  const reactionTime =
    now - session.castAt - session.biteDelayMs;

  if (reactionTime < 0) {
    return {
      success: false,
      reason: "too_early",
      gained: 0,
      resources: { ...emptyResources },
    };
  }

  if (reactionTime < FISH_MIN_HUMAN_MS) {
    return {
      success: false,
      reason: "too_early",
      gained: 0,
      resources: { ...emptyResources },
    };
  }

  if (reactionTime <= FISH_QTE_WINDOW_MS) {
    return {
      success: true,
      gained: 2,
      resources: {
        ...emptyResources,
        seafood: 2,
      },
    };
  }

  return {
    success: false,
    reason: "too_late",
    gained: 0,
    resources: { ...emptyResources },
  };
}
