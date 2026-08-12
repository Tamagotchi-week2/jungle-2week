'use client';

import { useEffect, useRef, useState } from 'react';

import { cq } from './scale';

/**
 * 등장(키링 낙하) → 화면 켜짐(플리커) → 로그인 폼 노출 3단계 연출.
 * 이후 login <-> signup 전환 시에는 레이아웃이 리마운트되지 않으므로
 * 이 연출은 (auth) 구간에 처음 들어올 때 한 번만 재생된다.
 *
 * 달걀 폭을 창 크기에 맞춰 clamp()로 흘려보내고, 체인·화면·버튼·로그인 폼까지
 * 전부 컨테이너 쿼리(cqw, scale.ts 의 cq())로 그 폭에 비례해 스케일한다.
 * 폼만 고정 크기로 두면 달걀이 작아졌을 때 화면 밖으로 넘치므로,
 * "화면에 딱 맞고 스크롤이 필요 없다"는 요건은 이 비례 스케일로 지킨다.
 *
 * container-type 은 명시적 폭(EGG_WIDTH)을 가진 바깥 래퍼에 걸어야 한다 — 그 래퍼
 * 자체의 배경 패턴(체크무늬)도 cq() 로 스케일하려면 래퍼가 "자기 자신"이 아니라
 * 조상 컨테이너를 참조해야 하기 때문이다. 폭이 auto 인 요소에 걸면 인라인 사이즈
 * 컨테인먼트가 내용을 무시해 0으로 붕괴한다(과거에 겪은 버그).
 */
type Phase = 'off' | 'booting' | 'on';

const BOOT_DELAY_MS = 1000;
const BOOT_DURATION_MS = 620;

/**
 * 체인 맨 위 고리는 고정된 지점(진자의 회전축)이고, 그 아래(남은 체인 + 달걀
 * 전체)가 하나의 진자로서 그 고정점을 중심으로 회전한다. 옆으로 치우친 각도에서
 * 시작해(장력을 받아 당겨진 상태) 진폭이 점점 줄어드는 감쇠 진동을 거쳐 정면(0deg)
 * 에 멈춘다. 자세한 키프레임은 globals.css 참조.
 */
const PENDULUM_SWING = 'keyring-pendulum-swing 2s ease-in-out both';

const INK = '#5a3a1f';

/** 카페 체크무늬 — 크림 바탕에 얇은 갈색 격자선. 선 간격을 cq() 로 둬서 달걀 크기에 비례해 촘촘함이 유지된다. */
const PLAID_BACKGROUND = [
  `repeating-linear-gradient(0deg, rgba(139,94,52,0.22) 0 ${cq(2)}, transparent ${cq(2)} ${cq(26)})`,
  `repeating-linear-gradient(90deg, rgba(139,94,52,0.22) 0 ${cq(2)}, transparent ${cq(2)} ${cq(26)})`,
  'radial-gradient(circle at 25% 20%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 12%)',
  'linear-gradient(160deg, #fbf1de 0%, #f3e2bc 100%)',
].join(', ');

/** 달걀 실루엣: 수평 반지름은 균일하되 수직 반지름을 위(60%)/아래(40%)로 달리 줘 위가 좁고 아래가 둥근 달걀 곡선을 만든다. */
const EGG_RADIUS = '50% / 60% 60% 40% 40%';

/** 창 폭·높이 양쪽에 반응해 달걀이 흘러가며 커지고 작아진다. 180px 는 패딩·체인이 쓰는 여유분. */
const EGG_WIDTH = 'clamp(200px, min(46vw, calc((100vh - 180px) * 0.75)), 340px)';

