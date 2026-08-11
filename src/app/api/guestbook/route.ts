import { NextResponse, type NextRequest } from 'next/server';

import { apiError, handleApiError } from '@/lib/server/http';
import { getCurrentUserId } from '@/lib/server/session';
import { createGuestbookEntry, listGuestbookEntries } from '@/lib/server/services/guestbook';
import type { GuestbookCreateRequest } from '@/types/api';

/** 방명록 목록 조회 (최신순, 커서 페이지네이션) */
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const cursor = request.nextUrl.searchParams.get('cursor') ?? undefined;
    const result = await listGuestbookEntries(userId, cursor);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/** 방명록 작성 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const body = (await request.json()) as Partial<GuestbookCreateRequest>;
    if (typeof body.message !== 'string') {
      return apiError('message 가 필요합니다.', 400);
    }

    const entry = await createGuestbookEntry(userId, body.message);
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
