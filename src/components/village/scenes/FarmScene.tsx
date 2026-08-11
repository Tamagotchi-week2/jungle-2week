"use client";

import { useEffect, useState } from "react";
import type { FarmStateResponse, HarvestResponse } from "@/types/api";

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainder
    .toString()
    .padStart(2, "0")}`;
}

export default function FarmScene() {
  const [state, setState] = useState<FarmStateResponse | null>(null);
  const [feedback, setFeedback] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const plantable = state?.plantedAt === null;
  const harvestable = state?.ready === true;

  async function refreshState() {
    try {
      const response = await fetch("/api/gather/farm/state");
      const payload = await response.json();
      if (!response.ok) {
        setFeedback(payload.error ?? "Failed to load farm state.");
        return;
      }
      setState(payload);
    } catch (error) {
      setFeedback("Farm state could not be loaded.");
    }
  }

  async function plant() {
    if (loading) {
      return;
    }
    setLoading(true);
    setFeedback("");

    const response = await fetch("/api/gather/farm/plant", {
      method: "POST",
    });
    const payload = await response.json();
    if (!response.ok) {
      setFeedback(payload.error ?? "Planting failed.");
    } else {
      setState(payload);
      setFeedback("Seed planted. Come back after it grows.");
    }
    setLoading(false);
  }

  async function harvest() {
    if (loading) {
      return;
    }
    setLoading(true);
    setFeedback("");

    const response = await fetch("/api/gather/farm/harvest", {
      method: "POST",
    });
    const payload = await response.json();
    if (!response.ok) {
      setFeedback(payload.error ?? "Harvest failed.");
    } else {
      const result = payload as HarvestResponse;
      setFeedback(`Harvest complete! Gained ${result.gained} crop.`);
      await refreshState();
    }
    setLoading(false);
  }

  useEffect(() => {
    refreshState();
  }, []);

  useEffect(() => {
    if (state?.remainingSeconds == null) {
      return;
    }

    const interval = window.setInterval(() => {
      setState((previousState) => {
        if (!previousState || previousState.remainingSeconds == null) {
          return previousState;
        }

        const nextSeconds = Math.max(0, previousState.remainingSeconds - 1);
        return {
          ...previousState,
          remainingSeconds: nextSeconds,
          ready: nextSeconds === 0,
        };
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [state?.remainingSeconds]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.code !== "Space") {
        return;
      }
      event.preventDefault();

      if (plantable) {
        plant();
        return;
      }

      if (harvestable) {
        harvest();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [plantable, harvestable, loading]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 text-slate-100">
      <section className="relative overflow-hidden rounded-[32px] border border-slate-700/80 bg-slate-950/95 shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('/sprites/farm/bg.png')",
            imageRendering: "pixelated",
          }}
        />
        <div className="absolute inset-0 bg-slate-950/70" />

        <div className="relative space-y-6 p-6">
          <div className="rounded-[28px] border border-slate-800/90 bg-slate-900/90 p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Plot Status</p>
            <p className="mt-3 text-2xl font-semibold text-slate-100">
              {state?.plantedAt ? "Growing" : "Empty Field"}
            </p>
            {state?.plantedAt ? (
              <p className="mt-2 text-sm text-slate-400">
                {state.ready ? "Ready to harvest!" : `Ready in ${formatTime(state.remainingSeconds ?? 0)}`}
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-400">Plant seeds to begin growing crops</p>
            )}
          </div>

          <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-[34px] border border-amber-400/20 bg-slate-900/90 p-5 shadow-[0_0_0_12px_rgba(248,213,113,0.08)]">
            <div className="relative overflow-hidden rounded-[30px] border border-slate-800/90 bg-slate-950/90 p-4">
              <div className="mx-auto flex h-[280px] w-[280px] items-center justify-center rounded-[28px] border border-slate-700/80 bg-slate-900">
                <img
                  src={state?.plantedAt && !state.ready ? "/sprites/farm/crop.png" : "/sprites/farm/seed.png"}
                  alt={state?.plantedAt ? "Growing Crop" : "Seeds"}
                  className="h-32 w-32 object-contain image-rendering-pixelated"
                />
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-slate-800/90 bg-slate-900/90 p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Action</p>
            <p className="mt-3 text-lg text-slate-100 font-semibold">
              Press <span className="text-amber-300">SPACE</span> to {plantable ? "plant seeds" : harvestable ? "harvest crops" : "wait"}
            </p>
            {loading ? (
              <p className="mt-2 text-sm text-slate-400">Processing...</p>
            ) : null}
          </div>

          {feedback ? (
            <div className="rounded-[26px] border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-200">
              {feedback}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
