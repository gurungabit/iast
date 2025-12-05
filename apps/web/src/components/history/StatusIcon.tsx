// ============================================================================
// Status Icon Component
// ============================================================================

import { Loader2, Check, X, Pause, Ban, Circle } from 'lucide-react'
import type { ExecutionStatus } from './types'

interface StatusIconProps {
  status: ExecutionStatus | 'success' | 'failed' | 'skipped'
  className?: string
}

export function StatusIcon({ status, className = 'w-3.5 h-3.5' }: StatusIconProps) {
  switch (status) {
    case 'running':
      return <Loader2 className={`${className} animate-spin`} />
    case 'success':
      return <Check className={className} />
    case 'failed':
      return <X className={className} />
    case 'paused':
      return <Pause className={className} />
    case 'cancelled':
      return <Ban className={className} />
    case 'skipped':
      return <Circle className={className} />
  }
}
