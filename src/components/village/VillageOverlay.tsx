import type { VillageScene } from "./types";
import SceneFrame from "./SceneFrame";
import DexScene from "./scenes/DexScene";
import HouseScene from "./scenes/HouseScene";
import MailboxScene from "./scenes/MailboxScene";
import ShoreScene from "./scenes/ShoreScene";
import TradeSceneContainer from "./scenes/TradeSceneContainer";

interface VillageOverlayProps {
  activeScene: VillageScene;
  onClose(): void;
}

export default function VillageOverlay({ activeScene, onClose }: VillageOverlayProps) {
  if (activeScene === "none") {
    return null;
  }

  const renderScene = () => {
    switch (activeScene) {
      case "house":
        return <HouseScene />;
      case "mailbox":
        return <MailboxScene />;
      // 논·광산은 오버레이 없이 마을 필드에서 바로 진행한다 (설계 17.3).
      // 여기로 오는 경로는 없다.
      case "shore":
        return <ShoreScene />;
      case "dex":
        return <DexScene />;
      case "trade":
        return <TradeSceneContainer onClose={onClose} />;
      default:
        return null;
    }
  };

  return (
    // 카드를 두르지 않는다. 씬은 저마다 이미 판때기·책 같은 자기 외형을 갖고
    // 있어서, 바깥에 창을 하나 더 씌우면 창 안에 창이 있는 꼴이 된다.
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm">
      <SceneFrame>{renderScene()}</SceneFrame>
      <button
        type="button"
        className="fixed top-6 right-6 z-50 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-400"
        onClick={onClose}
      >
        닫기 (ESC)
      </button>
    </div>
  );
}
