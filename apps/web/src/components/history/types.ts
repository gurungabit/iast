// ============================================================================
// History Types
// ============================================================================

export type ExecutionStatus = 'running' | 'success' | 'failed' | 'paused' | 'cancelled'
export type TabFilter = 'all' | ExecutionStatus

export interface ExecutionRecord {
  execution_id: string
  session_id: string
  host_user?: string
  ast_name: string
  status: ExecutionStatus
  started_at: string
  completed_at?: string
  message?: string
  error?: string
  policy_count: number
  success_count?: number
  failed_count?: number
  skipped_count?: number
}

export interface PolicyRecord {
  execution_id: string
  policy_number: string
  status: 'success' | 'failed' | 'skipped'
  duration_ms: number
  started_at: string
  completed_at: string
  error?: string
  policy_data?: Record<string, unknown>
}

export interface HistoryResponse {
  executions: ExecutionRecord[]
  nextCursor?: string
  hasMore: boolean
  date: string
  status: string
}

export interface PoliciesResponse {
  policies: PolicyRecord[]
  nextCursor?: string
  hasMore: boolean
}

export const STATUS_TABS: { id: TabFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'running', label: 'Running' },
  { id: 'success', label: 'Completed' },
  { id: 'failed', label: 'Failed' },
  { id: 'paused', label: 'Paused' },
  { id: 'cancelled', label: 'Cancelled' },
]

export const STATUS_COLORS: Record<ExecutionStatus | 'success' | 'failed' | 'skipped', string> = {
  running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  paused: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  cancelled: 'bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300',
  skipped: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
}
