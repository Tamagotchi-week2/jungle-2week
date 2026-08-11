import Link from 'next/link';

import { login } from '../actions';
import { CredentialsForm } from '../_components/CredentialsForm';
import { cq } from '../_components/scale';
import { TypewriterText } from '../_components/TypewriterText';

export default function LoginPage() {
  return (
    <div
      className="flex w-full flex-col items-center text-center"
      style={{ gap: cq(10), padding: cq(12) }}
    >
      <h1
        className="font-bold tracking-widest uppercase"
        style={{ fontSize: cq(12), color: '#5a3a1f' }}
      >
        <TypewriterText text="로그인" />
      </h1>
      <CredentialsForm
        action={login}
        submitLabel="로그인"
        footer={
          <p className="text-center" style={{ fontSize: cq(11), color: '#5a3a1f99' }}>
            계정이 없나요?{' '}
            <Link href="/signup" className="font-medium underline" style={{ color: '#5a3a1f' }}>
              가입하기
            </Link>
          </p>
        }
      />
    </div>
  );
}
