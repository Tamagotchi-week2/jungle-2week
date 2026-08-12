"use client";

/**
 * 화면 안에 뜨는 공용 모달/오버레이.
 *
 * 브라우저 alert/confirm/prompt 는 화면 비율에 맞춰 크기를 조절할 수 없고
 * 게임 화면과 시각적으로 단절돼 보인다. 대신 이 컴포넌트를 써서 배경을
 * 덮는 오버레이 + 가운데 정렬된 카드로 통일한다. 카드 크기는 clamp()/vw/vh
 * 로 잡아 화면 비율이 바뀌어도 자연스럽게 줄고 늘어난다.
 */

import { useEffect } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** 배경 클릭 시 닫을지. 확인이 꼭 필요한 다이얼로그는 false 로 끈다 */
  closeOnBackdrop?: boolean;
  /**
   * ESC 로 닫을지. false 면 ESC 를 **삼킨다** — 마을 오버레이도 ESC 로 닫히므로
   * 그냥 무시만 하면 뒤쪽 화면이 닫히면서 이 창까지 함께 사라진다.
   */
  closeOnEscape?: boolean;
}

export default function Modal({
  open,
  onClose,
  children,
  closeOnBackdrop = true,
  closeOnEscape = true,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (closeOnEscape) {
        onClose();
        return;
      }
      // 뒤쪽 화면이 이 ESC 를 보지 못하게 끊는다.
      // stopPropagation 만으로는 부족하다 — 마을 오버레이의 리스너도 window 에
      // 달려 있어서, 같은 노드에 등록된 리스너까지 막으려면 Immediate 가 필요하다.
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    // 캡처 단계로 듣는다. 뒤쪽 리스너(window, 버블)보다 먼저 받아야 끊을 수 있다.
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [open, onClose, closeOnEscape]);

  if (!open) return null;

  return createPortal(
    <div
      className="app-modal-backdrop"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="app-modal-card" role="dialog" aria-modal="true">
        {children}
      </div>
    </div>,
    document.body,
  );
}
