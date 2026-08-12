/**
 * 도감 "NEW" 배지 — 계정이 아직 확인하지 않은 종/폼을 브라우저에 기억해둔다.
 *
 * 서버는 소유 여부(hasNormal/hasAlbino)만 내려주고 "확인했는가"는 들고 있지
 * 않는다. 여러 화면(집 · 도감)이 같은 저장소를 보고 같은 기준으로 배지를
 * 켜고 꺼야 하므로 여기 한 곳에 모아둔다.
 */

import type { Combo, EggType } from '@/lib/game/types';

export type DexForm = 'normal' | 'albino';

function storageKey(nickname: string): string {
  return `dex-seen:${nickname}`;
}

function baselinedKey(nickname: string): string {
  return `dex-seen-baselined:${nickname}`;
}

export function dexFormKey(eggType: EggType, combo: Combo, form: DexForm): string {
  return `${eggType}:${combo}:${form}`;
}

export function loadSeenDexForms(nickname: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(storageKey(nickname));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveSeenDexForms(nickname: string, seen: Set<string>): void {
  window.localStorage.setItem(storageKey(nickname), JSON.stringify([...seen]));
}

/**
 * 도감 화면에서 딱 한 번, 그 시점에 이미 보유한 폼을 전부 "확인함"으로
 * 깔아준다. 그렇지 않으면 이 기능이 배포된 순간 이미 갖고 있던 도감 전체가
 * 한꺼번에 NEW 로 뜬다 — 실제로는 아무것도 새로 얻지 않았는데도.
 *
 * 집 화면의 축하 연출이 먼저 몇 칸을 "확인함"으로 남겼을 수도 있으니 그 값과
 * 합친다. 별도의 baselined 플래그로 딱 한 번만 실행되게 막는다 — 그렇지
 * 않으면 매번 "지금 가진 것"을 전부 확인 처리해버려 새 발견이 영영 안 뜬다.
 */
export function seedSeenDexFormsOnce(nickname: string, currentlyOwned: string[]): Set<string> {
  if (window.localStorage.getItem(baselinedKey(nickname)) !== null) {
    return loadSeenDexForms(nickname);
  }
  const merged = new Set([...loadSeenDexForms(nickname), ...currentlyOwned]);
  saveSeenDexForms(nickname, merged);
  window.localStorage.setItem(baselinedKey(nickname), '1');
  return merged;
}

/** 폼 하나(또는 여러 개)를 "확인함"으로 저장하고 갱신된 집합을 돌려준다 */
export function markDexFormsSeen(
  nickname: string,
  keys: string[],
  current: Set<string>,
): Set<string> {
  const next = new Set(current);
  let changed = false;
  for (const key of keys) {
    if (!next.has(key)) {
      next.add(key);
      changed = true;
    }
  }
  if (changed) saveSeenDexForms(nickname, next);
  return next;
}
