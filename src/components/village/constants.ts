export const MAP_WIDTH = 15;
export const MAP_HEIGHT = 11;

export type TileType = "ground" | "wall";
export type FacilityType = "house" | "mailbox" | "farm" | "mine" | "shore";

export interface VillageCell {
  tile: TileType;
  passable: boolean;
  facility?: FacilityType;
}

export const TILE_IMAGE_BY_TYPE: Record<TileType, string> = {
  ground: "ground",
  wall: "wall",
};

export const FACILITY_BY_TYPE: Record<FacilityType, {
  label: string;
  scene: FacilityType;
  icon: string;
  image: string;
  /** 셀 크기를 넘어 시각적으로 더 크게 그릴 배율. 앵커는 하단 중앙 */
  scale?: number;
}> = {
  house: { label: "House", scene: "house", icon: "🏠", image: "/sprites/buildings/house.png", scale: 1.8 },
  mailbox: { label: "Mailbox", scene: "mailbox", icon: "✉️", image: "/sprites/buildings/mailbox.png" },
  farm: { label: "Farm", scene: "farm", icon: "🌾", image: "/sprites/buildings/farm.png" },
  mine: { label: "Mine", scene: "mine", icon: "⛏️", image: "/sprites/buildings/mine.png", scale: 1.6 },
  shore: { label: "Shore", scene: "shore", icon: "🌊", image: "/sprites/buildings/shore.png" },
};

// ------------------------------------------------------- 배경 픽셀 좌표 매핑
//
// /sprites/backgrounds/village.png 원본 크기(1448x1086) 기준. .village-fit 이
// aspect-ratio: 15/11 로 이 이미지를 꽉 채우므로, 격자 한 칸은 곧 이미지 위의
// 고정된 픽셀 사각형이다.
export const MAP_IMAGE_WIDTH = 1448;
export const MAP_IMAGE_HEIGHT = 1086;
export const CELL_PIXEL_WIDTH = MAP_IMAGE_WIDTH / MAP_WIDTH;
export const CELL_PIXEL_HEIGHT = MAP_IMAGE_HEIGHT / MAP_HEIGHT;

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type BlockedZoneName = "fence" | "beach" | "edgeTree" | "house" | "mailbox" | "mine";

export interface BlockedZone extends PixelRect {
  name: BlockedZoneName;
}

/** 칸 범위(포함) → 이미지 픽셀 사각형. 좌표를 셀 단위로 짚을 때 반올림 오차 없이 정확히 맞추기 위한 헬퍼 */
function cellSpanRect(x0: number, y0: number, x1: number, y1: number): PixelRect {
  return {
    x: x0 * CELL_PIXEL_WIDTH,
    y: y0 * CELL_PIXEL_HEIGHT,
    width: (x1 - x0 + 1) * CELL_PIXEL_WIDTH,
    height: (y1 - y0 + 1) * CELL_PIXEL_HEIGHT,
  };
}

function zone(name: BlockedZoneName, x0: number, y0: number, x1: number, y1: number): BlockedZone {
  return { name, ...cellSpanRect(x0, y0, x1, y1) };
}

/**
 * 맵은 기본적으로 전부 이동 가능하다. 아래 6종 요소만 예외적으로 막는다:
 * 울타리(fence) · 해변(beach) · 가장자리 나무(edgeTree) · 집(house) · 우편함(mailbox) · 광산(mine).
 *
 * 좌표는 /sprites/backgrounds/village.png(1448x1086) 픽셀 기준이며, 이름을 붙여 둬서
 * 나중에 이 배열만 보고 좌표를 조정할 수 있다. VILLAGE_MAP.passable 은 전부 이 배열에서
 * 파생된다 — 별도로 손으로 유지하면 이동 로직과 실제 그림이 어긋날 수 있어 여기서만 정의한다.
 */
