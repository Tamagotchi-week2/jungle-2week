"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useMe } from "../MeContext";
import { BALANCE } from "@/lib/game/constants";
import { judgeFish, type FishFailReason } from "@/lib/game/gather";
import type { FishCastResponse, FishStrikeResponse } from "@/types/api";

const QTE_WINDOW_MS = BALANCE.FISH_QTE_WINDOW_MS;

/**
 * 대기 게이지는 **항상 최대치(9초)** 를 채운다.
 *
 * 게이지 길이를 그때그때의 입질 지연에 맞추면, 게이지가 비는 순간이 곧 입질
 * 시점이라 유저가 미리 알 수 있다. 예측 불가여야 하는 QTE 가 무의미해진다.
 * 고정 길이로 두면 게이지 도중 어느 지점에서 갑자기 입질이 온다.
 */
const WAIT_GAUGE_MS = BALANCE.FISH_BITE_DELAY_MAX;

function formatTime(seconds: number) {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${whole}s`;
}

export default function ShoreScene() {
  const { refresh } = useMe();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [state, setState] = useState<
    "idle" | "casting" | "bite" | "resolving" | "result"
  >("idle");
  const [biteDelayMs, setBiteDelayMs] = useState<number>(0);
  const [timerMs, setTimerMs] = useState<number>(0);
  /** 대기 중 경과 시간(ms). 게이지는 이 값을 WAIT_GAUGE_MS 로 나눠 그린다 */
  const [waitedMs, setWaitedMs] = useState<number>(0);
  const [message, setMessage] = useState("Press Space to cast.");
  const [feedback, setFeedback] = useState<string>("");
  /**
   * 입질을 화면에 표시한 시각(performance.now 기준).
   * 반응시간을 여기서부터 재야 왕복 지연이 섞이지 않는다.
   */
  const biteShownAtRef = useRef<number | null>(null);
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
    biteShownAtRef.current = null;
    setWaitedMs(0);
    setState("casting");
    setMessage("Waiting for a bite...");
  }

  /** 판정 결과를 화면 문구로 옮긴다. 로컬 판정과 서버 판정이 같은 표현을 쓴다 */
  function showVerdict(verdict: {
    success: boolean;
    reason?: FishFailReason;
  }) {
    if (verdict.success) {
      setMessage("잡았다!");
      setFeedback("");
      return;
    }
    if (verdict.reason === "too_early") {
      setMessage("너무 일찍 챘다...");
      setFeedback("입질을 기다렸다가 채야 합니다.");
      return;
    }
    setMessage("놓쳤다...");
    setFeedback("한 발 늦었습니다.");
  }

  async function strike() {
    if (loading || !sessionId || state === "resolving") {
      return;
    }
    const struckDuringWait = state === "casting";
    // 대기 중 입력은 반응시간이 없다. 0 을 보내면 서버가 too_early 로 판정한다.
    const reactionMs =
      biteShownAtRef.current === null
        ? 0
        : Math.max(0, Math.round(performance.now() - biteShownAtRef.current));

    // 판정을 로컬에서 끝낸다. 서버 왕복을 기다리면 결과가 늦게 뜨고, 지연이 큰
    // 순간에는 입력이 씹힌 것처럼 느껴진다. 서버도 같은 규칙으로 다시 판정한다.
    const verdict = judgeFish(struckDuringWait ? 0 : reactionMs);

    setLoading(true);
    // 타이머를 멈춘다. casting/bite 로 남겨두면 응답 전에 "입질"이나 "놓침"이
    // 화면을 덮어쓴다.
    setState("resolving");
    showVerdict(verdict);

    const response = await fetch("/api/gather/fish/strike", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, reactionMs }),
    });
    const payload = (await response.json()) as FishStrikeResponse;
    setLoading(false);
    setSessionId(null);
    setState("result");

    if (!response.ok) {
      setMessage("판정에 실패했다.");
      setFeedback("서버와 통신하지 못했습니다.");
      return;
    }

    // 서버가 다른 결론을 냈다면 서버 쪽이 맞다. 자원을 쥔 쪽이 서버다.
    if (payload.success !== verdict.success) {
      showVerdict({ success: payload.success, reason: payload.reason });
    }

    if (payload.success) {
      setFeedback(`어패류 ${payload.gained}개 획득!`);
      await refresh();
    }
  }

  useEffect(() => {
    if (state !== "casting") {
      return;
    }

    const interval = window.setInterval(() => {
      setWaitedMs((current) => Math.min(WAIT_GAUGE_MS, current + 100));
    }, 100);

    const timeout = window.setTimeout(() => {
      biteShownAtRef.current = performance.now();
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

      // 대기 중 입력도 서버로 보낸다. 반응시간이 음수라 too_early 로 판정된다.
      // 무시해 버리면 "일찍 누르면 실패한다"는 규칙이 성립하지 않는다.
      if (state === "casting" || state === "bite") {
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
                {/* 게이지는 항상 9초 기준. 입질은 그 도중 어느 지점에서 갑자기 온다 */}
                <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-700">
                  <div
                    className="h-full bg-blue-400"
                    style={{ width: `${(waitedMs / WAIT_GAUGE_MS) * 100}%` }}
                  />
                </div>
                {/* 남은 시간을 숫자로 보여주면 입질 시점이 드러난다 */}
                <p className="mt-2 text-sm text-slate-400">
                  찌를 지켜보세요. 일찍 누르면 놓칩니다.
                </p>
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
