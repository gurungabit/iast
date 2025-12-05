// ============================================================================
// Execution List Item Component
// ============================================================================

import { Check, X } from 'lucide-react'
import { StatusIcon } from './StatusIcon'
import { STATUS_COLORS, type ExecutionRecord } from './types'

interface ExecutionListItemProps {
  execution: ExecutionRecord
  isSelected: boolean
  onClick: () => void
}

export function ExecutionListItem({ execution, isSelected, onClick }: ExecutionListItemProps) {
  const startTime = new Date(execution.started_at)
  const formatTime = (date: Date) => date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  
  return (
    <button
      onClick={onClick}
      className={`
        cursor-pointer w-full text-left p-3 rounded-lg transition-all duration-150
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
          <StatusIcon status={execution.status} />
          {execution.status}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-zinc-500">
        <span>{formatTime(startTime)}</span>
        <span>{execution.policy_count} policies</span>
        {execution.failed_count ? <span className="text-red-500 flex items-center gap-0.5"><X className="w-3 h-3" />{execution.failed_count}</span> : null}
        {execution.success_count ? <span className="text-emerald-500 flex items-center gap-0.5"><Check className="w-3 h-3" />{execution.success_count}</span> : null}
      </div>
    </button>
  )
}
