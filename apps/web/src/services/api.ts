import { getApiUrl } from '../config';
import { msalInstance, apiConfig } from '../config/msalConfig';
import type { HistoryResponse, PoliciesResponse } from '../components/history/types';

async function getApiToken(): Promise<string> {
  const account = msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0];
  if (!account) throw new Error('Not authenticated');

  const response = await msalInstance.acquireTokenSilent({
    scopes: apiConfig.scopes,
    account,
  });
  return response.accessToken;
}

async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = await getApiToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const res = await fetch(url, { headers, ...init });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(txt || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function getExecutions(date: string, status: string | undefined, limit = 30, cursor?: string) {
  const params = new URLSearchParams({ date, limit: String(limit) });
  if (status && status !== 'all') params.set('status', status);
  if (cursor) params.set('cursor', cursor);

  const url = getApiUrl(`/history?${params.toString()}`);
  const data = await fetchJson<{ success: boolean; data: HistoryResponse }>(url);
  if (!data.success) throw new Error('Failed to fetch executions');
  return data.data;
}

export async function getPolicies(executionId: string) {
  const url = getApiUrl(`/history/${executionId}/policies`);
  const data = await fetchJson<{ success: boolean; data: PoliciesResponse }>(url);
  if (!data.success) throw new Error('Failed to fetch policies');
  return data.data;
}

export default { getExecutions, getPolicies };
