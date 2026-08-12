import { NextResponse, type NextRequest } from 'next/server';

import { apiError, handleApiError } from '@/lib/server/http';
import { getCurrentUserId } from '@/lib/server/session';
import { cancelTrade } from '@/lib/server/services/trade';
import type { TradeCancelRequest } from '@/types/api';

/**
 * 교환 취소 (9장). 제안자가 직접 잠금을 푼다.
 * 없으면 상대가 오지 않을 때 만료 3분을 기다려야 한다.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const body = (await request.json()) as Partial<TradeCancelRequest>;
    if (typeof body.tradeId !== 'string' || !body.tradeId) {
      return apiError('tradeId 가 필요합니다.', 400);
    }

    return NextResponse.json(await cancelTrade(userId, body.tradeId));
  } catch (error) {
    return handleApiError(error);
  }
}
