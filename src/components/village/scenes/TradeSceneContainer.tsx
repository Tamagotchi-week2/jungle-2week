"use client";

/**
 * 펫 교환소 (설계 9장 · 17.4).
 *
 * 발급 · 참여 · 확정 · 취소를 **한 화면에서** 처리한다. 예전에는 탭으로 나뉘어
 * 있어 코드를 받은 사람이 탭을 옮겨야 했고, 진행 상황이 어디에 보이는지도
 * 화면마다 달랐다.
 *
 * 구성은 위에서 아래로 하나의 흐름이다.
 *   개체 선택 → (코드 발급 | 코드 입력) → 교환 콘솔 → 확정/취소
 *
 * 콘솔은 항상 같은 자리에 있고 상태만 바뀐다. 어느 경로로 들어오든 진행 상황을
 * 같은 곳에서 본다.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import TradeScene, { type TradeDisplayStatus } from "./TradeScene";
import { useMe } from "../MeContext";
import {
  cancelTrade,
  createTrade,
  getTradeStatus,
  joinTrade,
  resolveTrade,
  type TradeStatusView,
} from "@/lib/client/trade";
import type { AdultPetsResponse, TradePetView } from "@/types/api";

const POLL_INTERVAL_MS = 2000;

/** 화면이 취할 수 있는 단계. 콘솔 표시와 버튼 노출을 이걸로 정한다 */
type Phase =
  | "idle" // 아무 교환도 진행 중이 아님
  | "waiting" // 내가 코드를 발급하고 상대를 기다리는 중
  | "joined" // 상대가 참여함. 제안자만 확정할 수 있다
  | "sent" // 내가 참여함. 제안자의 확정을 기다리는 중
  | "done"; // 완료·거절·취소

function label(pet: TradePetView) {
  return `${pet.speciesName}${pet.isAlbino ? " (알비노)" : ""}`;
}

