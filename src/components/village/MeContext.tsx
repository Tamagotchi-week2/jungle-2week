'use client';

/**
 * 마을 화면 전역의 서버 현황(`GET /api/me`).
 *
 * 씬들이 프로퍼티 없이 렌더링되므로 컨텍스트로 내려준다. 각 씬이 따로
 * /api/me 를 부르면 같은 데이터를 여러 번 가져오고, 자원을 쓴 뒤 HUD 만
 * 갱신되지 않는 어긋남이 생긴다.
 *
 * 자원·알 개수를 바꾸는 동작(채집·먹이·부화·보상 수령) 뒤에는 refresh() 를 부른다.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import type { MeResponse } from '@/types/api';

interface MeContextValue {
  me: MeResponse | null;
  /** 서버 현황을 다시 가져온다. 자원·알이 변한 뒤 호출 */
  refresh: () => Promise<void>;
  /** 채집 완료 응답의 자원 수치를 서버 재조회 없이 HUD에 반영한다. */
  applyResources: (resources: MeResponse['resources']) => void;
  error: string | null;
}

const MeContext = createContext<MeContextValue | null>(null);

export function MeProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/me');
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(body.error ?? '현황을 불러오지 못했습니다.');
        return;
      }
      setMe((await res.json()) as MeResponse);
      setError(null);
    } catch {
      setError('서버에 연결하지 못했습니다.');
    }
  }, []);

  const applyResources = useCallback((resources: MeResponse['resources']) => {
    setMe((current) => (current ? { ...current, resources } : current));
  }, []);

  useEffect(() => {
    // 마운트 시 1회 로드. setState 는 await 이후에만 일어나 실제 연쇄 렌더는 없다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  return (
    <MeContext.Provider value={{ me, refresh, applyResources, error }}>
      {children}
    </MeContext.Provider>
  );
}

export function useMe(): MeContextValue {
  const ctx = useContext(MeContext);
  if (!ctx) {
    throw new Error('useMe 는 MeProvider 안에서만 쓸 수 있다');
  }
  return ctx;
}
