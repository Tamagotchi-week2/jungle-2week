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
  /** 이미지의 실제 배경 위치에 맞추기 위한 셀 단위 보정값 */
  offsetX?: number;
  offsetY?: number;
}> = {
  house: { label: "House", scene: "house", icon: "🏠", image: "/sprites/buildings/house.webp", scale: 1.8 },
  mailbox: { label: "Mailbox", scene: "mailbox", icon: "✉️", image: "/sprites/buildings/mailbox.webp" },
  farm: { label: "Farm", scene: "farm", icon: "🌾", image: "/sprites/buildings/farm.webp", offsetX: 0.08 },
  mine: { label: "Mine", scene: "mine", icon: "⛏️", image: "/sprites/buildings/mine.webp", scale: 1.6, offsetY: 0.14 },
  shore: { label: "Shore", scene: "shore", icon: "🌊", image: "/sprites/buildings/shore.webp" },
};

// ------------------------------------------------------- 배경 픽셀 좌표 매핑
//
// /sprites/backgrounds/village.webp 원본 크기(1448x1086) 기준. .village-fit 이
// 같은 비율로 렌더링되므로, 격자 한 칸은 이미지 위의 고정된 픽셀 사각형이다.
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

export interface PixelPoint {
  x: number;
  y: number;
}

export interface InteractionCircle {
  kind: "circle";
  type: FacilityType;
  center: PixelPoint;
  radius: number;
}

export interface InteractionPolygon {
  kind: "polygon";
  type: FacilityType;
  points: PixelPoint[];
}

export type InteractionZone = InteractionCircle | InteractionPolygon;

/**
 * 두 번째 기준 이미지에 손으로 표시한 청록색 원/도형을 그대로 좌표로 옮긴 것이다.
 * 격자 칸 경계와는 무관하게, 이미지에 그려진 범위를 있는 그대로 따른다.
 * 모든 값은 village.webp 원본 픽셀(1448x1086) 기준이다.
 */
/**
 * 두 번째 기준 이미지에 손으로 표시한 청록색 원/도형을 그대로 좌표로 옮긴 것이다.
 * 격자 칸 경계와는 무관하게, 이미지에 그려진 범위를 있는 그대로 따른다.
 * 모든 값은 village.webp 원본 픽셀(1448x1086) 기준이다.
 */
export const interactionZones: InteractionZone[] = [
  // house — 집 주변 상호작용 영역
  {
    kind: "circle",
    type: "house",
    center: { x: 235, y: 145 },
    radius: 130,
  },
  // mailbox — 우편함 주변 상호작용 영역
  {
    kind: "circle",
    type: "mailbox",
    center: { x: 345, y: 175 },
    radius: 80,
  },
  // farm — 밭 전체 3x2 영역을 포함하는 상호작용 영역
  {
    kind: "circle",
    type: "farm",
    center: { x: 724, y: 300 },
    radius: 165,
  },
  // mine — 광산 입구 주변 상호작용 영역
  {
    kind: "circle",
    type: "mine",
    center: { x: 185, y: 630 },
    radius: 115,
  },
  // shore — 해안가/강가 물가를 따라 배치된 상호작용 영역
  {
    kind: "polygon",
    type: "shore",
    points: [
      { x: 900, y: 650},
      { x: 900, y: 790 },
      { x: 1230, y: 940 },
      { x: 1380, y: 940 },
      { x: 1380, y: 650 },
    ],
  },
];

export type BlockedZoneName =
  | "edgeTree"
  | "fence"
  | "bush"
  | "pond"
  | "rock"
  | "house"
  | "mailbox"
  | "mine";

export interface BlockedRect extends PixelRect {
  kind: "rect";
  name: BlockedZoneName;
}

export interface BlockedPolygon {
  kind: "polygon";
  name: BlockedZoneName;
  points: PixelPoint[];
}

export type BlockedZone = BlockedRect | BlockedPolygon;

/** 칸 범위(포함) → 이미지 픽셀 사각형. 좌표를 셀 단위로 짚을 때 반올림 오차 없이 정확히 맞추기 위한 헬퍼 */
function cellSpanRect(x0: number, y0: number, x1: number, y1: number): PixelRect {
  return {
    x: x0 * CELL_PIXEL_WIDTH,
    y: y0 * CELL_PIXEL_HEIGHT,
    width: (x1 - x0 + 1) * CELL_PIXEL_WIDTH,
    height: (y1 - y0 + 1) * CELL_PIXEL_HEIGHT,
  };
}

