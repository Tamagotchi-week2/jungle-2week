'use client';

import { useActionState } from 'react';

import type { AuthActionState } from '../actions';
import { cq } from './scale';
import { TypewriterText } from './TypewriterText';

interface CredentialsFormProps {
  action: (state: AuthActionState, formData: FormData) => Promise<AuthActionState>;
  submitLabel: string;
  footer: React.ReactNode;
}

export function CredentialsForm({ action, submitLabel, footer }: CredentialsFormProps) {
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(
    action,
    undefined,
  );

  const inputStyle = { fontSize: cq(13), padding: `${cq(4)} ${cq(8)}`, color: '#5a3a1f' };
  const labelStyle = { fontSize: cq(11), color: '#5a3a1f', opacity: 0.75 };

  return (
    <form
      action={formAction}
      className="flex w-full flex-col"
      style={{ gap: cq(8), color: '#5a3a1f' }}
    >
      <div className="flex flex-col text-left" style={{ gap: cq(4) }}>
        <label htmlFor="nickname" className="font-medium" style={labelStyle}>
          <TypewriterText text="닉네임" delay={250} />
        </label>
        <input
          id="nickname"
          name="nickname"
          autoComplete="username"
          required
          className="rounded border bg-white/90"
          style={{ ...inputStyle, borderColor: 'rgba(107,66,38,0.35)' }}
        />
      </div>
      <div className="flex flex-col text-left" style={{ gap: cq(4) }}>
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
        disabled={pending}
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
