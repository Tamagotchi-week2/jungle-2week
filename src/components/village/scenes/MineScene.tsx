"use client";

import { useEffect, useState } from "react";

import { useMe } from "../MeContext";
import type { MineFinishResponse, MineStartResponse } from "@/types/api";

const CLICK_TARGET = 35;

export default function MineScene() {
  const { refresh } = useMe();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [clicks, setClicks] = useState(0);
  const [target, setTarget] = useState(CLICK_TARGET);
  const [status, setStatus] = useState("Press Space to start mining.");
  const [feedback, setFeedback] = useState("Awaiting your first mine.");
  const [loading, setLoading] = useState(false);

  async function startMine() {
    if (loading) {
      return;
    }
    setLoading(true);
    setFeedback("Starting mine session...");

    const response = await fetch("/api/gather/mine/start", {
      method: "POST",
    });
    const payload = await response.json();
    setLoading(false);

    if (!response.ok) {
      setFeedback(payload?.error ?? "Could not start mining.");
      return;
    }

    const data = payload as MineStartResponse;
    setSessionId(data.sessionId);
    setTarget(data.clickTarget);
    setClicks(0);
    setStatus("Tap Space to mine.");
    setFeedback("Mining started. Press Space 35 times.");
  }

  async function completeMine() {
    if (!sessionId || loading) {
      return;
    }
    setLoading(true);
    setFeedback("Submitting mine result...");

    const response = await fetch("/api/gather/mine/finish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, clicks }),
    });
    const payload = (await response.json()) as MineFinishResponse;
    setLoading(false);
    setSessionId(null);
    setClicks(0);
    setTarget(CLICK_TARGET);

    if (!response.ok || !payload.success) {
      setStatus("Mine failed.");
      setFeedback("Too fast or insufficient clicks. Try again.");
      return;
    }

    setStatus("Mine complete!");
    setFeedback(`Gained ${payload.gained} mineral.`);
    await refresh();
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.code !== "Space") {
        return;
      }
      event.preventDefault();

      if (loading) {
        return;
      }

      if (!sessionId) {
        startMine();
        return;
      }

      setClicks((current) => {
        const nextCount = Math.min(target, current + 1);
        if (nextCount === target) {
          completeMine();
        }
        return nextCount;
      });
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loading, sessionId, target]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 text-slate-100">
      <section className="relative overflow-hidden rounded-[32px] border border-slate-700/80 bg-slate-950/95 shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('/sprites/mine/bg.png')",
            imageRendering: "pixelated",
          }}
        />
        <div className="absolute inset-0 bg-slate-950/70" />

        <div className="relative space-y-6 p-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <div className="rounded-[28px] border border-slate-800/90 bg-slate-900/90 p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Mining Progress</p>
              <p className="mt-3 text-2xl font-semibold text-slate-100">
                {sessionId ? `${clicks} / ${target}` : "Ready"}
              </p>
              <p className="mt-2 text-sm text-slate-400">{status}</p>
            </div>
            <div className="rounded-[28px] border border-slate-800/90 bg-slate-900/90 p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Result</p>
              <p className="mt-3 text-lg font-semibold text-emerald-200">{feedback}</p>
              {loading && <p className="mt-2 text-sm text-slate-400">Processing...</p>}
            </div>
          </div>

          <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-[34px] border border-amber-400/20 bg-slate-900/90 p-5 shadow-[0_0_0_12px_rgba(248,213,113,0.08)]">
            <div className="relative overflow-hidden rounded-[30px] border border-slate-800/90 bg-slate-950/90 p-4">
              <div className="mx-auto flex h-[280px] w-[280px] items-center justify-center rounded-[28px] border border-slate-700/80 bg-slate-900">
                <img
                  src="/sprites/mine/pickaxe.png"
                  alt="Pickaxe"
                  className="h-40 w-40 object-contain image-rendering-pixelated"
                />
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-slate-800/90 bg-slate-900/90 p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Action</p>
            <p className="mt-3 text-lg text-slate-100 font-semibold">
              Press <span className="text-amber-300">SPACE</span> {sessionId ? `(${target - clicks} more times)` : "to start mining"}
            </p>
            {loading ? <p className="mt-2 text-sm text-slate-400">Processing...</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
