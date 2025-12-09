import { getApiUrl } from '../config';
import { acquireApiToken } from '../auth/entra';

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await acquireApiToken();
  const headers = new Headers(init.headers ?? {});
  headers.set('Authorization', `Bearer ${token}`);

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(getApiUrl(path), {
    ...init,
    headers,
    credentials: 'include',
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof data === 'object' && data && 'error' in (data as Record<string, unknown>)
        ? (data as any).error?.message
        : response.statusText;
    throw new Error(message || 'Request failed');
  }

  if (data && typeof data === 'object' && 'success' in data) {
    if ((data as any).success) {
      return (data as any).data as T;
    }
    throw new Error((data as any).error?.message ?? 'Request failed');
  }

  return data as T;
}

