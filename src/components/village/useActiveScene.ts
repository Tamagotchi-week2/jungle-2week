"use client";

import { useState } from "react";
import type { VillageScene } from "./types";

export function useActiveScene(initialScene: VillageScene = "none") {
  return useState<VillageScene>(initialScene);
}
