import type { GuestbookEntryView, GuestbookListResponse } from '@/types/api';

interface ApiErrorBody {
  error?: string;
}

async function request<TResponse>(url: string, init?: RequestInit): Promise<TResponse> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const data = (await res.json()) as TResponse | ApiErrorBody;
  if (!res.ok) {
    throw new Error((data as ApiErrorBody).error ?? '요청을 처리하지 못했습니다.');
  }
  return data as TResponse;
}

export function listGuestbookEntries(cursor?: string) {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return request<GuestbookListResponse>(`/api/guestbook${query}`);
}

export function createGuestbookEntry(message: string) {
  return request<GuestbookEntryView>('/api/guestbook', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export function deleteGuestbookEntry(id: string) {
  return request<{ ok: true }>(`/api/guestbook/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
