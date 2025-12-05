// ============================================================================
// History Route - AST Execution History (Side-by-Side Layout)
// ============================================================================

import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { ThemeToggle } from '../components/ThemeToggle'
import { useExecutionObserver } from '../hooks/useExecutionObserver'
import { getApiUrl } from '../config'

// ============================================================================
// Types
// ============================================================================

type ExecutionStatus = 'running' | 'success' | 'failed' | 'paused' | 'cancelled'
type TabFilter = 'all' | ExecutionStatus

interface ExecutionRecord {
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

interface PolicyRecord {
  execution_id: string
  policy_number: string
  status: 'success' | 'failed' | 'skipped'
  duration_ms: number
  started_at: string
  completed_at: string
  error?: string
  policy_data?: Record<string, unknown>
}

interface HistoryResponse {
  executions: ExecutionRecord[]
  nextCursor?: string
  hasMore: boolean
  date: string
  status: string
}

interface PoliciesResponse {
  policies: PolicyRecord[]
  nextCursor?: string
  hasMore: boolean
}

// ============================================================================
// Route Definition
// ============================================================================

export const Route = createFileRoute('/history')({
  component: HistoryPage,
})

// ============================================================================
// Constants
// ============================================================================

const STATUS_TABS: { id: TabFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'running', label: 'Running' },
  { id: 'success', label: 'Completed' },
  { id: 'failed', label: 'Failed' },
  { id: 'paused', label: 'Paused' },
  { id: 'cancelled', label: 'Cancelled' },
]

const STATUS_COLORS: Record<ExecutionStatus | 'success' | 'failed' | 'skipped', string> = {
  running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  paused: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  cancelled: 'bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300',
  skipped: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
}

const STATUS_ICONS: Record<ExecutionStatus | 'success' | 'failed' | 'skipped', string> = {
  running: '⏳',
  success: '✓',
  failed: '✕',
  paused: '⏸',
  cancelled: '⊘',
  skipped: '○',
}

// ============================================================================
// Helper Functions
// ============================================================================

/** Get local date string in YYYY-MM-DD format */
function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// ============================================================================
// Sub-Components
// ============================================================================

