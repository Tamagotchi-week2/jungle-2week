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
}> = {
  house: { label: "House", scene: "house", icon: "🏠", image: "/sprites/buildings/house.png" },
  mailbox: { label: "Mailbox", scene: "mailbox", icon: "✉️", image: "/sprites/buildings/mailbox.png" },
  farm: { label: "Farm", scene: "farm", icon: "🌾", image: "/sprites/buildings/farm.png" },
  mine: { label: "Mine", scene: "mine", icon: "⛏️", image: "/sprites/buildings/mine.png" },
  shore: { label: "Shore", scene: "shore", icon: "🌊", image: "/sprites/buildings/shore.png" },
};

const wallCell = { tile: "wall", passable: false };
const groundCell = { tile: "ground", passable: true };

function cell(tile: TileType, passable: boolean, facility?: FacilityType): VillageCell {
  return { tile, passable, facility };
}

export const VILLAGE_MAP: VillageCell[][] = [
  Array(MAP_WIDTH).fill(wallCell),
  [
    wallCell,
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    cell("ground", false, "farm"),
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    wallCell,
  ],
  [
    wallCell,
    ...Array(13).fill(groundCell),
    wallCell,
  ],
  [
    wallCell,
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    wallCell,
    wallCell,
    wallCell,
    groundCell,
    groundCell,
    cell("ground", false, "mine"),
    groundCell,
    groundCell,
    wallCell,
  ],
  [
    wallCell,
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    wallCell,
    groundCell,
    wallCell,
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    wallCell,
  ],
  [
    wallCell,
    groundCell,
    groundCell,
    cell("ground", false, "house"),
    cell("ground", false, "mailbox"),
    groundCell,
    wallCell,
    groundCell,
    wallCell,
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    wallCell,
  ],
  [
    wallCell,
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    wallCell,
    groundCell,
    wallCell,
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    wallCell,
  ],
  [
    wallCell,
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    wallCell,
    wallCell,
    wallCell,
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    wallCell,
  ],
  [
    wallCell,
    ...Array(11).fill(groundCell),
    cell("ground", false, "shore"),
    groundCell,
    wallCell,
  ],
  [
    wallCell,
    ...Array(13).fill(groundCell),
    wallCell,
  ],
  Array(MAP_WIDTH).fill(wallCell),
];

export const MAP_START = { x: 7, y: 9 };

export const PLAYER_FACING_ICONS = {
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
} as const;

export function getCellAt(x: number, y: number): VillageCell | null {
  if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) {
    return null;
  }
  return VILLAGE_MAP[y][x] ?? null;
}
