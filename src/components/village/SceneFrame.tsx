"use client";

/**
 * 씬을 화면에 띄우는 틀.
 *
 * 예전에는 오버레이가 어두운 카드(테두리·둥근 모서리·자체 여백)를 두르고 그
 * 안에 씬을 넣었다. 창 안에 또 창이 있는 꼴이라 씬이 이미 갖고 있는 판때기와
 * 겹쳐 보였고, 내용이 길면 카드에 스크롤이 생겼다. 화면 크기에 따라 차지하는
 * 비율도 제각각이었다.
 *
 * 그래서 카드를 없애고 대신 이렇게 한다:
 *
 *   1. 씬을 **고정 폭(SCENE_WIDTH)** 으로 그린다. 화면 폭에 따라 레이아웃이
 *      바뀌지 않으므로 어디서 보든 같은 그림이 나온다.
 *   2. 그려진 실제 크기를 재서, 지정한 화면 비율 안에 들어가도록 **통째로
 *      축소**한다. 잘리는 부분이 없으니 스크롤이 필요 없다.
 *
 * 축소는 transform 이라 글자·픽셀아트가 같은 비율로 줄어든다. 레이아웃을
 * 다시 계산하지 않으므로 씬마다 반응형 규칙을 새로 짤 필요도 없다.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/** 씬을 그릴 때 쓰는 기준 폭(px). 실제 표시 크기는 축소 배율이 정한다 */
const SCENE_WIDTH = 1120;

/** 화면에서 씬이 차지할 비율. 나머지는 뒤의 마을이 비치는 여백이다 */
const VIEWPORT_WIDTH_RATIO = 0.9;
const VIEWPORT_HEIGHT_RATIO = 0.88;

export default function SceneFrame({ children }: { children: React.ReactNode }) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  const measure = useCallback(() => {
    const el = contentRef.current;
    if (!el) {
      return;
    }

    // transform 은 offset 크기에 영향을 주지 않으므로 축소 중에도 원래 크기가 나온다.
    const naturalHeight = el.offsetHeight;
    if (naturalHeight === 0) {
      return;
    }

    const maxWidth = window.innerWidth * VIEWPORT_WIDTH_RATIO;
    const maxHeight = window.innerHeight * VIEWPORT_HEIGHT_RATIO;

    // 1 을 넘기지 않는다. 작은 씬을 억지로 확대하면 픽셀아트가 뭉갠다.
    const next = Math.min(maxWidth / SCENE_WIDTH, maxHeight / naturalHeight, 1);

    // 같은 값이면 state 를 건드리지 않는다. 미세한 차이로 계속 갱신하면
    // 리렌더 → 재측정이 맞물려 배율이 진동한다.
    setScale((current) => (Math.abs(current - next) < 0.001 ? current : next));
  }, []);

  useLayoutEffect(measure, [measure]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) {
      return;
    }

    // 씬 안에서 내용이 늘거나 줄면(목록 로드, 단계 변화) 배율을 다시 잡는다.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);

    /**
     * ResizeObserver 만 믿지 않는다. 콜백이 페인트 직전에 배달되는 규격이라
     * 창이 화면에 그려지지 않는 환경에서는 한 번도 오지 않는 경우가 있다.
     * 그러면 씬은 마운트 직후의(내용이 덜 찬) 높이로 배율이 굳어 화면 밖으로
     * 삐져나간다. 목록·이미지가 들어오는 초반 몇 초만 직접 다시 재서 메운다.
     */
    const timers = [50, 150, 400, 800, 1500, 2500].map((delay) =>
      window.setTimeout(measure, delay),
    );

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      timers.forEach(window.clearTimeout);
    };
  }, [measure]);

  return (
    // 틀에는 크기를 주지 않는다. 크기를 주면 그 크기가 씬의 레이아웃에 영향을
    // 주고, 바뀐 레이아웃이 다시 배율을 바꾸는 되먹임이 생긴다. 화면 한가운데
    // 점 하나를 잡고 거기에 씬을 걸어두면 그런 고리가 아예 없다.
    <div className="scene-frame">
      <div
        ref={contentRef}
        className="scene-frame-content"
        style={{
          width: SCENE_WIDTH,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
