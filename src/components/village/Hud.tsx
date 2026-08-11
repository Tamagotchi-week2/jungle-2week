"use client";

import { useRef, useState } from "react";

import { logout } from "@/app/(auth)/actions";
import Modal from "@/components/ui/Modal";
import type { VillageScene } from "./types";

interface HudProps {
  resources: { crop: number; mineral: number; seafood: number };
  eggs: { air: number; land: number; sea: number; gold: number };
  /** 아직 수령하지 않은 보상 알 수. 0 보다 크면 수령 진입점을 띄운다 (설계 6장) */
  unclaimedRewards: number;
  /** 지금 육성 중인 개체가 있는가 (`/api/me` 의 activePet !== null) */
  hasActivePet: boolean;
  onOpenScene(scene: VillageScene): void;
}

export default function Hud({
  resources,
  eggs,
  unclaimedRewards,
  hasActivePet,
  onOpenScene,
}: HudProps) {
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const logoutFormRef = useRef<HTMLFormElement>(null);

  /**
   * activePet 은 stage < 3(육성 중)인 개체만 담으므로, 없다는 것은 "아직 시작
   * 안 함" 아니면 "막 성체로 완성함" 둘 중 하나다. 보상이 쌓여 있는 상태에서
   * 후자라면 알 보상 선택 UI 가 집(HouseScene) 하단으로 옮겨가므로, 이 HUD의
   * 상단 링크는 육성 중일 때만 남겨 둔다.
   */
  const isFinalStage = !hasActivePet;

  return (
    <div className="shrink-0 z-40 border-b border-slate-700/80 bg-slate-950/95 px-4 py-3 backdrop-blur-md">
      <div className="mx-auto flex max-w-none items-center justify-between gap-4">
        <div className="flex items-center gap-6 text-sm text-slate-300">
          <div className="flex items-center gap-3">
            <span className="text-slate-500 uppercase tracking-[0.25em] text-xs">Resources</span>
            <div className="flex gap-4 font-mono text-slate-100">
              <span>🌱 {resources.crop}</span>
              <span>🪨 {resources.mineral}</span>
              <span>🐟 {resources.seafood}</span>
            </div>
          </div>

          <div className="w-px h-6 bg-slate-700/40" />

          <div className="flex items-center gap-3">
            <span className="text-slate-500 uppercase tracking-[0.25em] text-xs">Eggs</span>
            <div className="flex gap-3 font-mono text-xs text-slate-100">
              <span>⬆️ {eggs.air}</span>
              <span>⬇️ {eggs.land}</span>
              <span>🌊 {eggs.sea}</span>
              <span>⭐ {eggs.gold}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 게임 종료 = 로그아웃. 세션이 끊기면 미들웨어가 /login 으로 돌려보낸다.
              나가는 동작은 되돌리기 어려우니 한 번 확인을 받는다. window.confirm
              대신 화면 안 모달로 확인받고, 확정되면 이 폼을 프로그램적으로 제출한다. */}
          <form action={logout} ref={logoutFormRef}>
            <button
              type="button"
              onClick={() => setConfirmingLogout(true)}
              className="rounded-2xl border border-slate-600 bg-slate-900/80 px-3 py-2 text-sm text-slate-300 transition hover:border-red-400 hover:text-red-200"
              title="로그아웃하고 게임을 종료합니다"
            >
              종료
            </button>
          </form>
          {unclaimedRewards > 0 && !isFinalStage ? (
            // 육성 중(유아기~성장 중)일 때만 여기 노출한다. 성체 완료 상태(isFinalStage)가
            // 되면 같은 보상 선택이 집(HouseScene) 하단으로 옮겨가므로 여기서는 숨긴다.
            <a
              href="/reward"
              className="animate-pulse rounded-2xl border border-amber-300 bg-amber-400/20 px-3 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/30"
            >
              🥚 보상 알 {unclaimedRewards}
            </a>
          ) : null}
          <button
            type="button"
            className="rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-xs text-slate-200 transition hover:bg-slate-800 hover:border-emerald-300"
            onClick={() => onOpenScene("dex")}
          >
            📚 Dex
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-xs text-slate-200 transition hover:bg-slate-800 hover:border-sky-300"
            onClick={() => onOpenScene("trade")}
          >
            💱 Trade
          </button>
        </div>
      </div>
      <Modal open={confirmingLogout} onClose={() => setConfirmingLogout(false)}>
        <div className="confirm-dialog">
          <p className="confirm-dialog-message">게임을 종료하고 로그아웃할까요?</p>
          <div className="confirm-dialog-actions">
            <button
              type="button"
              className="confirm-dialog-cancel"
              onClick={() => setConfirmingLogout(false)}
            >
              취소
            </button>
            <button
              type="button"
              className="confirm-dialog-confirm"
              onClick={() => {
                setConfirmingLogout(false);
                logoutFormRef.current?.requestSubmit();
              }}
            >
              로그아웃
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
