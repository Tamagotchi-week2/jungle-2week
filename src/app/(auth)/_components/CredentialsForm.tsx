'use client';

import { useActionState, useState, useTransition } from 'react';

import type { AuthActionState, NicknameCheckResult } from '../actions';
import { cq } from './scale';
import { TypewriterText } from './TypewriterText';

interface CredentialsFormProps {
  action: (state: AuthActionState, formData: FormData) => Promise<AuthActionState>;
  submitLabel: string;
  footer: React.ReactNode;
  /** 넘기면 닉네임 입력창 옆에 "중복확인" 버튼이 뜬다. 로그인 폼에서는 쓰지 않는다. */
  checkNickname?: (nickname: string) => Promise<NicknameCheckResult>;
}

export function CredentialsForm({
  action,
  submitLabel,
  footer,
  checkNickname,
}: CredentialsFormProps) {
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(
    action,
    undefined,
  );
  const [nickname, setNickname] = useState('');
  const [checkedNickname, setCheckedNickname] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<NicknameCheckResult | null>(null);
  const [isChecking, startCheckTransition] = useTransition();

  const inputStyle = { fontSize: cq(13), padding: `${cq(4)} ${cq(8)}`, color: '#5a3a1f' };
  const labelStyle = { fontSize: cq(11), color: '#5a3a1f', opacity: 0.75 };

  const handleCheckNickname = () => {
    if (!checkNickname || !nickname || isChecking) return;
    const target = nickname;
    startCheckTransition(async () => {
      const result = await checkNickname(target);
      setCheckedNickname(target);
      setCheckResult(result);
    });
  };

  const nicknameIsChecked = checkedNickname === nickname;
  const canSubmit = !checkNickname || (nicknameIsChecked && checkResult?.available === true);

  return (
    <form
      action={formAction}
      className="flex w-full flex-col"
      style={{ gap: cq(6), color: '#5a3a1f' }}
    >
      <div className="flex flex-col text-left" style={{ gap: cq(3) }}>
        <label htmlFor="nickname" className="font-medium" style={labelStyle}>
          <TypewriterText text="닉네임" delay={250} />
        </label>
        <div className="flex" style={{ gap: cq(3) }}>
          <input
            id="nickname"
            name="nickname"
            autoComplete="username"
            required
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-0 min-w-0 flex-1 rounded border bg-white/90"
            style={{ ...inputStyle, borderColor: 'rgba(107,66,38,0.35)' }}
          />
          {checkNickname && (
            <button
              type="button"
              onClick={handleCheckNickname}
              disabled={!nickname || isChecking}
              className="shrink-0 rounded whitespace-nowrap disabled:opacity-50"
              style={{
                fontSize: cq(10),
                padding: `${cq(3)} ${cq(6)}`,
                backgroundColor: '#6b4226',
                color: '#fdf6ea',
              }}
            >
              {isChecking ? '확인 중' : '중복확인'}
            </button>
          )}
        </div>
        {checkNickname && nicknameIsChecked && checkResult && (
          <p
            style={{
              fontSize: cq(10),
              color: checkResult.available ? '#2f7a3d' : '#b3261e',
            }}
          >
            {checkResult.available ? '사용 가능한 닉네임입니다.' : checkResult.reason}
          </p>
        )}
      </div>
      <div className="flex flex-col text-left" style={{ gap: cq(3) }}>
        <label htmlFor="password" className="font-medium" style={labelStyle}>
          <TypewriterText text="비밀번호" delay={550} />
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded border bg-white/90"
          style={{ ...inputStyle, borderColor: 'rgba(107,66,38,0.35)' }}
        />
      </div>
      {state?.error && (
        <p className="text-red-700" style={{ fontSize: cq(11) }}>
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || !canSubmit}
        className="rounded disabled:opacity-50"
        style={{
          fontSize: cq(13),
          padding: `${cq(6)} ${cq(12)}`,
          backgroundColor: '#6b4226',
          color: '#fdf6ea',
        }}
      >
        {pending ? '처리 중...' : submitLabel}
      </button>
      {footer}
    </form>
  );
}
