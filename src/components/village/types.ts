export type VillageScene =
  | "none"
  | "house"
  | "mailbox"
  | "farm"
  | "mine"
  | "shore"
  | "dex"
  | "trade";

export const villageSceneLabels: Record<Exclude<VillageScene, "none">, string> = {
  house: "House",
  mailbox: "Mailbox",
  farm: "Farm",
  mine: "Mine",
  shore: "Shore",
  dex: "Dex",
  trade: "Trade",
};
