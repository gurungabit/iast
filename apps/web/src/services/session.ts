// ============================================================================
// Session API Service
// ============================================================================

import type { UserSession } from '@terminal/shared';
import type { ExecutionRecord } from '../components/history/types';
import { apiRequest } from './http';

export async function createSession(name: string): Promise<UserSession> {
  const data = await apiRequest<UserSession>('/sessions', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  return data;
}

export async function getSessions(): Promise<UserSession[]> {
  return apiRequest<UserSession[]>('/sessions');
}

export async function getSession(sessionId: string): Promise<UserSession> {
  return apiRequest<UserSession>(`/sessions/${sessionId}`);
}

export async function updateSession(sessionId: string, name: string): Promise<UserSession> {
  return apiRequest<UserSession>(`/sessions/${sessionId}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
}

export async function deleteSession(sessionId: string): Promise<void> {
  await apiRequest<{ message: string }>(`/sessions/${sessionId}`, {
    method: 'DELETE',
  });
}

/**
 * Get the active (running or paused) execution for a session
 */
export async function getActiveExecution(sessionId: string): Promise<ExecutionRecord | null> {
  const data = await apiRequest<{ execution: ExecutionRecord | null }>(
    `/sessions/${sessionId}/execution`
  );
  return data.execution;
}

export default { createSession, getSessions, getSession, updateSession, deleteSession, getActiveExecution };
