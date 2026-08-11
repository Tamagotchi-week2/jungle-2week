import { NextResponse, type NextRequest } from 'next/server';

import { apiError, handleApiError } from '@/lib/server/http';
import { requireUserId } from '@/lib/server/session';
import { joinTrade } from '@/lib/server/services/trade';
import type { TradeJoinRequest } from '@/types/api';

/** 코드를 입력하고 내 성체를 지정한다 (17.4 2단계) */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = (await request.json()) as Partial<TradeJoinRequest>;
    if (typeof body.code !== 'string' || !body.code) {
      return apiError('code 가 필요합니다.', 400);
    }
    if (typeof body.petId !== 'string' || !body.petId) {
      return apiError('petId 가 필요합니다.', 400);
    }

    const result = await joinTrade(userId, body.code.toUpperCase(), body.petId);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
