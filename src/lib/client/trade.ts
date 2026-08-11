import type {
  TradeCreateRequest,
  TradeCreateResponse,
  TradeJoinRequest,
  TradeJoinResponse,
  TradePetView,
  TradeResolveRequest,
  TradeResolveResponse,
} from '@/types/api';

export type TradeStatusValue = 'proposed' | 'joined' | 'accepted' | 'rejected' | 'cancelled';

/** src/app/api/trade/[code] 전용 응답 모양. api.ts 에는 정의되지 않은 내부 폴링 타입이다. */
export interface TradeStatusView {
  tradeId: string;
  status: TradeStatusValue;
  code: string;
  expiresAt: string;
  myPet: TradePetView;
  theirPet: TradePetView | null;
}

interface ApiErrorBody {
  error?: string;
}

async function request<TResponse>(url: string, init?: RequestInit): Promise<TResponse> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const data = (await res.json()) as TResponse | ApiErrorBody;
  if (!res.ok) {
    throw new Error((data as ApiErrorBody).error ?? '요청을 처리하지 못했습니다.');
  }
  return data as TResponse;
}

export function createTrade(body: TradeCreateRequest) {
  return request<TradeCreateResponse>('/api/trade', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function joinTrade(body: TradeJoinRequest) {
  return request<TradeJoinResponse>('/api/trade/join', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function resolveTrade(body: TradeResolveRequest) {
  return request<TradeResolveResponse>('/api/trade/resolve', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getTradeStatus(code: string) {
  return request<TradeStatusView>(`/api/trade/${encodeURIComponent(code)}`);
}