export const blockedZones: BlockedZone[] = [
  // edgeTree — 사방을 두른 나무·덤불 테두리 (맨 위/아래 행, 맨 왼쪽/오른쪽 열)
  zone("edgeTree", 0, 0, MAP_WIDTH - 1, 0),
  zone("edgeTree", 0, MAP_HEIGHT - 1, MAP_WIDTH - 1, MAP_HEIGHT - 1),
  zone("edgeTree", 0, 0, 0, MAP_HEIGHT - 1),
  zone("edgeTree", MAP_WIDTH - 1, 0, MAP_WIDTH - 1, MAP_HEIGHT - 1),

  // fence — 밭/집 구역과 연못/광산 구역을 가르는 생울타리. 6~8열은 그림상 흙길이라 열어 둔다
  zone("fence", 1, 5, 5, 5),
  zone("fence", 9, 5, 13, 5),
  // fence — 그 아래 오솔길을 감싸는 덤불·그루터기 무리. 7열은 통로라 열어 둔다
  zone("fence", 4, 6, 6, 6),
  zone("fence", 8, 6, 13, 6),

  // beach — 연못(수면) 영역
  zone("beach", 10, 5, 13, 8),

  // house / mailbox — 마을 초입 건물 두 채
  zone("house", 2, 1, 2, 1),
  zone("mailbox", 3, 1, 3, 1),

  // mine — 7행의 개방 광장(상호작용 그리드)과 바로 맞닿도록 6행에 배치
  zone("mine", 1, 6, 1, 6),
];

function rectsOverlap(a: PixelRect, b: PixelRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** 칸(x,y)이 blockedZones 중 하나와 겹치는지. 겹치면 그 칸은 이동 불가다 */
export function isCellBlocked(x: number, y: number): boolean {
  const rect = cellSpanRect(x, y, x, y);
  return blockedZones.some((zoneRect) => rectsOverlap(rect, zoneRect));
}

/** 이미지 픽셀 좌표가 blockedZones 중 하나에 속하는지 */
export function isPixelBlocked(px: number, py: number): boolean {
  if (px < 0 || py < 0 || px >= MAP_IMAGE_WIDTH || py >= MAP_IMAGE_HEIGHT) {
    return true;
  }
  const point: PixelRect = { x: px, y: py, width: 0, height: 0 };
  return blockedZones.some((zoneRect) => rectsOverlap(point, zoneRect));
}

interface FacilityPlacement {
  type: FacilityType;
  x: number;
  y: number;
}

const FACILITY_PLACEMENTS: FacilityPlacement[] = [
  { type: "house", x: 2, y: 1 },
  { type: "mailbox", x: 3, y: 1 },
  { type: "farm", x: 6, y: 2 },
  { type: "farm", x: 7, y: 2 },
  { type: "farm", x: 8, y: 2 },
  { type: "farm", x: 6, y: 3 },
  { type: "farm", x: 7, y: 3 },
  { type: "farm", x: 8, y: 3 },
  { type: "mine", x: 1, y: 6 },
  { type: "shore", x: 10, y: 7 },
];

/**
 * 캐릭터 이동 시 실제로 참조하는 격자. passable 은 오직 blockedZones 와의 충돌
 * 여부로만 정해진다 — 그 외 칸은 전부 자유롭게 이동 가능하다.
 */
export const VILLAGE_MAP: VillageCell[][] = Array.from({ length: MAP_HEIGHT }, (_, y) =>
  Array.from({ length: MAP_WIDTH }, (_, x) => {
    const blocked = isCellBlocked(x, y);
    const facility = FACILITY_PLACEMENTS.find((placement) => placement.x === x && placement.y === y)?.type;
    return {
      tile: blocked ? "wall" : "ground",
      passable: !blocked,
      facility,
    } satisfies VillageCell;
  }),
);

export const MAP_START = { x: 7, y: 9 };

export function getCellAt(x: number, y: number): VillageCell | null {
  if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) {
    return null;
  }
  return VILLAGE_MAP[y][x] ?? null;
}
