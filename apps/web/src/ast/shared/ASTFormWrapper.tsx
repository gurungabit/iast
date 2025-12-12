// ============================================================================
// ASTFormWrapper - Common wrapper for AST forms with shared inputs
// ============================================================================

import type { ReactNode } from 'react';
import { Card, StatusBadge, Toggle, ProgressBar, ItemResultList } from '../../components/ui';
import { CredentialsInput } from './CredentialsInput';
import type { ASTProgress, ASTItemResult, ASTStatus } from '../types';

interface ASTFormWrapperProps {
  /** Card title */
  title: string;
  /** Card description */
  description: string;
  /** Form children (AST-specific inputs) */
  children: ReactNode;
  /** Footer content (buttons, etc.) */
  footer?: ReactNode;

  // Credentials
  username: string;
  password: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;

  // Test mode
  testMode: boolean;
  onTestModeChange: (value: boolean) => void;

  // Parallel execution (optional)
  showParallel?: boolean;
  parallel?: boolean;
  onParallelChange?: (value: boolean) => void;

  // Status
  status: ASTStatus;
  isRunning: boolean;
  lastResult?: {
    duration?: number;
    message?: string;
    error?: string;
  } | null;

  // Progress (optional)
  progress?: ASTProgress | null;
  itemResults?: ASTItemResult[];

  // Form submission
  onSubmit: (e: React.FormEvent) => void;
}

export function ASTFormWrapper({
  title,
  description,
  children,
  footer,
  username,
  password,
  onUsernameChange,
  onPasswordChange,
  testMode,
  onTestModeChange,
  showParallel = false,
  parallel = false,
  onParallelChange,
  status,
  isRunning,
  lastResult,
  progress,
  itemResults = [],
  onSubmit,
}: ASTFormWrapperProps): React.ReactNode {
  return (
    <Card
      title={title}
      description={description}
      footer={
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <StatusBadge status={status} />
            {lastResult?.duration && !isRunning && (
              <span className="text-xs text-gray-400 dark:text-zinc-500">
                {lastResult.duration.toFixed(1)}s
              </span>
            )}
          </div>
          {lastResult?.message && !isRunning && (
            <p className="text-xs text-gray-600 dark:text-zinc-400 break-words">
              {lastResult.message}
            </p>
          )}
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {/* Credentials - common to all ASTs */}
        <CredentialsInput
          username={username}
          password={password}
          onUsernameChange={onUsernameChange}
          onPasswordChange={onPasswordChange}
          disabled={isRunning}
        />

        {/* AST-specific inputs */}
        {children}

        {/* Test Mode Toggle - common to all ASTs */}
        <Toggle
          label="Test Mode"
          description="Run without making actual changes"
          checked={testMode}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onTestModeChange(e.target.checked)}
          disabled={isRunning}
        />

        {/* Parallel Processing Toggle (optional) */}
        {showParallel && onParallelChange && (
          <Toggle
            label="Parallel Processing"
            description="Process items concurrently (faster but uses more resources)"
            checked={parallel}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onParallelChange(e.target.checked)}
            disabled={isRunning}
          />
        )}

        {/* Progress Bar */}
        {isRunning && progress && (
          <ProgressBar
            value={progress.percentage}
            label={`Processing ${progress.current} of ${progress.total}`}
            currentItem={progress.currentItem}
            variant={progress.itemStatus === 'failed' ? 'error' : 'default'}
          />
        )}

        {/* Item Results */}
        {itemResults.length > 0 && (
          <ItemResultList items={itemResults} maxHeight="180px" />
        )}

        {/* Custom footer (submit button, etc.) */}
        {footer}

        {/* Error display */}
        {lastResult?.error && (
          <div className="p-2 text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400">
            {lastResult.error}
          </div>
        )}
      </form>
    </Card>
  );
}
