import { NextResponse, type NextRequest } from 'next/server';

import { apiError, handleApiError } from '@/lib/server/http';
import { requireUserId } from '@/lib/server/session';
import { createTrade } from '@/lib/server/services/trade';
import type { TradeCreateRequest } from '@/types/api';

/** 내 성체를 걸고 6자리 교환 코드를 발급한다 (9장 / 17.4 1단계) */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = (await request.json()) as Partial<TradeCreateRequest>;
    if (typeof body.petId !== 'string' || !body.petId) {
      return apiError('petId 가 필요합니다.', 400);
    }

    const result = await createTrade(userId, body.petId);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
