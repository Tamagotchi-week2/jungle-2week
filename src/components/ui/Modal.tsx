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

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** 배경 클릭 시 닫을지. 확인이 꼭 필요한 다이얼로그는 false 로 끈다 */
  closeOnBackdrop?: boolean;
}

export default function Modal({ open, onClose, children, closeOnBackdrop = true }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
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
    </div>
  );
}
