import type { HistoryResponse, PoliciesResponse } from '../components/history/types';
import { apiRequest } from './http';

export async function getExecutions(
  date: string,
  status: string | undefined,
  limit = 30,
  cursor?: string
) {
  const params = new URLSearchParams({ date, limit: String(limit) });
  if (status && status !== 'all') params.set('status', status);
  if (cursor) params.set('cursor', cursor);

  return apiRequest<HistoryResponse>(`/history?${params.toString()}`);
}

export async function getPolicies(executionId: string) {
  return apiRequest<PoliciesResponse>(`/history/${executionId}/policies`);
}

export default { getExecutions, getPolicies };