/** 화면 위·아래에 놓는 장식용 메뉴 아이콘 4종. 5x5 격자에 켜진 칸만 채운다 — 실제 기능은 없고 다마고치 특유의 아이콘 줄 느낌만 낸다. */
const MENU_ICONS = {
  diamond: [
    [2, 0],
    [1, 1],
    [2, 1],
    [3, 1],
    [0, 2],
    [1, 2],
    [2, 2],
    [3, 2],
    [4, 2],
    [1, 3],
    [2, 3],
    [3, 3],
    [2, 4],
  ],
  circle: [
    [1, 0],
    [2, 0],
    [3, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1],
    [4, 1],
    [0, 2],
    [1, 2],
    [2, 2],
    [3, 2],
    [4, 2],
    [0, 3],
    [1, 3],
    [2, 3],
    [3, 3],
    [4, 3],
    [1, 4],
    [2, 4],
    [3, 4],
  ],
  cross: [
    [2, 0],
    [2, 1],
    [0, 2],
    [1, 2],
    [2, 2],
    [3, 2],
    [4, 2],
    [2, 3],
    [2, 4],
  ],
  heart: [
    [1, 0],
    [3, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1],
    [4, 1],
    [0, 2],
    [1, 2],
    [2, 2],
    [3, 2],
    [4, 2],
    [1, 3],
    [2, 3],
    [3, 3],
    [2, 4],
  ],
} as const;

type IconKind = keyof typeof MENU_ICONS;

function MenuIcon({ kind }: { kind: IconKind }) {
  return (
    <svg viewBox="0 0 5 5" shapeRendering="crispEdges" style={{ width: cq(10), height: cq(10) }}>
      {MENU_ICONS[kind].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width={1} height={1} fill={INK} />
      ))}
    </svg>
  );
}

function IconRow({ order }: { order: IconKind[] }) {
  return (
    <div className="flex items-center" style={{ gap: cq(14) }}>
      {order.map((kind, i) => (
        <MenuIcon key={i} kind={kind} />
      ))}
    </div>
  );
}

