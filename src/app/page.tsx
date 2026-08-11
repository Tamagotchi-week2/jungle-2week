import { redirect } from 'next/navigation';

import { auth } from '@/lib/server/auth';

/** 최초 진입점 (설계 17.1). 실제 라우팅은 proxy.ts 가 처리하지만, 직접 진입 시에도 방어적으로 분기한다. */
export default async function Home() {
  const session = await auth();
  redirect(session ? '/game' : '/login');
}
