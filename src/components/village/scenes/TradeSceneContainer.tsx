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

export default function TradeSceneContainer() {
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

    // 교환을 마친 개체만 뺀다. 잠긴 개체는 **교환된 것이 아니라 잠시 묶인 것**
    // 뿐이라 목록에서 감추면 "내 개체가 어디 갔지" 가 된다. 대신 뒤로 밀고
    // 붉게 표시해 지금 고를 수 없다는 사실을 눈으로 알린다.
    const usable = body.pets.filter((p) => !p.isTraded);
    const ordered = [
      ...usable.filter((p) => !p.isLocked),
      ...usable.filter((p) => p.isLocked),
    ];
    setPets(ordered);

    // 보고 있던 개체는 그대로 둔다. 방금 교환에 건 개체는 잠기지만, 화면은
    // 아직 그 개체의 코드를 띄우고 있으므로 테두리도 거기 남아야 한다.
    // 목록에서 아예 사라졌을 때만(교환 완료 등) 다른 것으로 옮긴다.
    setSelectedId((current) =>
      current && ordered.some((p) => p.id === current)
        ? current
        : (ordered.find((p) => !p.isLocked)?.id ?? null),
    );
    setLoadingPets(false);
  }, []);


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

  /**
   * 잠긴 개체를 눌러 그 개체에 걸린 교환을 다시 띄운다.
   *
   * 교환은 개체마다 걸 수 있으므로 "진행 중인 교환" 이 하나로 정해지지 않는다.
   * 화면을 열 때 아무거나 하나를 골라 복원하면, 그걸 취소했을 때 숨어 있던 다른
   * 건이 튀어나와 "취소했는데 왜 아직 진행 중이지" 로 보인다. 그래서 자동으로
   * 복원하지 않고, 어느 개체의 교환인지 유저가 짚었을 때만 되살린다.
   *
   * 단계 판정에 주의한다. 같은 joined 라도 제안자는 확정할 수 있고(joined)
   * 참여자는 기다릴 뿐이다(sent). 뒤집으면 버튼이 죽거나 권한 없이 열린다.
   */
  const showLockedTrade = useCallback(
    async (petId: string) => {
      const res = await fetch(
        `/api/trade/by-pet?petId=${encodeURIComponent(petId)}`,
      );
      if (!res.ok) return;

      const { trade } = (await res.json()) as { trade: TradeStatusView | null };
      if (!trade) {
        // 방금 만료돼 회수됐을 수 있다. 목록을 새로 읽어 잠금 표시를 지운다.
        setNotice("해당 교환은 이미 끝났습니다.");
        await loadPets();
        return;
      }

      setStatus(trade);
      setCode(trade.code);
      if (trade.status === "proposed") {
        setPhase("waiting");
        startPolling(trade.code, "waiting");
      } else {
        setPhase(trade.iAmProposer ? "joined" : "sent");
        if (!trade.iAmProposer) startPolling(trade.code, "sent");
      }
      setNotice(null);
    },
    [loadPets, startPolling],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPets();
    return stopPolling;
  }, [loadPets, stopPolling]);

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
    if (!offerPet) return;
    const created = await run(() => createTrade({ petId: offerPet.id }));
    if (!created) return;

    setStatus({
      tradeId: "",
      status: "proposed",
      code: created.code,
      expiresAt: created.expiresAt,
      iAmProposer: true,
      myPet: created.myPet,
      theirPet: null,
    });
    setPhase("waiting");
    setNotice(null);
    startPolling(created.code, "waiting");
    // 목록을 다시 읽어 방금 건 개체가 곧바로 "교환 중" 으로 보이게 한다.
    // 그러지 않으면 화면을 닫았다 열기 전까지 멀쩡해 보인다.
    await loadPets();
  }

  async function handleJoin() {
    if (!offerPet || code.trim().length === 0) return;
    const entered = code.trim().toUpperCase();
    const joined = await run(() =>
      joinTrade({ code: entered, petId: offerPet.id }),
    );
    if (!joined) return;

    setStatus({
      tradeId: joined.tradeId,
      status: "joined",
      code: entered,
      expiresAt: "",
      iAmProposer: false,
      myPet: joined.myPet,
      theirPet: joined.theirPet,
    });
    setPhase("sent");
    setNotice("제안자의 확정을 기다립니다.");
    startPolling(entered, "sent");
    await loadPets();
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

  /**
   * 콘솔만 발급 화면으로 되돌린다.
   *
   * reset() 과 달리 "교환을 끝냈다" 는 뜻이 아니다. 서버의 교환은 그대로 살아
   * 있고, 잠긴 칸을 다시 누르면 코드와 함께 돌아온다. 다른 개체를 짚었을 때
   * 화면이 이전 교환에 머물러 있으면 새 코드를 발급할 방법이 없다.
   */
  function backToIssueView() {
    if (phase === "idle") return;
    stopPolling();
    setPhase("idle");
    setStatus(null);
    setCode("");
    setNotice(null);
    setError(null);
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

  /**
   * 내놓을 수 있는 개체인가. 잠긴 개체는 눌러서 코드를 볼 수는 있지만
   * 그 상태로 새 교환에 걸 수는 없다.
   */
  const offerPet = selected && !selected.isLocked ? selected : null;
  // 잠긴 개체를 보고 있는 동안에는 발급·참여를 막는다. 그 개체는 이미 다른
  // 교환에 걸려 있어 서버가 거절한다.
  const canAct = !busy && phase === "idle" && offerPet !== null;

  if (loadingPets) {
    return <p className="p-6 text-center text-sm text-slate-400">불러오는 중…</p>;
  }

  return (
    <div className="trade-station mx-auto flex max-w-4xl flex-col gap-5 p-4">
      <header className="trade-station-header flex items-center justify-between">
        <h2 className="text-xl font-semibold">펫 교환소</h2>
      </header>

      {pets.length === 0 ? (
        <section className={`trade-station-empty ${phase === "done" ? "trade-station-complete" : ""}`}>
          <div className="trade-station-empty-leaves" aria-hidden="true">♣</div>
          <p className="trade-station-empty-kicker">
            {phase === "done" ? "교환 완료" : "숲속 교환 안내"}
          </p>
          <h3>{phase === "done" ? "새로운 친구가 도착했어요!" : "교환할 펫이 없어요"}</h3>
          <p className="trade-station-empty-copy">
            {phase === "done"
              ? notice ?? "두 펫의 교환이 무사히 완료되었습니다."
              : "3차 성체까지 키운 개체만 교환할 수 있으며, 한 번 교환한 개체는 다시 교환할 수 없습니다."}
          </p>
          <div className="trade-station-empty-ground" aria-hidden="true">
            <span>✦</span><span>♠</span><span>✦</span>
          </div>
        </section>
      ) : (
        <>
          {/* 1단계 — 내놓을 개체. 발급이든 참여든 공통으로 쓴다 */}
          <section className="trade-station-panel p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
              내놓을 개체
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {pets.map((pet) => (
                <button
                  key={pet.id}
                  type="button"
                  // 교환이 진행 중이어도 다른 개체를 눌러볼 수 있다. 잠긴 개체는
                  // 그 개체에 걸린 교환을 띄우고, 그렇지 않으면 다음에 내놓을
                  // 개체로 고른다. 진행 중이라고 목록 전체를 잠그면 코드를
                  // 확인하러 들어온 유저가 아무것도 누를 수 없다.
                  onClick={() => {
                    // 테두리는 언제나 방금 누른 개체를 따라간다. 교환이 진행
                    // 중이라고 커서를 고정해 두면 눌러도 아무 반응이 없어 보인다.
                    setSelectedId(pet.id);
                    if (pet.isLocked) {
                      void showLockedTrade(pet.id);
                    } else {
                      // 걸려 있지 않은 개체를 짚었다면 그 개체로 새 교환을 걸려는
                      // 것이다. 콘솔을 발급 화면으로 되돌린다. 서버의 교환은
                      // 그대로 두므로 잠긴 칸을 다시 누르면 언제든 돌아온다.
                      backToIssueView();
                    }
                  }}
                  title={
                    pet.isLocked
                      ? "이 개체에 걸린 교환을 다시 엽니다."
                      : undefined
                  }
                  className={`trade-pet-choice px-3 py-2 text-sm transition ${
                    pet.isLocked ? "trade-pet-choice-locked" : ""
                  } ${
                    pet.id === selectedId
                      ? "trade-pet-choice-selected"
                      : ""
                  }`}
                >
                  {label(pet)}
                  {pet.isLocked ? (
                    <span className="trade-pet-choice-lock-tag">교환 중</span>
                  ) : null}
                </button>
              ))}
            </div>
          </section>

          {/* 2단계 — 발급과 참여를 나란히. 탭으로 감추지 않는다 */}
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="trade-station-panel p-4">
              <p className="text-sm font-semibold">코드 발급</p>
              <p className="mt-1 text-xs text-slate-400">
                상대에게 코드를 알려주세요. 3분간 유효합니다.
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
                  className="trade-station-primary mt-3 w-full px-4 py-2 text-sm font-semibold disabled:opacity-40"
                >
                  {busy ? "처리 중…" : "코드 발급"}
                </button>
              )}
            </div>

            <div className="trade-station-panel p-4">
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
                  className="trade-code-input w-full px-3 py-2 text-center tracking-widest disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={handleJoin}
                  disabled={!canAct || code.trim().length === 0}
                  className="trade-station-small-button px-4 py-2 text-sm disabled:opacity-40"
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
              className="trade-station-small-button mx-auto px-5 py-2 text-sm"
            >
              새 교환 시작
            </button>
          )}
        </>
      )}

      {notice && phase !== "done" && (
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
