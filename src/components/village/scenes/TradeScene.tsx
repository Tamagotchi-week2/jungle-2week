"use client";

import { adultSprite } from "@/lib/sprites";
import type { TradePetView } from "@/types/api";

export type TradeDisplayStatus = "idle" | "trading" | "completed";

interface TradeSceneProps {
  /** 기존 교환 상태를 그대로 전달해 화면에 표시한다. */
  myPet?: TradePetView | null;
  theirPet?: TradePetView | null;
  status?: TradeDisplayStatus;
  /** 기존 교환 확정 핸들러를 연결한다. */
  onConfirm?: () => void;
  /** 기존 교환 취소 핸들러를 연결한다. */
  onCancel?: () => void;
}

function PetSlot({ label, pet, facing }: { label: string; pet?: TradePetView | null; facing: "right" | "left" }) {
  return (
    <div className={`trade-pet-slot trade-pet-slot-${facing}`}>
      <div className="trade-pet-nameplate">{label}</div>
      <div className="trade-pet-frame">
        {pet ? (
          <img
            src={adultSprite(pet.eggType, pet.combo, pet.isAlbino)}
            alt={pet.speciesName}
            className="trade-pet-sprite"
            style={{ imageRendering: "pixelated" }}
          />
        ) : (
          <span className="trade-pet-waiting">펫 대기 중</span>
        )}
      </div>
      <p className="trade-pet-species">{pet?.speciesName ?? "상대방을 기다리고 있어요"}</p>
    </div>
  );
}

/**
 * 교환 데이터를 그리는 프론트 전용 화면.
 * API 호출 및 교환 상태 변경은 부모의 기존 로직에서 props로 주입한다.
 */
export default function TradeScene({
  myPet,
  theirPet,
  status = "idle",
  onConfirm,
  onCancel,
}: TradeSceneProps) {
  const isTrading = status === "trading";
  const isCompleted = status === "completed";
  const canConfirm = Boolean(myPet && theirPet && onConfirm && !isTrading && !isCompleted);

  return (
    <section className="trade-console" aria-label="펫 교환">
      <div className="trade-console-header">
        <span aria-hidden="true">✦</span>
        <h1>펫 교환소</h1>
        <span aria-hidden="true">✦</span>
      </div>

      <div className="trade-display">
        <span className="trade-cloud trade-cloud-left" aria-hidden="true" />
        <span className="trade-cloud trade-cloud-right" aria-hidden="true" />
        <span className="trade-note trade-note-left" aria-hidden="true">♪</span>
        <span className="trade-note trade-note-right" aria-hidden="true">♫</span>
        <span className="trade-wave trade-wave-one" aria-hidden="true" />
        <span className="trade-wave trade-wave-two" aria-hidden="true" />

        <div className="trade-pets">
          <PetSlot label="나" pet={myPet} facing="right" />
          <div className={`trade-center-effect${isCompleted ? " trade-center-effect-completed" : ""}`} aria-live="polite">
            {isCompleted ? <><span>♥</span><span>✦</span><strong>교환 완료!</strong></> : <><span aria-hidden="true">↔</span><strong>{isTrading ? "교환 중..." : "교환 준비"}</strong></>}
          </div>
          <PetSlot label="상대방" pet={theirPet} facing="left" />
        </div>
      </div>

      <div className="trade-console-actions">
        <p className="trade-console-status" role="status">
          {isCompleted ? "두 펫의 교환이 완료됐어요!" : isTrading ? "두근두근! 펫을 교환하고 있어요." : "서로의 펫을 확인한 뒤 교환하세요."}
        </p>
        <div className="trade-console-buttons">
          <button type="button" className="trade-button trade-button-confirm" disabled={!canConfirm} onClick={onConfirm}>교환하기</button>
          <button type="button" className="trade-button trade-button-cancel" disabled={!onCancel || isTrading} onClick={onCancel}>취소</button>
        </div>
      </div>
    </section>
  );
}
