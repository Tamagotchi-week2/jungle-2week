import Link from 'next/link';

import { login } from '../actions';
import { CredentialsForm } from '../_components/CredentialsForm';

export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">로그인</h1>
      <CredentialsForm
        action={login}
        submitLabel="로그인"
        footer={
          <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
            계정이 없나요?{' '}
            <Link href="/signup" className="font-medium underline">
              가입하기
            </Link>
          </p>
        }
      />
    </div>
  );
}
