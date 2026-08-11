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
    cell("ground", false, "house"),
    cell("ground", false, "mailbox"),
    groundCell,
    groundCell,
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
    // 밭 흙 그림 윗줄. 6~8열 전부 밭 블록. 6열은 통로를 겸해야 하니 통행 가능하게 둔다
    wallCell,
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    cell("ground", true, "farm"),
    cell("ground", false, "farm"),
    cell("ground", false, "farm"),
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    wallCell,
  ],
  [
    // 서쪽 울타리(1~5)와 동쪽 덤불(10~13)이 밭을 감싸고, 6~8열 전부 밭 블록(6열만 통행 가능)
    wallCell,
    wallCell,
    wallCell,
    wallCell,
    wallCell,
    wallCell,
    cell("ground", true, "farm"),
    cell("ground", false, "farm"),
    cell("ground", false, "farm"),
    groundCell,
    wallCell,
    wallCell,
    wallCell,
    wallCell,
    wallCell,
  ],
  [
    // 밭/집 구역과 연못/광산 구역을 가르는 생울타리.
    // 밭 시설(3행 7열)은 스스로 통행 불가라 6~8열을 전부 열어 옆으로 돌아갈 수 있게 한다
    wallCell,
    wallCell,
    wallCell,
    wallCell,
    wallCell,
    wallCell,
    groundCell,
    groundCell,
    groundCell,
    wallCell,
    wallCell,
    wallCell,
    wallCell,
    wallCell,
    wallCell,
  ],
  [
    wallCell,
    cell("ground", false, "mine"),
    groundCell,
    groundCell,
    groundCell,
    wallCell,
    wallCell,
    groundCell,
    wallCell,
    wallCell,
    wallCell,
    wallCell,
    wallCell,
    wallCell,
    wallCell,
  ],
  [
    wallCell,
    groundCell,
    groundCell,
    groundCell,
    wallCell,
    wallCell,
    wallCell,
    groundCell,
    wallCell,
    wallCell,
    wallCell,
    wallCell,
    wallCell,
    wallCell,
    wallCell,
  ],
  [
    // 연못가 개방 광장. 6~8열의 옛 3연벽을 없애 통로를 뚫고, 13열에 강가 시설을 둔다
    wallCell,
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    groundCell,
    cell("ground", false, "shore"),
    wallCell,
  ],
  [
    wallCell,
    ...Array(13).fill(groundCell),
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

export function getCellAt(x: number, y: number): VillageCell | null {
  if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) {
    return null;
  }
  return VILLAGE_MAP[y][x] ?? null;
}
