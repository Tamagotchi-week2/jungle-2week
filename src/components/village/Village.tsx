"use client";

import { useEffect } from "react";
import { useActiveScene } from "./useActiveScene";
import Hud from "./Hud";
import VillageMap from "./VillageMap";
import VillageOverlay from "./VillageOverlay";

export default function Village() {
  const [activeScene, setActiveScene] = useActiveScene();

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveScene("none");
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [setActiveScene]);

  const mockResources = { crop: 12, mineral: 9, seafood: 6 };
  const mockEggs = { air: 2, land: 1, sea: 0, gold: 0 };

  return (
    <main className="flex min-h-screen flex-col bg-[#111826] text-slate-100 font-mono pixelated">
      <Hud resources={mockResources} eggs={mockEggs} onOpenScene={setActiveScene} />
      <div className="flex-1 overflow-hidden">
        <VillageMap activeScene={activeScene} onOpenScene={setActiveScene} />
      </div>
      <VillageOverlay activeScene={activeScene} onClose={() => setActiveScene("none")} />
    </main>
  );
}