export default function TradeSceneContainer({ onClose }: { onClose?: () => void }) {
  const { refresh } = useMe();

  const [pets, setPets] = useState<TradePetView[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingPets, setLoadingPets] = useState(true);

  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState<TradeStatusView | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  /** 교환 가능한 성체만 후보로 둔다. 이미 교환한 개체는 다시 걸 수 없다 (9장) */
  const loadPets = useCallback(async () => {
    const res = await fetch("/api/pet/adults");
    if (!res.ok) {
      const body = (await res.json()) as { error?: string };
      setError(body.error ?? "성체 목록을 불러오지 못했습니다.");
      setLoadingPets(false);
      return;
    }
    const body = (await res.json()) as AdultPetsResponse;
    const tradable = body.pets.filter((p) => !p.isTraded);
    setPets(tradable);
    setSelectedId((current) =>
      current && tradable.some((p) => p.id === current)
        ? current
        : (tradable[0]?.id ?? null),
    );
    setLoadingPets(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPets();
    return stopPolling;
  }, [loadPets, stopPolling]);

  /** 상대 참여 여부는 폴링으로 확인한다. 실시간 통신은 1차 범위 밖이다 (12장) */
  const startPolling = useCallback(
    (tradeCode: string, mode: "waiting" | "sent") => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const latest = await getTradeStatus(tradeCode);
          setStatus(latest);

          if (mode === "waiting" && latest.status === "joined") {
            setPhase("joined");
            stopPolling();
            return;
          }
          if (latest.status !== "proposed" && latest.status !== "joined") {
            setPhase("done");
            stopPolling();
            setNotice(
              latest.status === "accepted"
                ? "교환이 완료되었습니다."
                : "교환이 종료되었습니다.",
            );
            await Promise.all([loadPets(), refresh()]);
          }
        } catch {
          // 일시적 실패는 다음 주기에 재시도한다
        }
      }, POLL_INTERVAL_MS);
    },
    [loadPets, refresh, stopPolling],
  );

  async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "요청을 처리하지 못했습니다.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    if (!selectedId) return;
    const created = await run(() => createTrade({ petId: selectedId }));
    if (!created) return;

    setStatus({
      tradeId: "",
      status: "proposed",
      code: created.code,
      expiresAt: created.expiresAt,
      myPet: created.myPet,
      theirPet: null,
    });
    setPhase("waiting");
    setNotice(null);
    startPolling(created.code, "waiting");
  }

  async function handleJoin() {
    if (!selectedId || code.trim().length === 0) return;
    const entered = code.trim().toUpperCase();
    const joined = await run(() =>
      joinTrade({ code: entered, petId: selectedId }),
    );
    if (!joined) return;

    setStatus({
      tradeId: joined.tradeId,
      status: "joined",
      code: entered,
      expiresAt: "",
      myPet: joined.myPet,
      theirPet: joined.theirPet,
    });
    setPhase("sent");
    setNotice("제안자의 확정을 기다립니다.");
    startPolling(entered, "sent");
  }

  async function handleResolve(accept: boolean) {
    if (!status?.tradeId) return;
    const result = await run(() =>
      resolveTrade({ tradeId: status.tradeId, accept }),
    );
    if (!result) return;

    stopPolling();
    setPhase("done");
    setNotice(
      result.status === "accepted"
        ? `${result.received ? label(result.received) : "개체"} 를 받았습니다!`
        : "교환을 거절했습니다.",
    );
    await Promise.all([loadPets(), refresh()]);
  }

  /** 제안자가 스스로 취소한다. 잠긴 개체가 함께 풀린다 */
  async function handleCancel() {
    if (!status) return;

    // 코드만 발급한 단계에서는 tradeId 를 모르므로 상태 조회로 얻는다
    let tradeId = status.tradeId;
    if (!tradeId) {
      const latest = await run(() => getTradeStatus(status.code));
      if (!latest) return;
      tradeId = latest.tradeId;
    }

    const result = await run(() => cancelTrade({ tradeId }));
    if (!result) return;

    stopPolling();
    setPhase("idle");
    setStatus(null);
    setNotice("교환을 취소했습니다.");
    await Promise.all([loadPets(), refresh()]);
  }

  function reset() {
    stopPolling();
    setPhase("idle");
    setStatus(null);
    setCode("");
    setNotice(null);
    setError(null);
  }

  /**
   * 콘솔 상태.
   *
   * TradeScene 은 status="trading" 일 때 확정·취소 버튼을 잠근다("처리 중" 표현).
   * 상대가 참여해 확정을 기다리는 joined 단계에 trading 을 넘기면 버튼이 죽어
   * 교환을 확정할 수 없다. joined 는 "서로 확인 후 결정" 단계이므로 idle 을 준다.
   */
  const consoleStatus: TradeDisplayStatus =
    phase === "done"
      ? "completed"
      : // 내가 참여하고 상대의 확정을 기다리는 동안만 "교환 중". 이때는 내가
        // 할 수 있는 일이 없으므로 버튼이 잠겨도 된다.
        phase === "sent"
        ? "trading"
        : // waiting(취소 가능) 과 joined(확정 가능) 는 조작이 필요한 단계다.
          "idle";

  const selected = pets.find((p) => p.id === selectedId) ?? null;
  const canAct = !busy && phase === "idle" && selected !== null;

  if (loadingPets) {
    return <p className="p-6 text-center text-sm text-slate-400">불러오는 중…</p>;
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 p-4 text-slate-100">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">펫 교환소</h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-600 px-3 py-1 text-sm text-slate-300 hover:border-slate-400"
          >
            닫기
          </button>
        )}
      </header>

      {pets.length === 0 ? (
        <p className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5 text-center text-sm text-slate-400">
          교환할 수 있는 성체가 없습니다. 3차 성체까지 키운 개체만 교환할 수 있고,
          한 번 교환한 개체는 다시 교환할 수 없습니다.
        </p>
      ) : (
        <>
          {/* 1단계 — 내놓을 개체. 발급이든 참여든 공통으로 쓴다 */}
          <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
              내놓을 개체
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {pets.map((pet) => (
                <button
                  key={pet.id}
                  type="button"
                  disabled={phase !== "idle"}
                  onClick={() => setSelectedId(pet.id)}
                  className={`rounded-2xl border px-3 py-2 text-sm transition disabled:opacity-50 ${
                    pet.id === selectedId
                      ? "border-amber-300 bg-amber-400/15 text-amber-100"
                      : "border-slate-600 hover:border-slate-400"
                  }`}
                >
                  {label(pet)}
                </button>
              ))}
            </div>
          </section>

          {/* 2단계 — 발급과 참여를 나란히. 탭으로 감추지 않는다 */}
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
              <p className="text-sm font-semibold">코드 발급</p>
              <p className="mt-1 text-xs text-slate-400">
                상대에게 코드를 알려주세요. 10분간 유효합니다.
              </p>
              {phase === "waiting" && status ? (
                <p className="mt-3 text-center font-mono text-3xl font-bold tracking-widest">
                  {status.code}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!canAct}
                  className="mt-3 w-full rounded-2xl border border-amber-300 bg-amber-400/15 px-4 py-2 text-sm font-semibold text-amber-100 disabled:opacity-40"
                >
                  {busy ? "처리 중…" : "코드 발급"}
                </button>
              )}
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
              <p className="text-sm font-semibold">코드 입력</p>
              <p className="mt-1 text-xs text-slate-400">
                받은 6자리 코드를 입력하세요.
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  disabled={phase !== "idle"}
                  placeholder="ABC123"
                  className="w-full rounded-2xl border border-slate-600 bg-slate-950/80 px-3 py-2 text-center font-mono tracking-widest disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={handleJoin}
                  disabled={!canAct || code.trim().length === 0}
                  className="rounded-2xl border border-slate-500 px-4 py-2 text-sm disabled:opacity-40"
                >
                  참여
                </button>
              </div>
            </div>
          </section>

          {/* 3단계 — 콘솔은 항상 같은 자리. 어느 경로로 들어와도 여기서 본다 */}
          <TradeScene
            myPet={status?.myPet ?? selected}
            theirPet={status?.theirPet ?? null}
            status={consoleStatus}
            // 확정은 제안자만 가능하다 (17.4). 참여자에게는 버튼을 주지 않는다.
            onConfirm={phase === "joined" ? () => handleResolve(true) : undefined}
            onCancel={
              phase === "joined"
                ? () => handleResolve(false)
                : phase === "waiting"
                  ? handleCancel
                  : undefined
            }
          />

          {phase === "sent" && (
            <p className="text-center text-sm text-slate-400">
              상대가 확정하면 결과가 여기에 표시됩니다.
            </p>
          )}

          {phase === "done" && (
            <button
              type="button"
              onClick={reset}
              className="mx-auto rounded-2xl border border-slate-600 px-5 py-2 text-sm hover:border-slate-400"
            >
              새 교환 시작
            </button>
          )}
        </>
      )}

      {notice && (
        <p className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-center text-sm text-emerald-200">
          {notice}
        </p>
      )}
      {error && (
        <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-center text-sm text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}
