// ============================================================================
// LoginASTForm Component - Form for Login AST with credential persistence
// ============================================================================

import { useCallback } from 'react';
import { Input, Checkbox, Button, Card, StatusBadge } from '../../components/ui';
import { useAST } from '../../hooks/useAST';
import { useCredentials } from '../shared';

export function LoginASTForm(): React.ReactNode {
  const { executeAST, status, isRunning, lastResult } = useAST();
  const {
    credentials,
    setUsername,
    setPassword,
    setRememberMe,
    isValid,
  } = useCredentials();

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (isValid && !isRunning) {
        executeAST('login', {
          username: credentials.username,
          password: credentials.password,
        });
      }
    },
    [executeAST, credentials, isValid, isRunning]
  );

  return (
    <Card
      title="Login AST"
      description="Automated TSO login sequence"
      footer={
        <div className="flex items-center justify-between">
          <StatusBadge status={status} />
          {lastResult?.message && (
            <span className="text-xs text-gray-500 dark:text-zinc-500 truncate max-w-[150px]">
              {lastResult.message}
            </span>
          )}
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Username"
          placeholder="Enter TSO username"
          value={credentials.username}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
          disabled={isRunning}
          autoComplete="username"
        />

        <Input
          label="Password"
          type="password"
          placeholder="Enter password"
          value={credentials.password}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
          disabled={isRunning}
          autoComplete="current-password"
        />

        <Checkbox
          label="Remember credentials"
          description="Save login info in browser"
          checked={credentials.rememberMe}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRememberMe(e.target.checked)}
          disabled={isRunning}
        />

        <Button
          type="submit"
          variant="primary"
          size="md"
          className="w-full"
          disabled={!isValid}
          isLoading={isRunning}
        >
          {isRunning ? 'Running...' : 'Run Login'}
        </Button>

        {lastResult?.error && (
          <div className="p-2 text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400">
            {lastResult.error}
          </div>
        )}
      </form>
    </Card>
  );
}
