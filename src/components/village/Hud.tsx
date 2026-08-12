"use client";

import { useRef, useState } from "react";

import { logout } from "@/app/(auth)/actions";
import Modal from "@/components/ui/Modal";
import { eggSprite } from "@/lib/sprites";
import type { EggType, ResourceType } from "@/lib/game/types";
import type { VillageScene } from "./types";

/**
 * 자원·알 아이콘은 실제 스프라이트를 쓴다. 이모지는 OS 마다 그림이 달라
 * 픽셀 톤과 어긋나고, 집 화면에서 먹이로 보이는 그림과도 달라 같은 자원인지
 * 알아보기 어렵다.
 */
const RESOURCE_ICON: Record<ResourceType, string> = {
  crop: "/sprites/house/crop.webp",
  mineral: "/sprites/house/mineral.webp",
  seafood: "/sprites/house/seafood.webp",
};

const RESOURCE_LABEL: Record<ResourceType, string> = {
  crop: "작물",
  mineral: "광물",
  seafood: "어패",
};

const EGG_LABEL: Record<EggType, string> = {
  air: "공중 알",
  land: "지상 알",
  sea: "바다 알",
  gold: "금색 알",
};

/** 개수를 곁들인 픽셀 아이콘 한 칸 */
function Counter({
  src,
  label,
  count,
}: {
  src: string;
  label: string;
  count: number;
}) {
  return (
    <span className="flex items-center gap-1.5" title={label}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={label}
        className="h-5 w-5 object-contain"
        style={{ imageRendering: "pixelated" }}
        draggable={false}
      />
      <span>{count}</span>
    </span>
  );
}

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
    <div className="village-hud shrink-0 z-40 px-4 py-3">
      <div className="mx-auto flex max-w-none items-center justify-between gap-4">
        <div className="flex items-center gap-6 text-sm text-slate-300">
          <div className="village-resource-card flex items-center gap-3 px-4 py-2">
            <span className="text-xs tracking-[0.2em]">자원</span>
            <div className="flex gap-4 font-mono text-slate-100">
              {(["crop", "mineral", "seafood"] as const).map((type) => (
                <Counter
                  key={type}
                  src={RESOURCE_ICON[type]}
                  label={RESOURCE_LABEL[type]}
                  count={resources[type]}
                />
              ))}
            </div>
          </div>

          <div className="village-resource-card flex items-center gap-3 px-4 py-2">
            <span className="text-xs tracking-[0.2em]">알</span>
            <div className="flex gap-3 font-mono text-xs text-slate-100">
              {(["air", "land", "sea", "gold"] as const).map((type) => (
                <Counter
                  key={type}
                  src={eggSprite(type)}
                  label={EGG_LABEL[type]}
                  count={eggs[type]}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unclaimedRewards > 0 && !isFinalStage ? (
            // 육성 중(유아기~성장 중)일 때만 여기 노출한다. 성체 완료 상태(isFinalStage)가
            // 되면 같은 보상 선택이 집(HouseScene) 하단으로 옮겨가므로 여기서는 숨긴다.
            <a
              href="/reward"
              className="village-hud-button animate-pulse rounded-2xl px-3 py-2 text-sm font-semibold transition"
            >
              {/* 알 그림을 넣지 않는다. 어떤 알이든 그려 넣으면 수령 전에 결과를
                  암시하게 되어 금색 연출이 무너진다 (설계 6장) */}
              보상 알 {unclaimedRewards}
            </a>
          ) : null}
          <button
            type="button"
            className="village-hud-button rounded-lg px-3 py-2 text-xs transition"
            onClick={() => onOpenScene("dex")}
          >
            📚 도감
          </button>
          <button
            type="button"
            className="village-hud-button rounded-lg px-3 py-2 text-xs transition"
            onClick={() => onOpenScene("trade")}
          >
            💱 교환
          </button>
          {/* 종료는 가장 오른쪽에 둔다. 되돌리기 어려운 동작이므로 확인 후 제출한다. */}
          <form action={logout} ref={logoutFormRef}>
            <button
              type="button"
              onClick={() => setConfirmingLogout(true)}
              className="village-hud-button rounded-2xl px-3 py-2 text-sm transition"
              title="로그아웃하고 게임을 종료합니다"
            >
              종료
            </button>
          </form>
        </div>
      </div>
      <Modal open={confirmingLogout} onClose={() => setConfirmingLogout(false)}>
        <div className="confirm-dialog confirm-dialog-forest">
          <p className="confirm-dialog-kicker">마을을 떠나시나요?</p>
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
