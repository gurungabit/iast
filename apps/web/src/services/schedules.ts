// ============================================================================
// Schedules API Service
// ============================================================================

import { getApiUrl } from '../config';
import { getAccessToken } from '../utils/tokenAccessor';

// ============================================================================
// Types
// ============================================================================

export interface Schedule {
    scheduleId: string;
    astName: string;
    scheduledTime: string;
    timezone: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    sessionId?: string;
    executionId?: string;
    createdAt: number;
}

export interface CreateScheduleParams {
    astName: string;
    scheduledTime: string;
    timezone: string;
    credentials: {
        username: string;
        password: string;
    };
    params: Record<string, unknown>;
    notifyEmail?: string;
}

export interface CreateScheduleResult {
    scheduleId: string;
}

// ============================================================================
// Helper
// ============================================================================

async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
    const token = await getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (init.body) headers['Content-Type'] = 'application/json';

    const res = await fetch(url, { headers, ...init });
    if (!res.ok) {
        const txt = await res.text().catch(() => '');
        let errorMessage = txt || `Request failed: ${res.status}`;
        try {
            const parsed = JSON.parse(txt) as { error?: { message?: string } };
            if (parsed.error?.message) errorMessage = parsed.error.message;
        } catch {
            // Use text as-is
        }
        throw new Error(errorMessage);
    }
    return (await res.json()) as T;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get all schedules for the current user
 */
export async function getSchedules(): Promise<Schedule[]> {
    const url = getApiUrl('/schedules');
    const data = await fetchJson<{ success: boolean; data: Schedule[] }>(url);
    if (!data.success) throw new Error('Failed to fetch schedules');
    return data.data ?? [];
}

/**
 * Create a new schedule
 */
export async function createSchedule(params: CreateScheduleParams): Promise<CreateScheduleResult> {
    const url = getApiUrl('/schedules');
    const data = await fetchJson<{ success: boolean; data: CreateScheduleResult }>(url, {
        method: 'POST',
        body: JSON.stringify(params),
    });
    if (!data.success) throw new Error('Failed to create schedule');
    return data.data;
}

/**
 * Cancel a pending schedule
 */
export async function cancelSchedule(scheduleId: string): Promise<void> {
    const url = getApiUrl(`/schedules/${scheduleId}`);
    const data = await fetchJson<{ success: boolean }>(url, {
        method: 'DELETE',
    });
    if (!data.success) throw new Error('Failed to cancel schedule');
}

/**
 * Run a schedule immediately
 */
export async function runScheduleNow(scheduleId: string): Promise<void> {
    const url = getApiUrl(`/schedules/${scheduleId}/run`);
    const data = await fetchJson<{ success: boolean }>(url, {
        method: 'POST',
    });
    if (!data.success) throw new Error('Failed to run schedule');
}

export default { getSchedules, createSchedule, cancelSchedule, runScheduleNow };
