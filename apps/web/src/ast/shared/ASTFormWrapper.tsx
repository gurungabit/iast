// ============================================================================
// ASTFormWrapper - Common wrapper for AST forms with shared inputs
// ============================================================================
// Uses Zustand store to persist form state across tab switches

import type { ReactNode } from 'react';
import { Card, StatusBadge, Toggle, ProgressBar, ItemResultList, StatusLogList, Button } from '../../components/ui';
import { CredentialsInput } from './CredentialsInput';
import { useASTStore } from '../../stores/astStore';
import { useAST } from '../../hooks/useAST';

interface ASTFormWrapperProps {
  /** Card title */
  title: string;
  /** Card description */
  description: string;
  /** Form children (AST-specific inputs) */
  children: ReactNode;
  /** Footer content (buttons, etc.) */
  footer?: ReactNode;
  /** Whether to show parallel processing toggle */
  showParallel?: boolean;
  /** Form submission handler - receives credentials and options */
  onSubmit: (params: {
    username: string;
    password: string;
    testMode: boolean;
    parallel: boolean;
  }) => void;
}

export function ASTFormWrapper({
  title,
  description,
  children,
  footer,
  showParallel = false,
  onSubmit,
}: ASTFormWrapperProps): React.ReactNode {
  // Get the active tab ID
  const activeTabId = useASTStore((state) => state.activeTabId);

  // Read credentials and form options from store (persisted per tab)
  const tabState = useASTStore((state) =>
    activeTabId ? state.tabs[activeTabId] : null
  );
  const setCredentials = useASTStore((state) => state.setCredentials);
  const setFormOptions = useASTStore((state) => state.setFormOptions);

  // Get AST state from hook
  const {
    status,
    isRunning,
    lastResult,
    progress,
    itemResults,
    statusMessages,
    clearLogs
  } = useAST();

  // Default values if no tab state
  const credentials = tabState?.credentials ?? { username: '', password: '' };
  const formOptions = tabState?.formOptions ?? { testMode: false, parallel: false };

  const isValid = credentials.username.trim().length > 0 && credentials.password.length > 0;
  const hasLogs = statusMessages.length > 0 || itemResults.length > 0;

  const handleSetUsername = (username: string) => {
    if (activeTabId) {
      setCredentials(activeTabId, { username });
    }
  };

  const handleSetPassword = (password: string) => {
    if (activeTabId) {
      setCredentials(activeTabId, { password });
    }
  };

  const handleSetTestMode = (testMode: boolean) => {
    if (activeTabId) {
      setFormOptions(activeTabId, { testMode });
    }
  };

  const handleSetParallel = (parallel: boolean) => {
    if (activeTabId) {
      setFormOptions(activeTabId, { parallel });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid && !isRunning) {
      onSubmit({
        username: credentials.username,
        password: credentials.password,
        testMode: formOptions.testMode,
        parallel: formOptions.parallel,
      });
    }
  };

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
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className={`grid gap-4 ${hasLogs ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {/* Left Column - Form Inputs */}
          <div className="space-y-4">
            {/* Credentials - common to all ASTs */}
            <CredentialsInput
              username={credentials.username}
              password={credentials.password}
              onUsernameChange={handleSetUsername}
              onPasswordChange={handleSetPassword}
              disabled={isRunning}
            />

            {/* AST-specific inputs */}
            {children}

            {/* Test Mode Toggle - common to all ASTs */}
            <Toggle
              label="Test Mode"
              description="Run without making actual changes"
              checked={formOptions.testMode}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSetTestMode(e.target.checked)}
              disabled={isRunning}
            />

            {/* Parallel Processing Toggle (optional) */}
            {showParallel && (
              <Toggle
                label="Parallel Processing"
                description="Process items concurrently (faster but uses more resources)"
                checked={formOptions.parallel}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSetParallel(e.target.checked)}
                disabled={isRunning}
              />
            )}

            {/* Progress Bar */}
            {isRunning && progress && (
              <ProgressBar
                value={progress.percentage}
                label={`Processing ${progress.current} of ${progress.total}`}
                currentItem={progress.currentItem}
                message={progress.message}
                variant={progress.itemStatus === 'failed' ? 'error' : 'default'}
              />
            )}

            {/* Custom footer (submit button, etc.) */}
            {footer}

            {/* Error display */}
            {lastResult?.error && (
              <div className="p-2 text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400">
                {lastResult.error}
              </div>
            )}
          </div>

          {/* Right Column - Logs and Results */}
          {hasLogs && (
            <div className="space-y-3">
              {/* Status Log */}
              {statusMessages.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-zinc-500 mb-1">Status Log</h4>
                  <StatusLogList messages={statusMessages} maxHeight="150px" />
                </div>
              )}

              {/* Item Results */}
              {itemResults.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-zinc-500 mb-1">Results</h4>
                  <ItemResultList items={itemResults} maxHeight="250px" />
                </div>
              )}

              {/* Clear Button - show when there are logs and not running */}
              {!isRunning && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={clearLogs}
                  className="w-full"
                >
                  Clear Results
                </Button>
              )}
            </div>
          )}
        </div>
      </form>
    </Card>
  );
}
