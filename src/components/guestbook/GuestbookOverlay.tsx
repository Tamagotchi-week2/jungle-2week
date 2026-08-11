'use client';

import { useEffect, useRef, useState } from 'react';

import {
  createGuestbookEntry,
  deleteGuestbookEntry,
  listGuestbookEntries,
} from '@/lib/client/guestbook';
import type { GuestbookEntryView } from '@/types/api';

const POLL_INTERVAL_MS = 10000;
const MESSAGE_MAX_LENGTH = 200;

interface GuestbookOverlayProps {
  onClose?: () => void;
}

export function GuestbookOverlay({ onClose }: GuestbookOverlayProps) {
  const [entries, setEntries] = useState<GuestbookEntryView[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const result = await listGuestbookEntries();
      setEntries(result.entries);
      setHasMore(result.hasMore);
    } catch {
      // 폴링 실패는 조용히 무시하고 다음 주기에 재시도한다
    }
  }

  async function loadMore() {
    const last = entries[entries.length - 1];
    if (!last) return;
    try {
      const result = await listGuestbookEntries(last.id);
      setEntries((prev) => [...prev, ...result.entries]);
      setHasMore(result.hasMore);
    } catch {
      // no-op
    }
  }

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 오버레이가 열릴 때 최초 목록을 가져온다
    refresh();
    pollRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;

    setBusy(true);
    setError(null);
    try {
      const created = await createGuestbookEntry(trimmed);
      setEntries((prev) => [created, ...prev]);
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '작성에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
    try {
      await deleteGuestbookEntry(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제에 실패했습니다.');
      refresh();
    }
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">방명록</h2>
        {onClose && (
          <button type="button" onClick={onClose} className="text-sm text-zinc-500">
            닫기
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={MESSAGE_MAX_LENGTH}
          rows={2}
          placeholder="메시지를 남겨보세요"
          className="resize-none rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400">
            {message.length}/{MESSAGE_MAX_LENGTH}
          </span>
          <button
            type="submit"
            disabled={busy || !message.trim()}
            className="rounded bg-foreground px-4 py-1.5 text-sm text-background disabled:opacity-50"
          >
            등록
          </button>
        </div>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <ul className="flex max-h-80 flex-col gap-3 overflow-y-auto">
        {entries.map((entry) => (
          <li key={entry.id} className="flex flex-col gap-1 border-b border-zinc-100 pb-2 dark:border-zinc-800">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{entry.authorNickname}</span>
              <span className="text-xs text-zinc-400">
                {new Date(entry.createdAt).toLocaleString('ko-KR')}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm">{entry.message}</p>
            {entry.mine && (
              <button
                type="button"
                onClick={() => handleDelete(entry.id)}
                className="self-start text-xs text-red-500"
              >
                삭제
              </button>
            )}
          </li>
        ))}
        {entries.length === 0 && (
          <li className="text-center text-sm text-zinc-400">아직 글이 없습니다.</li>
        )}
      </ul>

      {hasMore && (
        <button type="button" onClick={loadMore} className="text-sm text-zinc-500 underline">
          더 보기
        </button>
      )}
    </div>
  );
}
