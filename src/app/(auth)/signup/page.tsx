import Link from 'next/link';

import { checkNicknameAvailable, signup } from '../actions';
import { CredentialsForm } from '../_components/CredentialsForm';
import { cq } from '../_components/scale';
import { TypewriterText } from '../_components/TypewriterText';

export default function SignupPage() {
  return (
    <div
      className="flex w-full flex-col items-center text-center"
      style={{ gap: cq(10), padding: cq(12) }}
    >
      <h1
        className="font-bold tracking-widest uppercase"
        style={{ fontSize: cq(12), color: '#5a3a1f' }}
      >
        <TypewriterText text="가입하기" />
      </h1>
      <CredentialsForm
        action={signup}
        submitLabel="가입하기"
        checkNickname={checkNicknameAvailable}
        footer={
          <p className="text-center" style={{ fontSize: cq(11), color: '#5a3a1f99' }}>
            이미 계정이 있나요?{' '}
            <Link href="/login" className="font-medium underline" style={{ color: '#5a3a1f' }}>
              로그인
            </Link>
          </p>
        }
      />
    </div>
  );
}
