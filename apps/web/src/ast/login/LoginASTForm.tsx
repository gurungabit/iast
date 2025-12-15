// ============================================================================
// LoginASTForm Component - Form for Login AST with policy processing
// ============================================================================

import { useCallback, useMemo } from 'react';
import { useAST } from '../../hooks/useAST';
import { useFormField } from '../../hooks/useFormField';
import { useAuthContext } from '../../context/AuthContext';
import { ASTFormWrapper, type CommonFormParams } from '../shared';
import { useASTRegistry } from '../registry';
import { CATEGORY_AUTH_GROUP } from '../registry/types';
import { parsePolicyNumbers } from './types';

const AST_ID = 'login';

export function LoginASTForm(): React.ReactNode {
  const { executeAST } = useAST();
  const { user } = useAuthContext();
  const { getAST } = useASTRegistry();
  const astConfig = getAST(AST_ID);

  // Policy numbers input (persisted per tab)
  const [policyInput, setPolicyInput] = useFormField<string>('login.policyNumbers', '');

  // Parse and validate policy numbers
  const { validPolicies, invalidCount } = useMemo(() => {
    const parsed = parsePolicyNumbers(policyInput);
    const parts = policyInput.split(/[,\s\n]+/).filter(Boolean);
    return {
      validPolicies: parsed,
      invalidCount: parts.length - parsed.length,
    };
  }, [policyInput]);

  // Dynamic button label based on policy count
  const submitLabel = validPolicies.length > 0
    ? `Run Login + ${String(validPolicies.length)} Policies`
    : 'Run Login';

  // Build the complete payload - called by wrapper for both run and schedule
  const buildPayload = useCallback((common: CommonFormParams): Record<string, unknown> => {
    const payload: Record<string, unknown> = {
      username: common.username,
      password: common.password,
      userId: user?.id || 'anonymous',
      authGroup: CATEGORY_AUTH_GROUP.fire,
      testMode: common.testMode,
    };

    if (validPolicies.length > 0) {
      payload.policyNumbers = validPolicies;
    }

    if (common.parallel) {
      payload.parallel = true;
    }

    return payload;
  }, [validPolicies, user]);

  // Called when running immediately
  const handleRun = useCallback((payload: Record<string, unknown>) => {
    executeAST('login', payload);
  }, [executeAST]);

  return (
    <ASTFormWrapper
      title="TSO Login"
      description="Automated TSO login with policy processing"
      showParallel={astConfig?.supportsParallel ?? false}
      submitLabel={submitLabel}
      astName="login"
      buildPayload={buildPayload}
      onRun={handleRun}
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
