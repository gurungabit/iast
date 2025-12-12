// ============================================================================
// LoginASTForm Component - Form for Login AST with policy processing
// ============================================================================

import { useCallback, useState, useMemo } from 'react';
import { Button } from '../../components/ui';
import { useAST } from '../../hooks/useAST';
import { useAuthContext } from '../../context/AuthContext';
import { useCredentials, ASTFormWrapper } from '../shared';
import { useASTRegistry } from '../registry';
import { CATEGORY_AUTH_GROUP } from '../registry/types';
import { parsePolicyNumbers } from './types';

const AST_ID = 'login';

export function LoginASTForm(): React.ReactNode {
  const { executeAST, status, isRunning, lastResult, progress, itemResults } = useAST();
  const { user } = useAuthContext();
  const { getAST } = useASTRegistry();
  const astConfig = getAST(AST_ID);
  const {
    credentials,
    setUsername,
    setPassword,
    isValid,
  } = useCredentials();

  // Policy numbers input
  const [policyInput, setPolicyInput] = useState<string>('');

  // Test mode and parallel execution
  const [testMode, setTestMode] = useState<boolean>(false);
  const [useParallel, setUseParallel] = useState<boolean>(false);

  // Parse and validate policy numbers
  const { validPolicies, invalidCount } = useMemo(() => {
    const parsed = parsePolicyNumbers(policyInput);
    const parts = policyInput.split(/[,\s\n]+/).filter(Boolean);
    return {
      validPolicies: parsed,
      invalidCount: parts.length - parsed.length,
    };
  }, [policyInput]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (isValid && !isRunning) {
        const payload: Record<string, unknown> = {
          username: credentials.username,
          password: credentials.password,
          userId: user?.id || 'anonymous',
          authGroup: CATEGORY_AUTH_GROUP.fire,
          testMode,
        };

        // Include policy numbers if provided
        if (validPolicies.length > 0) {
          payload.policyNumbers = validPolicies;
        }

        // Enable parallel processing if selected
        if (useParallel) {
          payload.parallel = true;
        }

        executeAST('login', payload);
      }
    },
    [executeAST, credentials, isValid, isRunning, validPolicies, user, useParallel, testMode]
  );

  const hasPolicies = validPolicies.length > 0;

  return (
    <ASTFormWrapper
      title="TSO Login"
      description="Automated TSO login with policy processing"
      username={credentials.username}
      password={credentials.password}
      onUsernameChange={setUsername}
      onPasswordChange={setPassword}
      testMode={testMode}
      onTestModeChange={setTestMode}
      showParallel={astConfig?.supportsParallel ?? false}
      parallel={useParallel}
      onParallelChange={setUseParallel}
      status={status}
      isRunning={isRunning}
      lastResult={lastResult}
      progress={progress}
      itemResults={itemResults}
      onSubmit={handleSubmit}
      footer={
        <Button
          type="submit"
          variant="primary"
          size="md"
          className="w-full"
          disabled={!isValid}
          isLoading={isRunning}
        >
          {isRunning
            ? (hasPolicies ? 'Processing...' : 'Running...')
            : (validPolicies.length > 0 ? `Run Login + ${validPolicies.length} Policies` : 'Run Login')
          }
        </Button>
      }
    >
      {/* Policy Numbers Textarea */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
          Policy Numbers
          {validPolicies.length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-500 dark:text-zinc-500">
              ({validPolicies.length} valid)
            </span>
          )}
        </label>
        <textarea
          className={`
            w-full px-3 py-2 text-sm font-mono
            bg-white dark:bg-zinc-900
            border border-gray-300 dark:border-zinc-700
            rounded-md shadow-sm
            text-gray-900 dark:text-zinc-100
            placeholder:text-gray-400 dark:placeholder:text-zinc-500
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            disabled:bg-gray-100 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed
          `}
          rows={3}
          placeholder="Enter 9-char policy numbers (comma, space, or newline separated)"
          value={policyInput}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPolicyInput(e.target.value)}
          disabled={isRunning}
        />
        {invalidCount > 0 && (
          <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
            {invalidCount} invalid policy number(s) will be skipped
          </p>
        )}
        <p className="mt-1 text-xs text-gray-500 dark:text-zinc-500">
          Optional. Leave empty for login-only test.
        </p>
      </div>
    </ASTFormWrapper>
  );
}
