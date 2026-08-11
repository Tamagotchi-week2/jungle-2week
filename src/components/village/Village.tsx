"use client";

import { useEffect } from "react";
import { useActiveScene } from "./useActiveScene";
import { MeProvider, useMe } from "./MeContext";
import Hud from "./Hud";
import VillageMap from "./VillageMap";
import VillageOverlay from "./VillageOverlay";
import BackgroundMusic from "@/components/ui/BackgroundMusic";
import { SOUNDS } from "@/lib/client/sounds";

export default function Village() {
  return (
    <MeProvider>
      <VillageInner />
    </MeProvider>
  );
}

function VillageInner() {
  const [activeScene, setActiveScene] = useActiveScene();
  const { me } = useMe();

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveScene("none");
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [setActiveScene]);

  // 서버에서 받기 전에는 0 으로 표시한다. 목 데이터를 두면 실제 값과 섞여
  // 어느 쪽이 진짜인지 알 수 없게 된다.
  const resources = me?.resources ?? { crop: 0, mineral: 0, seafood: 0 };
  const eggs = me?.eggs ?? { air: 0, land: 0, sea: 0, gold: 0 };

  // 방명록은 전용 트랙, 집(방)은 홈 트랙, 마을 필드를 비롯한 나머지는
  // 공용 배경음이 흐른다.
  const musicSrc =
    activeScene === "mailbox"
      ? SOUNDS.guestbook
      : activeScene === "house"
        ? SOUNDS.home
        : SOUNDS.ambient;

  return (
    <main className="relative flex h-screen flex-col overflow-hidden bg-[#173f16] text-slate-100 font-mono pixelated">
      <BackgroundMusic src={musicSrc} />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
        <Hud
          resources={resources}
          eggs={eggs}
          unclaimedRewards={me?.unclaimedRewards ?? 0}
          hasActivePet={me?.activePet != null}
          onOpenScene={setActiveScene}
        />
        {/* 남은 높이를 전부 쓰되 넘치지 않는다. min-h-0 이 없으면 내용이 부모를 밀어낸다 */}
        <div className="min-h-0 flex-1">
          <VillageMap activeScene={activeScene} onOpenScene={setActiveScene} />
        </div>
      </div>
      <VillageOverlay activeScene={activeScene} onClose={() => setActiveScene("none")} />
    </main>
  );
}
