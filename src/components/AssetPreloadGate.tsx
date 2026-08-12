'use client';

/**
 * 첫 접속 시 public/sprites 전체를 프리로드하고, 끝날 때까지 로딩 화면을 보여준다.
 * 이후 페이지 어디서든 스프라이트가 이미 브라우저 캐시에 있어 즉시 뜬다.
 *
 * 같은 세션(sessionStorage) 안에서는 다시 하드 리프레시해도 스킵한다 — 이미
 * 캐시된 이미지를 또 로딩 화면 뒤에서 기다리게 할 필요는 없다.
 */
import { useEffect, useState } from 'react';

import { SPRITE_ASSETS } from '@/generated/spriteManifest';
import { preloadImagesWithProgress } from '@/lib/client/preloadQueue';

const SESSION_KEY = 'tamajungle:assetsPreloaded';
const CONCURRENCY = 4;

export function AssetPreloadGate({ children }: { children: React.ReactNode }) {
  const [done, setDone] = useState(
    () => typeof window !== 'undefined' && sessionStorage.getItem(SESSION_KEY) === '1',
  );
  const [progress, setProgress] = useState({ loaded: 0, total: SPRITE_ASSETS.length });

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === '1') {
      return;
    }

    let cancelled = false;
    preloadImagesWithProgress(SPRITE_ASSETS, CONCURRENCY, (loaded, total) => {
      if (!cancelled) setProgress({ loaded, total });
    }).then(() => {
      if (cancelled) return;
      sessionStorage.setItem(SESSION_KEY, '1');
      setDone(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (done) return <>{children}</>;

  const pct = progress.total === 0 ? 100 : Math.round((progress.loaded / progress.total) * 100);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
      style={{ backgroundColor: '#fdf6ea', fontFamily: 'var(--font-pixel)' }}
    >
      <p className="tracking-widest uppercase" style={{ color: '#5a3a1f', fontSize: '14px' }}>
        불러오는 중...
      </p>
      <div
        className="overflow-hidden rounded-sm"
        style={{
          width: 'min(70vw, 320px)',
          height: '14px',
          backgroundColor: '#e7d5b6',
          border: '2px solid #5a3a1f',
        }}
      >
        <div
          className="h-full transition-[width] duration-150 ease-out"
          style={{ width: `${pct}%`, backgroundColor: '#8a5a34' }}
        />
      </div>
      <p style={{ color: '#5a3a1f99', fontSize: '11px' }}>
        {progress.loaded} / {progress.total} ({pct}%)
      </p>
    </div>
  );
}
