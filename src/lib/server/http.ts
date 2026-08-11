import { NextResponse } from 'next/server';

import { DomainError } from '@/lib/server/errors';
import { UnauthenticatedError } from '@/lib/server/session';
import type { ApiError } from '@/types/api';

export function apiError(message: string, status: number) {
  return NextResponse.json<ApiError>({ error: message }, { status });
}

/** 서비스 계층에서 던진 에러를 적절한 HTTP 응답으로 변환한다. 내부 에러 메시지는 노출하지 않는다. */
export function handleApiError(error: unknown) {
  if (error instanceof UnauthenticatedError) {
    return apiError(error.message, 401);
  }
  if (error instanceof DomainError) {
    return apiError(error.message, 400);
  }
  console.error(error);
  return apiError('알 수 없는 오류가 발생했습니다.', 500);
}
