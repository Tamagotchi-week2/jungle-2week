import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/server/http';
import { requireUserId } from '@/lib/server/session';
import { deleteGuestbookEntry } from '@/lib/server/services/guestbook';

/** 방명록 삭제. 작성자 본인만 가능하다 (17.6) */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    await deleteGuestbookEntry(userId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