function ArcText({ text }: { text: string }) {
  const letters = text.toUpperCase().split('');
  const n = letters.length;
  return (
    <div className="flex justify-center">
      {letters.map((ch, i) => {
        const t = n === 1 ? 0 : i / (n - 1) - 0.5;
        const rotate = t * 46;
        const rise = (0.25 - t * t) * 26;
        return (
          <span
            key={i}
            style={{
              transform: `translateY(-${cq(rise)}) rotate(${rotate}deg)`,
              fontSize: cq(11),
              color: INK,
            }}
            className="inline-block font-black tracking-tight"
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
}

function BootIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      style={{ width: cq(28), height: cq(28) }}
      shapeRendering="crispEdges"
      className="animate-[tamagotchi-boot-blink_0.7s_ease-in-out_infinite]"
    >
      <rect x="2" y="3" width="4" height="4" fill={INK} />
      <rect x="10" y="3" width="4" height="4" fill={INK} />
      <rect x="1" y="7" width="14" height="3" fill={INK} />
      <rect x="2" y="10" width="12" height="2" fill={INK} />
      <rect x="4" y="12" width="8" height="1" fill={INK} />
    </svg>
  );
}

function ChainLink({ size }: { size: number }) {
  return (
    <div
      className="rounded-full border-2 border-zinc-400 bg-zinc-200"
      style={{ width: cq(size), height: cq(size) }}
    />
  );
}

export function TamagotchiShell({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>('off');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 모션 축소 환경에서는 연출을 건너뛰고 즉시 폼을 보여준다
      setPhase('on');
      return;
    }
    timers.current.push(
      setTimeout(() => setPhase('booting'), BOOT_DELAY_MS),
      setTimeout(() => setPhase('on'), BOOT_DELAY_MS + BOOT_DURATION_MS),
    );
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      {/*
        아래 고리·진자가 둘 다 absolute라 여기엔 일반 흐름 자식이 없다 — aspect-ratio
        가 없으면 이 박스의 높이가 0으로 접혀서, 레이아웃의 flex 중앙 정렬이 달걀이
        아니라 이 빈 지점을 화면 중앙에 놓아버린다(달걀이 아래로 처져 보이는 원인이었다).
      */}
      <div
        className="relative"
        style={{
          width: EGG_WIDTH,
          aspectRatio: '3 / 4',
          containerType: 'inline-size',
        }}
      >
        {/* 고정된 고리 — 회전하지 않는다. 이 지점이 진자의 회전축이다 */}
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-full border-2 border-zinc-400 bg-zinc-200"
          style={{ top: `-${cq(46)}`, width: cq(12), height: cq(12) }}
        />

        {/* 진자 — 고리 바로 아래를 축으로 남은 체인 + 달걀 전체가 함께 회전한다 */}
        <div
          className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center"
          style={{
            top: `-${cq(32)}`,
            width: '100%',
            gap: cq(2),
            transformOrigin: 'top center',
            animation: PENDULUM_SWING,
          }}
        >
          <ChainLink size={8} />
          <ChainLink size={8} />
          <ChainLink size={8} />

          {/* 달걀 본체 — 카페 체크무늬 */}
          <div
            className="relative shadow-xl"
            style={{
              width: '100%',
              aspectRatio: '3 / 4',
              borderRadius: EGG_RADIUS,
              backgroundImage: PLAID_BACKGROUND,
            }}
          >
            <div
              className="absolute left-1/2 -translate-x-1/2 text-center font-bold tracking-[0.3em]"
              style={{ top: cq(14), fontSize: cq(7), color: INK, opacity: 0.6 }}
            >
              CAFE
            </div>
            <div className="absolute left-1/2 -translate-x-1/2" style={{ top: cq(24) }}>
              <ArcText text="tamagotchi" />
            </div>

            {/* 메뉴 아이콘 줄 — 실제 기능은 없는 장식으로, 화면을 위아래에서 감싸는 조작부처럼 보이게 한다 */}
            <div className="absolute left-1/2 -translate-x-1/2" style={{ top: cq(66) }}>
              <IconRow order={['diamond', 'circle', 'cross', 'heart']} />
            </div>

            {/* 화면 베젤 */}
            <div
              className="absolute left-1/2 -translate-x-1/2 shadow-inner"
              style={{
                top: cq(96),
                padding: cq(8),
                borderRadius: cq(16),
                backgroundColor: '#6b4226',
              }}
            >
              <div
                className="relative overflow-hidden bg-zinc-950"
                style={{ width: cq(224), height: cq(232), borderRadius: cq(12) }}
              >
                {phase === 'off' && <div className="h-full w-full bg-zinc-950" />}

                {phase === 'booting' && (
                  <div
                    className="flex h-full w-full items-center justify-center bg-[#fdf6ea]"
                    style={{ animation: 'tamagotchi-screen-flicker 0.6s steps(6, end) 1' }}
                  >
                    <BootIcon />
                  </div>
                )}

                {phase === 'on' && (
                  <div
                    className="no-scrollbar flex h-full w-full items-center-safe justify-center-safe overflow-y-auto bg-[#fdf6ea]"
                    style={{ animation: 'tamagotchi-content-rise 0.4s ease-out both' }}
                  >
                    {children}
                  </div>
                )}
              </div>
            </div>

            <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: cq(38) }}>
              <IconRow order={['heart', 'cross', 'circle', 'diamond']} />
            </div>

            {/* 버튼 받침대 */}
            <div
              className="absolute left-1/2 -translate-x-1/2 rounded-full"
              style={{
                bottom: cq(6),
                width: cq(150),
                height: cq(26),
                backgroundColor: 'rgba(107,66,38,0.18)',
              }}
            />

            {/* 버튼 3개 */}
            <div
              className="absolute left-1/2 flex -translate-x-1/2"
              style={{ bottom: cq(12), gap: cq(24) }}
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)]"
                  style={{
                    width: cq(12),
                    height: cq(12),
                    backgroundColor: '#8a5a34',
                    border: '1px solid rgba(90,58,31,0.5)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
