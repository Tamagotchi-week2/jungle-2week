import { db } from '@/lib/server/db';
import { DomainError } from '@/lib/server/errors';
import type { GuestbookEntryView, GuestbookListResponse } from '@/types/api';

/** 설계 문서 17.6 제약 */
const PAGE_SIZE = 50;
const POST_COOLDOWN_MS = 60 * 1000;
const MESSAGE_MAX_LENGTH = 200;

export class GuestbookError extends DomainError {}

interface EntryWithAuthor {
  id: string;
  message: string;
  createdAt: Date;
  authorUserId: string;
  author: { nickname: string };
}

function toView(entry: EntryWithAuthor, userId: string): GuestbookEntryView {
  return {
    id: entry.id,
    authorNickname: entry.author.nickname,
    message: entry.message,
    createdAt: entry.createdAt.toISOString(),
    mine: entry.authorUserId === userId,
  };
}

/** 전역 게시판 목록. 최신순, 커서 기반 페이지네이션 (17.6) */
export async function listGuestbookEntries(
  userId: string,
  cursor?: string,
): Promise<GuestbookListResponse> {
  const rows = await db.guestbookEntry.findMany({
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: 'desc' },
    include: { author: { select: { nickname: true } } },
  });

  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  return {
    entries: page.map((entry) => toView(entry, userId)),
    hasMore,
  };
}

/** 작성. 작성자는 세션에서 도출하며 요청 바디를 신뢰하지 않는다 (17.6) */
export async function createGuestbookEntry(
  userId: string,
  message: string,
): Promise<GuestbookEntryView> {
  const trimmed = message.trim();
  if (!trimmed) {
    throw new GuestbookError('메시지를 입력해 주세요.');
  }
  if (trimmed.length > MESSAGE_MAX_LENGTH) {
    throw new GuestbookError(`메시지는 ${MESSAGE_MAX_LENGTH}자를 넘을 수 없습니다.`);
  }

  const last = await db.guestbookEntry.findFirst({
    where: { authorUserId: userId },
    orderBy: { createdAt: 'desc' },
  });
  if (last && Date.now() - last.createdAt.getTime() < POST_COOLDOWN_MS) {
    throw new GuestbookError('글 작성은 1분에 1회만 가능합니다.');
  }

  const created = await db.guestbookEntry.create({
    data: { authorUserId: userId, message: trimmed },
    include: { author: { select: { nickname: true } } },
  });

  return toView(created, userId);
}

/** 삭제. 작성자 본인 여부를 세션 사용자와 대조한다 (17.6) */
export async function deleteGuestbookEntry(
  userId: string,
  entryId: string,
): Promise<void> {
  const entry = await db.guestbookEntry.findUnique({ where: { id: entryId } });
  if (!entry) {
    throw new GuestbookError('존재하지 않는 글입니다.');
  }
  if (entry.authorUserId !== userId) {
    throw new GuestbookError('본인이 작성한 글만 삭제할 수 있습니다.');
  }
  await db.guestbookEntry.delete({ where: { id: entryId } });
}