function TabBar({ activeTab, onTabChange }: { activeTab: TabFilter; onTabChange: (tab: TabFilter) => void }) {
  return (
    <div className="flex flex-wrap gap-1 p-1 bg-gray-100 dark:bg-zinc-800/50 rounded-lg">
      {STATUS_TABS.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onTabChange(id)}
          className={`
            px-2 py-1 text-xs font-medium rounded-md transition-all duration-200 whitespace-nowrap
            ${activeTab === id
              ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-sm'
              : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200'
            }
          `}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function DatePicker({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  const today = getLocalDateString()
  const isToday = value === today
  
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => {
          const date = new Date(value + 'T12:00:00') // Use noon to avoid timezone issues
          date.setDate(date.getDate() - 1)
          onChange(getLocalDateString(date))
        }}
        className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      
      <input
        type="date"
        value={value}
        max={today}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 py-1 text-xs font-medium rounded bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700"
      />
      
      <button
        onClick={() => {
          const date = new Date(value + 'T12:00:00') // Use noon to avoid timezone issues
          date.setDate(date.getDate() + 1)
          const next = getLocalDateString(date)
          if (next <= today) onChange(next)
        }}
        disabled={isToday}
        className={`p-1.5 rounded transition-colors ${isToday ? 'opacity-50' : 'hover:bg-gray-100 dark:hover:bg-zinc-800'}`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
      
      {!isToday && (
        <button
          onClick={() => onChange(today)}
          className="px-2 py-1 text-xs font-medium rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
        >
          Today
        </button>
      )}
    </div>
  )
}

function Breadcrumb({ 
  items 
}: { 
  items: Array<{ label: string; onClick?: () => void }> 
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2">
          {idx > 0 && <span className="text-gray-400 dark:text-zinc-600">/</span>}
          {item.onClick ? (
            <button
              onClick={item.onClick}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {item.label}
            </button>
          ) : (
            <span className="text-gray-700 dark:text-zinc-300 font-medium">{item.label}</span>
          )}
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// Panel 1: Executions List
// ============================================================================

interface ExecutionListItemProps {
  execution: ExecutionRecord
  isSelected: boolean
  onClick: () => void
}

function ExecutionListItem({ execution, isSelected, onClick }: ExecutionListItemProps) {
  const startTime = new Date(execution.started_at)
  const formatTime = (date: Date) => date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  
  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left p-3 rounded-lg transition-all duration-150
        ${isSelected 
          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 ring-1 ring-blue-300 dark:ring-blue-700'
          : 'bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 border-gray-200 dark:border-zinc-800'
        }
        border
      `}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-gray-900 dark:text-zinc-100 text-sm truncate">
          {execution.ast_name}
        </span>
        <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex items-center gap-1 ${STATUS_COLORS[execution.status]}`}>
          {execution.status === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
          {STATUS_ICONS[execution.status]} {execution.status}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-zinc-500">
        <span>{formatTime(startTime)}</span>
        <span>{execution.policy_count} policies</span>
        {execution.failed_count ? <span className="text-red-500">✕{execution.failed_count}</span> : null}
        {execution.success_count ? <span className="text-emerald-500">✓{execution.success_count}</span> : null}
      </div>
    </button>
  )
}

// ============================================================================
// Panel 2: Policies List
// ============================================================================

interface PoliciesListProps {
  execution: ExecutionRecord
  policies: PolicyRecord[]
  livePolicies: Array<{ itemId: string; status: string; durationMs?: number; error?: string; data?: Record<string, unknown> }>
  isLoading: boolean
  selectedPolicy: PolicyRecord | null
  onSelectPolicy: (policy: PolicyRecord) => void
  onBack: () => void
  isLive: boolean
  liveProgress: { current: number; total: number; percent: number; message?: string } | null
  observerStatus: 'disconnected' | 'connecting' | 'connected' | 'error'
  isPaused: boolean
  onPause: () => void
  onResume: () => void
  onCancel: () => void
}

function PoliciesList({ 
  execution, 
  policies, 
  livePolicies,
  isLoading, 
  selectedPolicy, 
  onSelectPolicy, 
  onBack,
  isLive,
  liveProgress,
  observerStatus,
  isPaused,
  onPause,
  onResume,
  onCancel,
}: PoliciesListProps) {
  // Merge fetched policies with live updates
  // For running executions: start with fetched, update/add from live
  const allPolicies = useMemo(() => {
    // Create a map for O(1) lookups
    const policyMap = new Map<string, PolicyRecord>()
    
    // First, add all fetched policies
    for (const p of policies) {
      policyMap.set(p.policy_number, p)
    }
    
    // Then, update with live policies (or add if new)
    for (const lp of livePolicies) {
      const existing = policyMap.get(lp.itemId)
      if (existing) {
        // Update existing policy with live data
        policyMap.set(lp.itemId, {
          ...existing,
          status: lp.status as 'success' | 'failed' | 'skipped',
          duration_ms: lp.durationMs || existing.duration_ms,
          error: lp.error || existing.error,
          policy_data: lp.data || existing.policy_data,
        })
      } else {
        // Add new live policy
        policyMap.set(lp.itemId, {
          execution_id: execution.execution_id,
          policy_number: lp.itemId,
          status: lp.status as 'success' | 'failed' | 'skipped',
          duration_ms: lp.durationMs || 0,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          error: lp.error,
          policy_data: lp.data,
        })
      }
    }
    
    return Array.from(policyMap.values())
  }, [policies, livePolicies, execution.execution_id])

  // Calculate combined counts from all policies (fetched + live)
  const combinedCounts = useMemo(() => ({
    success: allPolicies.filter(p => p.status === 'success').length,
    failed: allPolicies.filter(p => p.status === 'failed').length,
    skipped: allPolicies.filter(p => p.status === 'skipped').length,
  }), [allPolicies])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-zinc-800">
        <Breadcrumb items={[
          { label: 'Executions', onClick: onBack },
          { label: execution.ast_name }
        ]} />
        
        <div className="mt-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">
              Policies
            </h2>
            <p className="text-xs text-gray-500 dark:text-zinc-500">
              {execution.host_user || 'unknown'} • {new Date(execution.started_at).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isLive && (
              <span className={`px-2 py-0.5 text-xs rounded-full ${
                observerStatus === 'connected' 
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                  : observerStatus === 'connecting'
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                  : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'
              }`}>
                {observerStatus === 'connected' ? '● Live' : observerStatus === 'connecting' ? '○ Connecting...' : '○ Disconnected'}
              </span>
            )}
            <span className={`px-2.5 py-1 text-xs font-medium rounded-full flex items-center gap-1.5 ${STATUS_COLORS[execution.status]}`}>
              {execution.status === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
              {STATUS_ICONS[execution.status]} {execution.status}
            </span>
          </div>
        </div>
        
        {/* Live Progress Bar */}
        {isLive && (
          <div className="mt-3 space-y-2">
            <div className="flex justify-between text-xs text-gray-500 dark:text-zinc-500">
              <span>
                {isPaused 
                  ? '⏸ Paused - Make manual adjustments, then resume'
                  : liveProgress?.message 
                    ? liveProgress.message.replace(/^Policy \d+\/\d+:\s*/, '') // Remove "Policy X/Y: " prefix
                    : (observerStatus === 'connecting' ? 'Connecting to session...' : 'Waiting for updates...')
                }
              </span>
              <span>{liveProgress ? `${allPolicies.length}/${liveProgress.total}` : `${combinedCounts.success + combinedCounts.failed + combinedCounts.skipped} processed`}</span>
            </div>
            <div className="h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${isPaused ? 'bg-amber-500' : 'bg-blue-500'}`}
                style={{ width: `${liveProgress ? (allPolicies.length / liveProgress.total) * 100 : 0}%` }}
              />
            </div>
            
            {/* Control Buttons */}
            <div className="flex items-center gap-2 pt-1">
              {isPaused ? (
                <button
                  type="button"
                  onClick={onResume}
                  className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                  Resume
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onPause}
                  className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
                  </svg>
                  Pause
                </button>
              )}
              <button
                type="button"
                onClick={onCancel}
                className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
                Stop
              </button>
            </div>
          </div>
        )}
        
        {/* Stats */}
        <div className="mt-3 flex items-center gap-4 text-xs">
          <span className="text-gray-600 dark:text-zinc-400">
            {allPolicies.length}/{execution.policy_count || '?'} policies
          </span>
          {isLive ? (
            // Show combined counts (fetched + live) when running
            <>
              <span className="text-emerald-600 dark:text-emerald-400">✓ {combinedCounts.success}</span>
              {combinedCounts.failed > 0 && (
                <span className="text-red-600 dark:text-red-400">✕ {combinedCounts.failed}</span>
              )}
              {combinedCounts.skipped > 0 && (
                <span className="text-yellow-600 dark:text-yellow-400">○ {combinedCounts.skipped}</span>
              )}
            </>
          ) : (
            // Show stored counts for completed executions
            <>
              {execution.success_count !== undefined && (
                <span className="text-emerald-600 dark:text-emerald-400">✓ {execution.success_count}</span>
              )}
              {execution.failed_count !== undefined && execution.failed_count > 0 && (
                <span className="text-red-600 dark:text-red-400">✕ {execution.failed_count}</span>
              )}
              {execution.skipped_count !== undefined && execution.skipped_count > 0 && (
                <span className="text-yellow-600 dark:text-yellow-400">○ {execution.skipped_count}</span>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* Policies List */}
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {isLoading && allPolicies.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-gray-200 dark:border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : allPolicies.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-zinc-500 text-sm">
            {isLive ? 'Waiting for policies...' : 'No policies found'}
          </div>
        ) : (
          allPolicies.map((policy) => (
            <button
              key={policy.policy_number}
              onClick={() => onSelectPolicy(policy)}
              className={`
                w-full text-left p-3 rounded-lg transition-all duration-150 border
                ${selectedPolicy?.policy_number === policy.policy_number
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 ring-1 ring-blue-300 dark:ring-blue-700'
                  : 'bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 border-gray-200 dark:border-zinc-800'
                }
              `}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-gray-900 dark:text-zinc-100">
                  {policy.policy_number}
                </span>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[policy.status]}`}>
                  {STATUS_ICONS[policy.status]} {policy.status}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-zinc-500">
                <span>{(policy.duration_ms / 1000).toFixed(1)}s</span>
                {policy.error && <span className="text-red-500 truncate max-w-[200px]">{policy.error}</span>}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Panel 3: Policy Detail
// ============================================================================

interface PolicyDetailProps {
  policy: PolicyRecord
  execution: ExecutionRecord
  onBack: () => void
}

function PolicyDetail({ policy, execution, onBack }: PolicyDetailProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-zinc-800">
        <Breadcrumb items={[
          { label: 'Executions', onClick: onBack },
          { label: execution.ast_name, onClick: onBack },
          { label: policy.policy_number }
        ]} />
        
        <div className="mt-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold font-mono text-gray-900 dark:text-zinc-100">
            {policy.policy_number}
          </h2>
          <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[policy.status]}`}>
            {STATUS_ICONS[policy.status]} {policy.status}
          </span>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-zinc-800/50">
            <div className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Duration</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-zinc-100">
              {(policy.duration_ms / 1000).toFixed(2)}s
            </div>
          </div>
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-zinc-800/50">
            <div className="text-xs text-gray-500 dark:text-zinc-500 mb-1">Status</div>
            <div className={`text-lg font-semibold ${
              policy.status === 'success' ? 'text-emerald-600 dark:text-emerald-400' :
              policy.status === 'failed' ? 'text-red-600 dark:text-red-400' :
              'text-yellow-600 dark:text-yellow-400'
            }`}>
              {policy.status.charAt(0).toUpperCase() + policy.status.slice(1)}
            </div>
          </div>
        </div>
        
        {/* Timestamps */}
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-zinc-800/50 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-zinc-500">Started</span>
            <span className="text-gray-900 dark:text-zinc-100 font-mono text-xs">
              {new Date(policy.started_at).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-zinc-500">Completed</span>
            <span className="text-gray-900 dark:text-zinc-100 font-mono text-xs">
              {new Date(policy.completed_at).toLocaleString()}
            </span>
          </div>
        </div>
        
        {/* Error */}
        {policy.error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <div className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">Error</div>
            <pre className="text-sm text-red-600 dark:text-red-300 whitespace-pre-wrap font-mono">
              {policy.error}
            </pre>
          </div>
        )}
        
        {/* Policy Data */}
        {policy.policy_data && Object.keys(policy.policy_data).length > 0 && (
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-zinc-800/50">
            <div className="text-xs font-medium text-gray-700 dark:text-zinc-300 mb-2">Policy Data</div>
            <pre className="text-xs text-gray-600 dark:text-zinc-400 whitespace-pre-wrap font-mono overflow-x-auto">
              {JSON.stringify(policy.policy_data, null, 2)}
            </pre>
          </div>
        )}
        
        {/* Actions - only show for failed policies */}
        {policy.status === 'failed' && (
          <div className="flex gap-2 pt-2">
            <button
              className="flex-1 px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
            >
              Re-run Policy
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Empty States
// ============================================================================

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-zinc-600">
      <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
      <p className="text-sm">{message}</p>
    </div>
  )
}

// ============================================================================
// Main Page Component
// ============================================================================

function HistoryPage() {
  const { state: authState, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  
  // List state
  const [activeTab, setActiveTab] = useState<TabFilter>('all')
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString())
  const [executions, setExecutions] = useState<ExecutionRecord[]>([])
  const [isLoadingExecutions, setIsLoadingExecutions] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [cursor, setCursor] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  
  // Selection state
  const [selectedExecution, setSelectedExecution] = useState<ExecutionRecord | null>(null)
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyRecord | null>(null)
  
  // Policies state
  const [policies, setPolicies] = useState<PolicyRecord[]>([])
  const [isLoadingPolicies, setIsLoadingPolicies] = useState(false)
  
  const observerTarget = useRef<HTMLDivElement>(null)
  
  // Live execution observer - observe both running and paused executions
  const isLive = selectedExecution?.status === 'running' || selectedExecution?.status === 'paused'
  
  const { 
    status: observerStatus, 
    progress: liveProgress, 
    policyResults: livePolicies,
    astStatus,
    isPaused,
    pause: pauseExecution,
    resume: resumeExecution,
    cancel: cancelExecution,
  } = useExecutionObserver({
    sessionId: selectedExecution?.session_id || null,
    executionId: selectedExecution?.execution_id || '',
    enabled: isLive,
    initialPaused: selectedExecution?.status === 'paused',
  })

  // Update execution status when AST completes via WebSocket
  useEffect(() => {
    if (astStatus && selectedExecution && isLive) {
      const newStatus = astStatus.status as ExecutionStatus
      if (newStatus !== 'running' && newStatus !== selectedExecution.status) {
        // Calculate final counts from livePolicies + fetched policies
        const allPolicies = new Map<string, { status: string }>()
        for (const p of policies) {
          allPolicies.set(p.policy_number, { status: p.status })
        }
        for (const lp of livePolicies) {
          allPolicies.set(lp.itemId, { status: lp.status })
        }
        
        const successCount = Array.from(allPolicies.values()).filter(p => p.status === 'success').length
        const failedCount = Array.from(allPolicies.values()).filter(p => p.status === 'failed').length
        const skippedCount = Array.from(allPolicies.values()).filter(p => p.status === 'skipped').length
        
        // Update the selected execution with new status
        setSelectedExecution(prev => prev ? {
          ...prev,
          status: newStatus,
          completed_at: new Date().toISOString(),
          message: astStatus.message,
          success_count: successCount,
          failed_count: failedCount,
          skipped_count: skippedCount,
        } : null)
        
        // Also update in the executions list
        setExecutions(prev => prev.map(e => 
          e.execution_id === selectedExecution.execution_id
            ? {
                ...e,
                status: newStatus,
                completed_at: new Date().toISOString(),
                message: astStatus.message,
                success_count: successCount,
                failed_count: failedCount,
                skipped_count: skippedCount,
              }
            : e
        ))
      }
    }
  }, [astStatus, selectedExecution, isLive, livePolicies, policies])

  // Update execution status when paused state changes
  // Only depend on isPaused and isLive - use refs for the execution data to avoid loops
  const selectedExecutionIdRef = useRef(selectedExecution?.execution_id)
  const selectedExecutionStatusRef = useRef(selectedExecution?.status)
  const isPausedInitializedRef = useRef(false)
  
  // Reset the initialized flag when execution changes
  useEffect(() => {
    isPausedInitializedRef.current = false
  }, [selectedExecution?.execution_id])
  
  // Track when execution changes to update refs
  if (selectedExecutionIdRef.current !== selectedExecution?.execution_id) {
    selectedExecutionIdRef.current = selectedExecution?.execution_id
    selectedExecutionStatusRef.current = selectedExecution?.status
  }
  
  useEffect(() => {
    if (!isLive || !selectedExecutionIdRef.current) return
    
    // Skip the first run - only update status after WebSocket sends isPaused changes
    if (!isPausedInitializedRef.current) {
      isPausedInitializedRef.current = true
      return
    }
    
    const newStatus = isPaused ? 'paused' : 'running'
    if (newStatus !== selectedExecutionStatusRef.current) {
      const executionId = selectedExecutionIdRef.current
      selectedExecutionStatusRef.current = newStatus
      // Update the selected execution with new status
      setSelectedExecution(prev => prev ? {
        ...prev,
        status: newStatus,
      } : null)
      
      // Also update in the executions list
      setExecutions(prev => prev.map(e => 
        e.execution_id === executionId
          ? { ...e, status: newStatus }
          : e
      ))
    }
  }, [isPaused, isLive])

  // Fetch executions
  const fetchExecutions = useCallback(async (reset = false) => {
    if (isLoadingExecutions) return
    
    setIsLoadingExecutions(true)
    setError(null)
    
    try {
      const params = new URLSearchParams({ date: selectedDate, limit: '30' })
      if (activeTab !== 'all') params.set('status', activeTab)
      if (!reset && cursor) params.set('cursor', cursor)
      
      const token = localStorage.getItem('terminal_auth_token')
      const response = await fetch(getApiUrl(`/history?${params}`), {
        headers: { Authorization: `Bearer ${token}` },
      })
      
      if (!response.ok) throw new Error('Failed to fetch history')
      
      const data = await response.json() as { success: boolean; data: HistoryResponse }
      
      if (data.success) {
        setExecutions(prev => reset ? data.data.executions : [...prev, ...data.data.executions])
        setHasMore(data.data.hasMore)
        setCursor(data.data.nextCursor)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history')
    } finally {
      setIsLoadingExecutions(false)
    }
  }, [selectedDate, activeTab, cursor, isLoadingExecutions])

  // Fetch policies for selected execution
  const fetchPolicies = useCallback(async (executionId: string) => {
    setIsLoadingPolicies(true)
    setPolicies([])
    
    try {
      const token = localStorage.getItem('terminal_auth_token')
      const url = getApiUrl(`/history/${executionId}/policies`)
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      
      if (!response.ok) throw new Error('Failed to fetch policies')
      
      const data = await response.json() as { success: boolean; data: PoliciesResponse }
      
      if (data.success) {
        setPolicies(data.data.policies)
      }
    } catch (err) {
      console.error('Failed to fetch policies:', err)
    } finally {
      setIsLoadingPolicies(false)
    }
  }, [])

  // Reset and fetch when date or tab changes
  useEffect(() => {
    setExecutions([])
    setCursor(undefined)
    setHasMore(false)
    setSelectedExecution(null)
    setSelectedPolicy(null)
    void fetchExecutions(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, activeTab])

  // Fetch policies when execution is selected (only when execution_id changes, not status)
  const selectedExecutionId = selectedExecution?.execution_id
  useEffect(() => {
    if (selectedExecutionId) {
      setSelectedPolicy(null)
      void fetchPolicies(selectedExecutionId)
    }
  }, [selectedExecutionId, fetchPolicies])

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoadingExecutions) {
          void fetchExecutions()
        }
      },
      { threshold: 0.1 }
    )
    
    if (observerTarget.current) observer.observe(observerTarget.current)
    return () => observer.disconnect()
  }, [hasMore, isLoadingExecutions, fetchExecutions])

  // Filter executions
  const filteredExecutions = activeTab === 'all'
    ? executions
    : executions.filter(e => e.status === activeTab)

  const handleSelectExecution = (execution: ExecutionRecord) => {
    setSelectedExecution(execution)
    setSelectedPolicy(null)
  }

  const handleBackToList = () => {
    setSelectedExecution(null)
    setSelectedPolicy(null)
    setPolicies([])
  }

  const handleBackToPolicies = () => {
    setSelectedPolicy(null)
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800">
        <div className="flex items-center gap-4">
          <span className="text-base font-semibold text-gray-900 dark:text-zinc-100">TN3270 Terminal</span>
          <nav className="flex items-center gap-1">
            <Link to="/" className="px-2 py-1 text-xs rounded transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800 [&.active]:bg-blue-100 [&.active]:text-blue-700 dark:[&.active]:bg-blue-900/30 dark:[&.active]:text-blue-400">
              Terminal
            </Link>
            <Link to="/history" className="px-2 py-1 text-xs rounded transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800 [&.active]:bg-blue-100 [&.active]:text-blue-700 dark:[&.active]:bg-blue-900/30 dark:[&.active]:text-blue-400">
              History
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <span className="text-xs text-gray-500 dark:text-zinc-500">{authState.user?.email}</span>
          <button
            onClick={() => void logout()}
            className="px-2 py-1 text-xs rounded bg-gray-200 dark:bg-zinc-800 hover:bg-gray-300 dark:hover:bg-zinc-700"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content - Three Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Panel 1: Executions List */}
        <div className="w-[480px] flex-shrink-0 bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 flex flex-col">
          {/* Controls */}
          <div className="p-3 border-b border-gray-200 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <h1 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">History</h1>
              <DatePicker value={selectedDate} onChange={setSelectedDate} />
            </div>
            <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
          </div>
          
          {/* List */}
          <div className="flex-1 overflow-auto p-3 space-y-2">
            {error && (
              <div className="p-2 rounded bg-red-50 dark:bg-red-900/20 text-xs text-red-700 dark:text-red-400">
                {error}
              </div>
            )}
            
            {filteredExecutions.map((execution) => (
              <ExecutionListItem
                key={execution.execution_id}
                execution={execution}
                isSelected={selectedExecution?.execution_id === execution.execution_id}
                onClick={() => handleSelectExecution(execution)}
              />
            ))}
            
            <div ref={observerTarget} className="h-2" />
            
            {isLoadingExecutions && (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-gray-200 dark:border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
              </div>
            )}
            
            {!isLoadingExecutions && filteredExecutions.length === 0 && (
              <EmptyPanel message="No executions found" />
            )}
          </div>
        </div>

        {/* Panel 2: Policies List */}
        <div className="w-[480px] flex-shrink-0 bg-gray-50 dark:bg-zinc-900/50 border-r border-gray-200 dark:border-zinc-800">
          {selectedExecution ? (
            <PoliciesList
              execution={selectedExecution}
              policies={policies}
              livePolicies={livePolicies}
              isLoading={isLoadingPolicies}
              selectedPolicy={selectedPolicy}
              onSelectPolicy={setSelectedPolicy}
              onBack={handleBackToList}
              isLive={isLive}
              liveProgress={liveProgress}
              observerStatus={observerStatus}
              isPaused={isPaused}
              onPause={pauseExecution}
              onResume={resumeExecution}
              onCancel={cancelExecution}
            />
          ) : (
            <EmptyPanel message="Select an execution to view policies" />
          )}
        </div>

        {/* Panel 3: Policy Detail */}
        <div className="flex-1 bg-white dark:bg-zinc-900">
          {selectedPolicy && selectedExecution ? (
            <PolicyDetail
              policy={selectedPolicy}
              execution={selectedExecution}
              onBack={handleBackToPolicies}
            />
          ) : selectedExecution ? (
            <EmptyPanel message="Select a policy to view details" />
          ) : (
            <EmptyPanel message="Select an execution to get started" />
          )}
        </div>
      </div>
    </div>
  )
}
