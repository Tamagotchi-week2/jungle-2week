import Link from 'next/link';

import { signup } from '../actions';
import { CredentialsForm } from '../_components/CredentialsForm';

export default function SignupPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">가입하기</h1>
      <CredentialsForm
        action={signup}
        submitLabel="가입하기"
        footer={
          <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
            이미 계정이 있나요?{' '}
            <Link href="/login" className="font-medium underline">
              로그인
            </Link>
          </p>
        }
      />
    </div>
  );
}
