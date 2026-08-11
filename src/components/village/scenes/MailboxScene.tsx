"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import type { GuestbookEntryView, GuestbookListResponse } from "@/types/api";

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MailboxScene() {
  const [message, setMessage] = useState("");
  const [entries, setEntries] = useState<GuestbookEntryView[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const canSubmit = message.trim().length > 0 && !sending;

  /** 전역 게시판이라 남이 쓴 글도 함께 온다 (설계 17.6) */
  const load = useCallback(async () => {
    const res = await fetch("/api/guestbook");
    if (!res.ok) {
      const body = (await res.json()) as { error?: string };
      setFeedback(body.error ?? "방명록을 불러오지 못했습니다.");
      return;
    }
    const body = (await res.json()) as GuestbookListResponse;
    setEntries(body.entries);
    setFeedback(null);
  }, []);

  useEffect(() => {
    // 마운트 시 1회 로드. setState 는 await 이후에만 일어나 실제 연쇄 렌더는 없다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [entries],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setSending(true);
    const res = await fetch("/api/guestbook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message.trim() }),
    });
    setSending(false);

    if (!res.ok) {
      // 길이 초과·작성 쿨다운(1분)이 여기로 온다
      const body = (await res.json()) as { error?: string };
      setFeedback(body.error ?? "등록에 실패했습니다.");
      return;
    }

    setMessage("");
    setFeedback(null);
    await load();
  }

  return (
    <div className="guestbook-pixel mx-auto max-w-6xl px-4 py-6 text-[#3c2818] font-sans">
      <section className="guestbook-board relative overflow-hidden rounded-[2.75rem] border border-[#5b3b23] bg-[#a86f43] shadow-[0_24px_80px_rgba(79,40,18,0.26)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_40%),repeating-linear-gradient(180deg,rgba(0,0,0,0.06),rgba(0,0,0,0.06)_1px,transparent_1px,transparent_10px)] opacity-90" />
        <div className="absolute inset-x-10 top-6 h-4 rounded-full bg-[#4e2f1c]/80 shadow-[0_2px_8px_rgba(0,0,0,0.15)]" />
        <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-4">
          <span className="h-4 w-4 rounded-full border border-[#392111] bg-[#dcc8a7] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.25)]" />
          <span className="h-1 w-12 rounded-full bg-[#392111]" />
          <span className="h-4 w-4 rounded-full border border-[#392111] bg-[#dcc8a7] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.25)]" />
        </div>

        <div className="relative z-10 grid gap-6 lg:grid-cols-[1.1fr_1fr] p-8">
          <div className="guestbook-panel rounded-[2rem] border border-[#5b3b23] bg-[#f2e1c3]/95 p-6 shadow-[inset_0_0_0_1px_rgba(89,55,29,0.14)]">
            <p className="text-xs uppercase tracking-[0.35em] text-[#6d4b31]">방명록</p>
            <h2 className="mt-3 text-2xl font-semibold text-[#3c2818]">메시지 남기기</h2>
            <p className="mt-2 text-sm leading-6 text-[#5d422a]">
              마을 사람들에게 남길 메모를 작성해 보세요. 최신 글이 방명록 맨 위에 표시됩니다.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block text-sm font-semibold text-[#3c2818]" htmlFor="guestbook-message">
                메시지
              </label>
              <textarea
                id="guestbook-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={6}
                maxLength={200}
                className="guestbook-input w-full resize-none rounded-[1.75rem] border border-[#8f6945] bg-[#f8efde] px-4 py-3 text-sm text-[#3c2818] outline-none transition focus:border-[#7e542f] focus:ring-2 focus:ring-[#7e542f]/20"
                placeholder="방명록을 남겨보세요..."
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-[#846041]">최대 200자. 1분에 한 번 등록 가능합니다.</span>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="guestbook-button rounded-full bg-[#7a4f2f] px-5 py-2 text-sm font-semibold text-[#f7e8d3] transition hover:bg-[#8c5d3b] disabled:cursor-not-allowed disabled:bg-[#b79c7f]"
                >
                  기록 남기기
                </button>
              </div>
            </form>

            <div className="guestbook-notice mt-6 rounded-[1.75rem] border border-[#8c6949] bg-[#f3ddba]/90 p-4 text-sm text-[#6d4b31] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
              <p className="font-semibold text-[#4c2f1c]">안내</p>
              <p className="mt-2">이 창에서는 왼쪽에 메시지를 쓰고 오른쪽에서 최신 방명록을 확인할 수 있습니다.</p>
            </div>
          </div>

          <div className="guestbook-panel rounded-[2rem] border border-[#5b3b23] bg-[#f7e7ca]/95 p-6 shadow-[inset_0_0_0_1px_rgba(89,55,29,0.14)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-[#6d4b31]">방명록</p>
                <p className="mt-2 text-2xl font-semibold text-[#3c2818]">최신 글</p>
              </div>
              <span className="guestbook-count rounded-full bg-[#d6b58f] px-3 py-2 text-xs font-semibold text-[#3c2818]">
                {sortedEntries.length}개
              </span>
            </div>

            <div className="mt-5 space-y-4 max-h-[520px] overflow-y-auto pr-2">
              {sortedEntries.map((entry) => (
                <article
                  key={entry.id}
                  className="guestbook-entry rounded-[1.75rem] border border-[#8c6949] bg-[#fff1da] p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[#3c2818]">{entry.authorNickname}</p>
                      <p className="text-xs text-[#846041]">{formatTimestamp(entry.createdAt)}</p>
                    </div>
                    {entry.mine ? (
                      <span className="guestbook-mine rounded-full bg-[#7a4f2f]/15 px-2 py-1 text-[11px] font-semibold uppercase text-[#7a4f2f]">
                        내 글
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#4c2f1c]">{entry.message}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
