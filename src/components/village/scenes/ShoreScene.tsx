"use client";

import { useEffect, useMemo, useState } from "react";
import type { FishCastResponse, FishStrikeResponse } from "@/types/api";

const QTE_WINDOW_MS = 700;

function formatTime(seconds: number) {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${whole}s`;
}

export default function ShoreScene() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "casting" | "bite" | "result">("idle");
  const [biteDelayMs, setBiteDelayMs] = useState<number>(0);
  const [timerMs, setTimerMs] = useState<number>(0);
  const [message, setMessage] = useState("Press Space to cast.");
  const [feedback, setFeedback] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const isWaiting = state === "casting";
  const isBiteActive = state === "bite";

  const buttonLabel = useMemo(() => {
    if (state === "idle") {
      return "Press Space to cast.";
    }
    if (state === "casting") {
      return "Waiting for bite...";
    }
    if (state === "bite") {
      return "Press Space to strike!";
    }
    return "Press Space to cast again.";
  }, [state]);

  async function cast() {
    if (loading) {
      return;
    }
    setLoading(true);
    setFeedback("");

    const response = await fetch("/api/gather/fish/cast", {
      method: "POST",
    });
    const payload = (await response.json()) as FishCastResponse;
    setLoading(false);

    if (!response.ok) {
      setFeedback("Could not cast.");
      return;
    }

    setSessionId(payload.sessionId);
    setBiteDelayMs(payload.biteDelayMs);
    setTimerMs(payload.biteDelayMs);
    setState("casting");
    setMessage("Waiting for a bite...");
  }

  async function strike() {
    if (loading || !sessionId) {
      return;
    }
    setLoading(true);
    setFeedback("");

    const response = await fetch("/api/gather/fish/strike", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    const payload = (await response.json()) as FishStrikeResponse;
    setLoading(false);
    setSessionId(null);

    if (payload.success) {
      setState("result");
      setMessage("Success! Fish caught.");
      setFeedback(`Gained ${payload.gained} seafood.`);
      return;
    }

    setState("result");
    setMessage("Bite missed.");
    setFeedback(
      payload.reason === "too_early"
        ? "You struck too early. Wait for the signal."
        : "You were too late. Try again.",
    );
  }

  useEffect(() => {
    if (state !== "casting") {
      return;
    }

    const interval = window.setInterval(() => {
      setTimerMs((current) => Math.max(0, current - 100));
    }, 100);

    const timeout = window.setTimeout(() => {
      setState("bite");
      setTimerMs(QTE_WINDOW_MS);
      setMessage("Bite! Press Space quickly.");
    }, biteDelayMs);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [biteDelayMs, state]);

  useEffect(() => {
    if (state !== "bite") {
      return;
    }

    const interval = window.setInterval(() => {
      setTimerMs((current) => Math.max(0, current - 50));
    }, 50);

    const timeout = window.setTimeout(() => {
      setState("result");
      setSessionId(null);
      setMessage("No strike received.");
      setFeedback("The fish escaped.");
    }, QTE_WINDOW_MS);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [state]);

  useEffect(() => {
    if (state !== "result") {
      return;
    }

    const timeout = window.setTimeout(() => {
      setState("idle");
      setMessage("Press Space to cast again.");
      setFeedback("");
      setTimerMs(0);
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [state]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.code !== "Space") {
        return;
      }
      event.preventDefault();

      if (loading) {
        return;
      }

      if (state === "idle") {
        cast();
        return;
      }

      if (state === "bite") {
        strike();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state, loading, sessionId]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 text-slate-100">
      <section className="relative overflow-hidden rounded-[32px] border border-slate-700/80 bg-slate-950/95 shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('/sprites/shore/bg.png')",
            imageRendering: "pixelated",
          }}
        />
        <div className="absolute inset-0 bg-slate-950/70" />

        <div className="relative space-y-6 p-6">
          <div className="rounded-[28px] border border-slate-800/90 bg-slate-900/90 p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Fishing Status</p>
            <p className="mt-3 text-2xl font-semibold text-slate-100">{message}</p>
            {isBiteActive && (
              <div className="mt-3 flex items-center gap-2">
                <div className="h-2 w-40 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-all"
                    style={{ width: `${Math.max(0, (timerMs / QTE_WINDOW_MS) * 100)}%` }}
                  />
                </div>
                <p className="text-sm text-amber-300">{formatTime(timerMs / 1000)}</p>
              </div>
            )}
            {isWaiting && (
              <div className="mt-3">
                <div className="h-2 w-40 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-400 transition-all"
                    style={{ width: `${Math.max(0, ((biteDelayMs - timerMs) / biteDelayMs) * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-slate-400">{formatTime(timerMs / 1000)} until bite...</p>
              </div>
            )}
          </div>

          <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-[34px] border border-amber-400/20 bg-slate-900/90 p-5 shadow-[0_0_0_12px_rgba(248,213,113,0.08)]">
            <div className="relative overflow-hidden rounded-[30px] border border-slate-800/90 bg-slate-950/90 p-4">
              <div className="mx-auto flex h-[280px] w-[280px] items-center justify-center rounded-[28px] border border-slate-700/80 bg-slate-900">
                {state === "bite" ? (
                  <div className="animate-bounce">
                    <img src="/sprites/shore/bobber.png" alt="Bobber" className="h-16 w-16 object-contain image-rendering-pixelated" />
                  </div>
                ) : (
                  <img src="/sprites/shore/rod.png" alt="Fishing Rod" className="h-48 w-40 object-contain image-rendering-pixelated" />
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-slate-800/90 bg-slate-900/90 p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Action</p>
            <p className="mt-3 text-lg text-slate-100 font-semibold">
              Press <span className="text-amber-300">SPACE</span> {state === "bite" ? "to strike!" : "to cast"}
            </p>
            {loading ? <p className="mt-2 text-sm text-slate-400">Processing...</p> : null}
          </div>

          {feedback && (
            <div className="rounded-[26px] border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-200">
              {feedback}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
