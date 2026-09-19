import { isBrowserOnline, readOfflineCache, writeOfflineCache } from '@/lib/offlineCache';
import { markRestricted, useAuthStore } from '@/store/auth';
import { apiUrl } from '@/services/api/baseUrl';

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
  };
};

type ApiSuccess<T> = {
  data: T;
};

const AUTH_NO_CACHE = new Set([
  '/auth/me',
  '/auth/login',
  '/auth/logout',
  '/auth/refresh',
]);
const AUTH_NO_REFRESH = new Set(['/auth/refresh', '/auth/login', '/auth/logout']);

let refreshInFlight: Promise<boolean> | null = null;

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

async function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = fetch(apiUrl('/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

function throwApiError(body: ApiErrorBody, status: number): never {
  const code = body.error?.code ?? 'REQUEST_FAILED';
  const message = body.error?.message ?? 'Request failed.';
  if (code === 'ACCOUNT_RESTRICTED' || code === 'ACCOUNT_DISABLED') {
    markRestricted(message);
    useAuthStore.getState().clearSession();
  }
  throw new ApiError(message, code, status);
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const cacheable = method === 'GET' && !AUTH_NO_CACHE.has(path);
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const send = () =>
    fetch(apiUrl(path), {
      credentials: 'include',
      ...init,
      headers,
    });

  try {
    let response = await send();
    if (response.status === 401 && !AUTH_NO_REFRESH.has(path)) {
      const renewed = await refreshSession();
      if (renewed) {
        response = await send();
      }
    }

    const body = (await response.json().catch(() => ({}))) as ApiErrorBody &
      ApiSuccess<T>;
    if (!response.ok) {
      if (cacheable && !isBrowserOnline()) {
        const cached = readOfflineCache<T>(path);
        if (cached !== null) {
          return cached;
        }
      }
      throwApiError(body, response.status);
    }

    if (cacheable) {
      writeOfflineCache(path, body.data);
    }
    return body.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (cacheable) {
      const cached = readOfflineCache<T>(path);
      if (cached !== null) {
        return cached;
      }
    }
    throw error;
  }
}