/**
 * 맵은 기본적으로 전부 이동 가능하다. 아래 요소만 예외적으로 막는다.
 *
 * 좌표는 격자 칸과 무관하게, 기준 이미지에 손으로 표시한 빨간 선/사각형을
 * village.webp 원본 픽셀(1448x1086) 기준으로 그대로 옮긴 것이다. VILLAGE_MAP.passable 과
 * 플레이어의 원형 충돌 판정은 전부 이 배열에서 파생된다 — 별도로 손으로 유지하지 않는다.
 */
export const blockedZones: BlockedZone[] = [
  // 맵 외곽 나무 / 울타리 경계
  { kind: "rect", name: "edgeTree", x: 0, y: 0, width: 96, height: 1086 },
  { kind: "rect", name: "edgeTree", x: 0, y: 0, width: 670, height: 96 },
  { kind: "rect", name: "edgeTree", x: 770, y: 0, width: 678, height: 96 },
  { kind: "rect", name: "edgeTree", x: 1352, y: 0, width: 96, height: 1086 },
  { kind: "rect", name: "edgeTree", x: 0, y: 990, width: 670, height: 96 },
  { kind: "rect", name: "edgeTree", x: 770, y: 990, width: 582, height: 96 },

  // 집 & 우편함 (좌상단)
  { kind: "rect", name: "house", x: 140, y: 20, width: 195, height: 180 },
  { kind: "rect", name: "mailbox", x: 310, y: 110, width: 55, height: 90 },

  // 중단 좌측 울타리, 풀숲 및 광산 입구
  { kind: "rect", name: "fence", x: 96, y: 500, width: 500, height: 60 },
  { kind: "rect", name: "bush", x: 480, y: 560, width: 195, height: 120 },
  { kind: "rect", name: "mine", x: 40, y: 550, width: 195, height: 120 },

  // 중단 우측 울타리 및 풀숲
  { kind: "rect", name: "fence", x: 850, y: 500, width: 500, height: 75 },
  { kind: "rect", name: "bush", x: 760, y: 575, width: 100, height: 110 },

  // 연못 / 강물 (계단식 바위 해안선 및 우측 하단 깊은 수역)
  {
    kind: "polygon",
    name: "pond",
    points: [
      { x: 860, y: 570 }, 
      { x: 860, y: 700 }, 
      { x: 950, y: 700 }, 
      { x: 950, y: 730 }, 
      { x: 1050, y: 760 }, 
      { x: 1170, y: 820 }, 
      { x: 1300, y: 870 },  
      { x: 1448, y: 950 }, 
      { x: 1448, y: 570 }, 
    ],
  },
];

function rectsOverlap(a: PixelRect, b: PixelRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function pointInRect(px: number, py: number, rect: PixelRect): boolean {
  return px >= rect.x && px <= rect.x + rect.width && py >= rect.y && py <= rect.y + rect.height;
}

function pointInPolygon(px: number, py: number, points: PixelPoint[]): boolean {
  let inside = false;

  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const current = points[i];
    const previous = points[j];
    if (orientation(previous, current, { x: px, y: py }) === 0 && onSegment(previous, current, { x: px, y: py })) {
      return true;
    }
    const crosses =
      current.y > py !== previous.y > py &&
      px < ((previous.x - current.x) * (py - current.y)) / (previous.y - current.y) + current.x;

    if (crosses) {
      inside = !inside;
    }
  }

  return inside;
}

function getInteractionZoneBounds(zone: InteractionZone): PixelRect {
  if (zone.kind === "circle") {
    return {
      x: zone.center.x - zone.radius,
      y: zone.center.y - zone.radius,
      width: zone.radius * 2,
      height: zone.radius * 2,
    };
  }

  const xs = zone.points.map((point) => point.x);
  const ys = zone.points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

export { getInteractionZoneBounds };

export function isPixelWithinInteractionZone(px: number, py: number, zone: InteractionZone): boolean {
  if (zone.kind === "circle") {
    return (px - zone.center.x) ** 2 + (py - zone.center.y) ** 2 <= zone.radius ** 2;
  }

  return pointInPolygon(px, py, zone.points);
}

function orientation(a: PixelPoint, b: PixelPoint, c: PixelPoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a: PixelPoint, b: PixelPoint, point: PixelPoint): boolean {
  return (
    point.x >= Math.min(a.x, b.x) &&
    point.x <= Math.max(a.x, b.x) &&
    point.y >= Math.min(a.y, b.y) &&
    point.y <= Math.max(a.y, b.y)
  );
}

function segmentsIntersect(a: PixelPoint, b: PixelPoint, c: PixelPoint, d: PixelPoint): boolean {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);

  if (((abC > 0 && abD < 0) || (abC < 0 && abD > 0)) && ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0))) {
    return true;
  }

  return (
    (abC === 0 && onSegment(a, b, c)) ||
    (abD === 0 && onSegment(a, b, d)) ||
    (cdA === 0 && onSegment(c, d, a)) ||
    (cdB === 0 && onSegment(c, d, b))
  );
}

