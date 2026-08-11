import { NextResponse, type NextRequest } from 'next/server';

import { apiError, handleApiError } from '@/lib/server/http';
import { getCurrentUserId } from '@/lib/server/session';
import { resolveTrade } from '@/lib/server/services/trade';
import type { TradeResolveRequest } from '@/types/api';

/** 제안자가 최종 수락 / 거절한다 (17.4 3·4단계) */
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const body = (await request.json()) as Partial<TradeResolveRequest>;
    if (typeof body.tradeId !== 'string' || !body.tradeId) {
      return apiError('tradeId 가 필요합니다.', 400);
    }
    if (typeof body.accept !== 'boolean') {
      return apiError('accept 가 필요합니다.', 400);
    }

    const result = await resolveTrade(userId, body.tradeId, body.accept);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
