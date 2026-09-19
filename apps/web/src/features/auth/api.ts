import type { SessionUser } from '@teakflow/shared';
import { apiRequest } from '@/services/api/client';

export function loginRequest(email: string, password: string) {
  return apiRequest<SessionUser>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function logoutRequest() {
  return apiRequest<{ ok: boolean }>('/auth/logout', { method: 'POST' });
}

export function meRequest() {
  return apiRequest<SessionUser>('/auth/me');
}
