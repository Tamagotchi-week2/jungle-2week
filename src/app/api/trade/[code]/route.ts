import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/server/http';
import { requireUserId } from '@/lib/server/session';
import { getTradeStatusByCode } from '@/lib/server/services/trade';

/** 교환 코드로 현재 상태를 조회한다. 제안자가 상대 참여를 대기하며 폴링할 때 쓴다 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const userId = await requireUserId();
    const { code } = await params;
    const status = await getTradeStatusByCode(userId, code.toUpperCase());
    return NextResponse.json(status);
  } catch (error) {
    return handleApiError(error);
  }
}
