// ============================================================================
// ASTFormWrapper - Common wrapper for AST forms with shared inputs
// ============================================================================
// Uses Zustand store to persist form state across tab switches

import type { ReactNode } from 'react';
import { useState, useCallback } from 'react';
import { Card, StatusBadge, Toggle, ProgressBar, ItemResultList, StatusLogList, Button, DateTimePicker, Input } from '../../components/ui';
import { CredentialsInput } from './CredentialsInput';
import { useASTStore } from '../../stores/astStore';
import { useAST } from '../../hooks/useAST';
import { useFormField } from '../../hooks/useFormField';
import { createSchedule } from '../../services/schedules';

// ============================================================================
// Types
// ============================================================================

/** Common params provided by the wrapper */
export interface CommonFormParams {
  username: string;
  password: string;
  testMode: boolean;
  parallel: boolean;
}

interface ASTFormWrapperProps {
  /** Card title */
  title: string;
  /** Card description */
  description: string;
  /** Form children (AST-specific inputs) */
  children: ReactNode;
  /** Whether to show parallel processing toggle */
  showParallel?: boolean;
  /** Button label for run now (auto-prefixed with "Schedule" when scheduling) */
  submitLabel?: string;
  /** AST name (e.g., "login", "bi_renew") */
  astName: string;
  /** Build the full AST payload from common params - AST form adds its specific params */
  buildPayload: (common: CommonFormParams) => Record<string, unknown>;
  /** Execute the AST (called for immediate run) */
  onRun: (payload: Record<string, unknown>) => void;
}

// ============================================================================
// Component
// ============================================================================

export function ASTFormWrapper({
  title,
  description,
  children,
  showParallel = false,
  submitLabel = 'Run',
  astName,
  buildPayload,
  onRun,
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

  // Schedule state - persisted per tab using useFormField
  const [scheduleMode, setScheduleMode] = useFormField<boolean>('schedule.enabled', false);
  const [scheduledTime, setScheduledTime] = useFormField<string>('schedule.time', '');
  const [timezone, setTimezone] = useFormField<string>('schedule.timezone', 'America/Chicago');
  const [notifyEmail, setNotifyEmail] = useFormField<string>('schedule.email', '');

  // Transient state (not persisted)
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSuccess, setScheduleSuccess] = useState<string | null>(null);

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

  const handleDateTimeChange = useCallback((isoString: string, tz: string) => {
    setScheduledTime(isoString);
    setTimezone(tz);
  }, [setScheduledTime, setTimezone]);

  // Build the common params
  const getCommonParams = (): CommonFormParams => ({
    username: credentials.username,
    password: credentials.password,
    testMode: formOptions.testMode,
    parallel: formOptions.parallel,
  });

  // Schedule handler - POST to /schedules with full payload
  const handleSchedule = async () => {
    setIsScheduling(true);
    setScheduleError(null);
    setScheduleSuccess(null);

    try {
      // Build full payload using AST form's buildPayload
      const fullPayload = buildPayload(getCommonParams());

      const result = await createSchedule({
        astName,
        scheduledTime,
        timezone,
        credentials: {
          username: credentials.username,
          password: credentials.password,
        },
        params: fullPayload, // Full payload including AST-specific params
        notifyEmail: notifyEmail || undefined,
      });

      setScheduleSuccess(`Scheduled! ID: ${result.scheduleId}`);
      setScheduleMode(false);
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : 'Failed to schedule');
    } finally {
      setIsScheduling(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isRunning || isScheduling) return;

    if (scheduleMode) {
      void handleSchedule();
    } else {
      // Build and run immediately
      const payload = buildPayload(getCommonParams());
      onRun(payload);
    }
  };

  // Button label changes based on mode
  const buttonLabel = isScheduling
    ? 'Scheduling...'
    : isRunning
      ? 'Processing...'
      : scheduleMode
        ? `Schedule ${submitLabel.replace(/^Run\s*/i, '')}`
        : submitLabel;

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
              disabled={isRunning || isScheduling}
            />

            {/* AST-specific inputs */}
            {children}

            {/* Schedule Toggle */}
            <Toggle
              label="Schedule for Later"
              description="Run this automation at a specific time"
              checked={scheduleMode}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setScheduleMode(e.target.checked)}
              disabled={isRunning || isScheduling}
            />

            {scheduleMode && (
              <div className="pl-4 border-l-2 border-blue-500 space-y-3">
                <DateTimePicker
                  value={scheduledTime || null}
                  onChange={handleDateTimeChange}
                />
                <Input
                  label="Notify Email (optional)"
                  type="email"
                  value={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.value)}
                  placeholder="user@example.com"
                  disabled={isRunning || isScheduling}
                />
              </div>
            )}

            {/* Test Mode Toggle */}
            <Toggle
              label="Test Mode"
              description="Run without making actual changes"
              checked={formOptions.testMode}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSetTestMode(e.target.checked)}
              disabled={isRunning || isScheduling}
            />

            {/* Parallel Processing Toggle (optional) */}
            {showParallel && (
              <Toggle
                label="Parallel Processing"
                description="Process items concurrently (faster but uses more resources)"
                checked={formOptions.parallel}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSetParallel(e.target.checked)}
                disabled={isRunning || isScheduling}
              />
            )}

            {/* Progress Bar */}
            {isRunning && progress && (
              <ProgressBar
                value={progress.percentage}
                label={`Processing ${String(progress.current)} of ${String(progress.total)}`}
                currentItem={progress.currentItem}
                message={progress.message}
                variant={progress.itemStatus === 'failed' ? 'error' : 'default'}
              />
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full"
              isLoading={isRunning || isScheduling}
              disabled={!isValid}
            >
              {buttonLabel}
            </Button>

            {/* Schedule Success Message */}
            {scheduleSuccess && (
              <div className="p-2 text-xs bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-green-700 dark:text-green-400">
                {scheduleSuccess}
              </div>
            )}

            {/* Schedule Error */}
            {scheduleError && (
              <div className="p-2 text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400">
                {scheduleError}
              </div>
            )}

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

              {/* Clear Button */}
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