function polygonOverlapsRect(points: PixelPoint[], rect: PixelRect): boolean {
  const corners: PixelPoint[] = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x, y: rect.y + rect.height },
    { x: rect.x + rect.width, y: rect.y + rect.height },
  ];

  if (corners.some((corner) => pointInPolygon(corner.x, corner.y, points))) {
    return true;
  }

  if (points.some((point) => pointInRect(point.x, point.y, rect))) {
    return true;
  }

  const rectEdges: Array<[PixelPoint, PixelPoint]> = [
    [corners[0], corners[1]],
    [corners[1], corners[3]],
    [corners[3], corners[2]],
    [corners[2], corners[0]],
  ];

  return points.some((point, index) => {
    const next = points[(index + 1) % points.length];
    return rectEdges.some(([start, end]) => segmentsIntersect(point, next, start, end));
  });
}

function zoneOverlapsRect(zone: BlockedZone, rect: PixelRect): boolean {
  return zone.kind === "rect" ? rectsOverlap(zone, rect) : polygonOverlapsRect(zone.points, rect);
}

function pointBlockedByZone(px: number, py: number, zone: BlockedZone): boolean {
  return zone.kind === "rect" ? pointInRect(px, py, zone) : pointInPolygon(px, py, zone.points);
}

function distanceToSegmentSquared(point: PixelPoint, start: PixelPoint, end: PixelPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return (point.x - start.x) ** 2 + (point.y - start.y) ** 2;
  }

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  const nearest = { x: start.x + t * dx, y: start.y + t * dy };
  return (point.x - nearest.x) ** 2 + (point.y - nearest.y) ** 2;
}

/** 칸(x,y)이 blockedZones 중 하나와 겹치는지. 겹치면 그 칸은 이동 불가다 */
export function isCellBlocked(x: number, y: number): boolean {
  const rect = cellSpanRect(x, y, x, y);
  return blockedZones.some((zone) => zoneOverlapsRect(zone, rect));
}

/** 이미지 픽셀 좌표가 blockedZones 중 하나에 속하는지 */
export function isPixelBlocked(px: number, py: number): boolean {
  if (px < 0 || py < 0 || px >= MAP_IMAGE_WIDTH || py >= MAP_IMAGE_HEIGHT) {
    return true;
  }
  return blockedZones.some((zone) => pointBlockedByZone(px, py, zone));
}

function circleOverlapsRect(cx: number, cy: number, radius: number, rect: PixelRect): boolean {
  const nearestX = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
  const nearestY = Math.max(rect.y, Math.min(cy, rect.y + rect.height));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy < radius * radius;
}

function circleOverlapsPolygon(cx: number, cy: number, radius: number, points: PixelPoint[]): boolean {
  if (pointInPolygon(cx, cy, points)) {
    return true;
  }

  const center = { x: cx, y: cy };
  return points.some((point, index) => {
    const next = points[(index + 1) % points.length];
    return distanceToSegmentSquared(center, point, next) < radius * radius;
  });
}

function circleOverlapsZone(cx: number, cy: number, radius: number, zone: BlockedZone): boolean {
  return zone.kind === "rect"
    ? circleOverlapsRect(cx, cy, radius, zone)
    : circleOverlapsPolygon(cx, cy, radius, zone.points);
}

export function getBlockedZoneBounds(zone: BlockedZone): PixelRect {
  if (zone.kind === "rect") {
    return zone;
  }
  const xs = zone.points.map((point) => point.x);
  const ys = zone.points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** 플레이어 원형 히트박스가 이미지상의 장애물이나 맵 바깥과 겹치는지 확인한다. */
export function isPixelCircleBlocked(px: number, py: number, radius: number): boolean {
  if (
    px - radius < 0 ||
    py - radius < 0 ||
    px + radius > MAP_IMAGE_WIDTH ||
    py + radius > MAP_IMAGE_HEIGHT
  ) {
    return true;
  }

  return blockedZones.some((zone) => circleOverlapsZone(px, py, radius, zone));
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
 * 시설 배치와 UI가 참조하는 격자 메타데이터다. 실제 플레이어 이동 충돌은
 * blockedZones의 픽셀 히트박스를 직접 사용하는 isPixelCircleBlocked가 담당한다.
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
