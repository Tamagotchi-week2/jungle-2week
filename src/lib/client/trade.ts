import type {
  TradeCreateRequest,
  TradeCreateResponse,
  TradeJoinRequest,
  TradeJoinResponse,
  TradeCancelRequest,
  TradeCancelResponse,
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
  /** 내가 제안자인가. 확정·취소 권한이 제안자에게만 있어 단계 판정에 쓴다 */
  iAmProposer: boolean;
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

/** 제안자가 교환을 취소한다. 잠긴 개체가 함께 풀린다 */
export function cancelTrade(body: TradeCancelRequest) {
  return request<TradeCancelResponse>('/api/trade/cancel', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getTradeStatus(code: string) {
  return request<TradeStatusView>(`/api/trade/${encodeURIComponent(code)}`);
}
