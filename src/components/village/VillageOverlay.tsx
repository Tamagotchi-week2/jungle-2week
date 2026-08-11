import type { VillageScene } from "./types";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[90vh] rounded-[32px] border border-slate-600/80 bg-slate-950 overflow-y-auto shadow-2xl shadow-black/40">
        <div className="p-6">
          {renderScene()}
        </div>
        <button
          type="button"
          className="fixed top-6 right-6 z-50 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-400"
          onClick={onClose}
        >
          Close (ESC)
        </button>
      </div>
    </div>
  );
}
