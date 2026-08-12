"use client";

import { useEffect, useRef, useState } from "react";

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
  const [message, setMessage] = useState("스페이스바를 눌러 낚싯대를 던지세요.");
  const [feedback, setFeedback] = useState<string>("");
  /**
   * 입질을 화면에 표시한 시각(performance.now 기준).
   * 반응시간을 여기서부터 재야 왕복 지연이 섞이지 않는다.
   */
  const biteShownAtRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(false);

  const isWaiting = state === "casting";
  const isBiteActive = state === "bite";

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
      setFeedback("낚싯대를 던지지 못했습니다.");
      return;
    }

    setSessionId(payload.sessionId);
    setBiteDelayMs(payload.biteDelayMs);
    biteShownAtRef.current = null;
    setWaitedMs(0);
    setState("casting");
    setMessage("찌를 바라보며 입질을 기다리세요.");
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
      setMessage("입질이다! 빠르게 스페이스바를 누르세요!");
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
      setMessage("물고기를 놓쳤다...");
      setFeedback("물고기가 도망갔습니다.");
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
      setMessage("스페이스바를 눌러 다시 낚시하세요.");
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
      if (event.repeat) {
        return;
      }

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
    <div className="shore-scene mx-auto max-w-5xl px-4 py-6 text-slate-100">
      <section className="shore-stage relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('/sprites/shore/bg.png')",
            imageRendering: "pixelated",
          }}
        />
        <div className="absolute inset-0 bg-slate-950/45" />

        <div className="shore-layout relative p-6">
          <div className="shore-status-card p-5">
            <p className="shore-card-label text-xs tracking-[0.24em]">낚시 상태</p>
            <p className="shore-status-message mt-3 text-xl font-semibold">{message}</p>
            <div className="shore-gauge-space mt-3">
            {isBiteActive && (
              <div className="flex items-center gap-2">
                <div className="shore-gauge overflow-hidden">
                  <div
                    className="shore-gauge-fill shore-gauge-bite"
                    style={{ width: `${Math.max(0, (timerMs / QTE_WINDOW_MS) * 100)}%` }}
                  />
                </div>
                <p className="text-sm text-amber-200">{formatTime(timerMs / 1000)}</p>
              </div>
            )}
            {isWaiting && (
              <div>
                {/* 게이지는 항상 9초 기준. 입질은 그 도중 어느 지점에서 갑자기 온다 */}
                <div className="shore-gauge overflow-hidden">
                  <div
                    className="shore-gauge-fill shore-gauge-wait"
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
          </div>

          <div className="shore-pond-frame mx-auto w-full max-w-[420px] p-5">
            <div className="shore-pond-inner relative overflow-hidden p-4">
              <div className="shore-sprite-space mx-auto flex h-[280px] w-[280px] items-center justify-center">
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

          <div className="shore-action-card p-5">
            <p className="shore-card-label text-xs tracking-[0.24em]">조작 안내</p>
            <p className="mt-3 text-lg font-semibold">
              <span className="shore-space-key">스페이스바</span>를 눌러 {state === "bite" ? "낚아채세요!" : "낚싯대를 던지세요"}
            </p>
            <p className="mt-2 min-h-5 text-sm text-amber-100/80">{loading ? "처리 중..." : " "}</p>
          </div>

          <div className={`shore-feedback p-3 text-sm ${feedback ? "shore-feedback-visible" : ""}`}>
            {feedback || "결과 메시지 대기"}
          </div>
        </div>
      </section>
    </div>
  );
}
