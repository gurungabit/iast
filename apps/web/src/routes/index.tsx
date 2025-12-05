// ============================================================================
// Index Route - Terminal Page
// ============================================================================

import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { useAST } from '../hooks/useAST'
import { Terminal } from '../components/Terminal'
import { ThemeToggle } from '../components/ThemeToggle'
import { ASTPanel } from '../ast'
import { Link } from '@tanstack/react-router'
import type { ASTStatusMeta, ASTProgressMeta, ASTItemResultMeta } from '@terminal/shared'
import type { ASTItemStatus } from '../ast/types'

export const Route = createFileRoute('/')({
  component: TerminalPage,
})

interface TerminalApi {
  runAST: (astName: string, params?: Record<string, unknown>) => void
}

function TerminalPage() {
  const { state: authState, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { setRunCallback, handleASTComplete, handleASTProgress, handleASTItemResult, handleASTPaused, reset: resetAST } = useAST()

  // Reset AST state when Terminal page mounts (in case user navigated back from History
  // where an AST completed without this page knowing)
  useEffect(() => {
    resetAST()
  }, [resetAST])

  const handleTerminalReady = useCallback(
    (api: TerminalApi) => {
      setRunCallback(api.runAST)
    },
    [setRunCallback]
  )

  const handleASTStatus = useCallback(
    (status: ASTStatusMeta) => {
      const mappedStatus = status.status === 'pending' ? 'running' : status.status
      handleASTComplete({
        status: mappedStatus,
        message: status.message,
        error: status.error,
        duration: status.duration,
        data: status.data,
      })
    },
    [handleASTComplete]
  )

  const handleASTProgressUpdate = useCallback(
    (progress: ASTProgressMeta) => {
      handleASTProgress({
        current: progress.current,
        total: progress.total,
        currentItem: progress.currentItem,
        itemStatus: progress.itemStatus as ASTItemStatus | undefined,
        message: progress.message,
        percentage: progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0,
      })
    },
    [handleASTProgress]
  )

  const handleASTItemResultUpdate = useCallback(
    (itemResult: ASTItemResultMeta) => {
      handleASTItemResult({
        itemId: itemResult.itemId,
        status: itemResult.status as ASTItemStatus,
        durationMs: itemResult.durationMs,
        error: itemResult.error,
        data: itemResult.data,
      })
    },
    [handleASTItemResult]
  )

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-100">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800">
        <div className="flex items-center gap-6">
          <span className="text-lg font-semibold text-gray-900 dark:text-zinc-100">
            TN3270 Terminal
          </span>
          <nav className="flex items-center gap-1">
            <Link
              to="/"
              className="px-3 py-1.5 text-sm rounded-md transition-colors
                [&.active]:bg-blue-100 [&.active]:text-blue-700 
                dark:[&.active]:bg-blue-900/30 dark:[&.active]:text-blue-400
                hover:bg-gray-100 dark:hover:bg-zinc-800"
            >
              Terminal
            </Link>
            <Link
              to="/history"
              className="px-3 py-1.5 text-sm rounded-md transition-colors
                [&.active]:bg-blue-100 [&.active]:text-blue-700 
                dark:[&.active]:bg-blue-900/30 dark:[&.active]:text-blue-400
                hover:bg-gray-100 dark:hover:bg-zinc-800"
            >
              History
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <span className="text-sm text-gray-500 dark:text-zinc-500">
            {authState.user?.email}
          </span>
          <button
            onClick={() => void logout()}
            className="px-3 py-1.5 text-sm rounded transition-colors cursor-pointer
              bg-gray-200 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200
              hover:bg-gray-300 dark:hover:bg-zinc-700"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Terminal + AST Panel */}
      <main className="flex-1 overflow-auto flex p-4 gap-4">
        <Terminal
          autoConnect={true}
          onReady={handleTerminalReady}
          onASTStatus={handleASTStatus}
          onASTProgress={handleASTProgressUpdate}
          onASTItemResult={handleASTItemResultUpdate}
          onASTPaused={handleASTPaused}
        />

        {/* Side panel for AST controls */}
        <div className="w-[400px] flex-shrink-0">
          <ASTPanel />
        </div>
      </main>
    </div>
  )
}
