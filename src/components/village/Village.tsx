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
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#f9f8f5] text-slate-100 font-mono pixelated">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[92%] w-[92%] -translate-x-1/2 -translate-y-1/2 rounded-[3.5rem] border border-slate-600/80 bg-[radial-gradient(circle_at_top_left,rgba(216,183,114,0.15),transparent_35%),linear-gradient(180deg,rgba(88,59,40,0.16),rgba(11,16,29,0.9))] shadow-[inset_0_0_0_2px_rgba(255,255,255,0.04)] ring-1 ring-slate-700/60" />
        <div className="absolute left-10 top-6 h-24 w-72 rounded-full bg-[linear-gradient(90deg,rgba(156,108,70,0.95),rgba(85,58,39,0.96))] shadow-[0_20px_60px_rgba(0,0,0,0.35)]" />
        <div className="absolute right-8 bottom-20 h-28 w-56 rounded-[2.5rem] bg-[linear-gradient(135deg,rgba(103,69,40,0.25),rgba(15,21,33,0.9))] opacity-80 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]" />
      </div>
      <div className="relative z-10 flex-1 overflow-hidden">
        <Hud resources={mockResources} eggs={mockEggs} onOpenScene={setActiveScene} />
        <VillageMap activeScene={activeScene} onOpenScene={setActiveScene} />
      </div>
      <VillageOverlay activeScene={activeScene} onClose={() => setActiveScene("none")} />
    </main>
  );
}
