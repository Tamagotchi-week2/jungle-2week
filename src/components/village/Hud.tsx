"use client";

import { logout } from "@/app/(auth)/actions";
import { eggSprite } from "@/lib/sprites";
import type { EggType, ResourceType } from "@/lib/game/types";
import type { VillageScene } from "./types";

/**
 * 자원·알 아이콘은 실제 스프라이트를 쓴다. 이모지는 OS 마다 그림이 달라
 * 픽셀 톤과 어긋나고, 집 화면에서 먹이로 보이는 그림과도 달라 같은 자원인지
 * 알아보기 어렵다.
 */
const RESOURCE_ICON: Record<ResourceType, string> = {
  crop: "/sprites/house/crop.png",
  mineral: "/sprites/house/mineral.png",
  seafood: "/sprites/house/seafood.png",
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
  onOpenScene(scene: VillageScene): void;
}

export default function Hud({
  resources,
  eggs,
  unclaimedRewards,
  onOpenScene,
}: HudProps) {
  return (
    <div className="shrink-0 z-40 border-b border-slate-700/80 bg-slate-950/95 px-4 py-3 backdrop-blur-md">
      <div className="mx-auto flex max-w-none items-center justify-between gap-4">
        <div className="flex items-center gap-6 text-sm text-slate-300">
          <div className="flex items-center gap-3">
            <span className="text-slate-500 uppercase tracking-[0.25em] text-xs">Resources</span>
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

          <div className="w-px h-6 bg-slate-700/40" />

          <div className="flex items-center gap-3">
            <span className="text-slate-500 uppercase tracking-[0.25em] text-xs">Eggs</span>
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
          {/* 게임 종료 = 로그아웃. 세션이 끊기면 미들웨어가 /login 으로 돌려보낸다.
              나가는 동작은 되돌리기 어려우니 한 번 확인을 받는다. */}
          <form
            action={logout}
            onSubmit={(event) => {
              if (!window.confirm("게임을 종료하고 로그아웃할까요?")) {
                event.preventDefault();
              }
            }}
          >
            <button
              type="submit"
              className="rounded-2xl border border-slate-600 bg-slate-900/80 px-3 py-2 text-sm text-slate-300 transition hover:border-red-400 hover:text-red-200"
              title="로그아웃하고 게임을 종료합니다"
            >
              종료
            </button>
          </form>
          {unclaimedRewards > 0 ? (
            // 성체를 완성하면 보상 알이 쌓인다. 진입점이 없으면 받을 방법이 없다.
            <a
              href="/reward"
              className="animate-pulse rounded-2xl border border-amber-300 bg-amber-400/20 px-3 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/30"
            >
              {/* 알 그림을 넣지 않는다. 어떤 알이든 그려 넣으면 수령 전에 결과를
                  암시하게 되어 금색 연출이 무너진다 (설계 6장) */}
              보상 알 {unclaimedRewards}
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
    </div>
  );
}
