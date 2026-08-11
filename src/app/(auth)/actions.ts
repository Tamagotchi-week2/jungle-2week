'use server';

import { AuthError } from 'next-auth';

import { signIn, signOut } from '@/lib/server/auth';
import { createUser, NicknameTakenError } from '@/lib/server/services/user';

export type AuthActionState = { error: string } | undefined;

const NICKNAME_MIN = 2;
const NICKNAME_MAX = 20;
const PASSWORD_MIN = 8;

function readCredentials(formData: FormData) {
  const nickname = formData.get('nickname');
  const password = formData.get('password');
  if (typeof nickname !== 'string' || typeof password !== 'string') {
    return null;
  }
  return { nickname, password };
}

function validateSignupInput(nickname: string, password: string): string | null {
  if (nickname.length < NICKNAME_MIN || nickname.length > NICKNAME_MAX) {
    return `닉네임은 ${NICKNAME_MIN}~${NICKNAME_MAX}자여야 합니다.`;
  }
  if (password.length < PASSWORD_MIN) {
    return `비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다.`;
  }
  return null;
}

export async function signup(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const credentials = readCredentials(formData);
  if (!credentials) {
    return { error: '닉네임과 비밀번호를 입력해 주세요.' };
  }
  const { nickname, password } = credentials;

  const validationError = validateSignupInput(nickname, password);
  if (validationError) {
    return { error: validationError };
  }

  try {
    await createUser(nickname, password);
  } catch (error) {
    if (error instanceof NicknameTakenError) {
      return { error: error.message };
    }
    throw error;
  }

  try {
    await signIn('credentials', { nickname, password, redirectTo: '/game' });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: '가입은 완료됐지만 자동 로그인에 실패했습니다. 로그인해 주세요.' };
    }
    throw error;
  }
}

export async function login(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const credentials = readCredentials(formData);
  if (!credentials || !credentials.nickname || !credentials.password) {
    return { error: '닉네임과 비밀번호를 입력해 주세요.' };
  }

  try {
    await signIn('credentials', {
      nickname: credentials.nickname,
      password: credentials.password,
      redirectTo: '/game',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: '닉네임 또는 비밀번호가 올바르지 않습니다.' };
    }
    throw error;
  }
}

export async function logout() {
  await signOut({ redirectTo: '/login' });
}
