// ============================================================================
// LoginASTForm Component - Form for Login AST with policy processing
// ============================================================================

import { useCallback, useMemo } from 'react';
import { Button } from '../../components/ui';
import { useAST } from '../../hooks/useAST';
import { useFormField } from '../../hooks/useFormField';
import { useAuthContext } from '../../context/AuthContext';
import { ASTFormWrapper } from '../shared';
import { useASTRegistry } from '../registry';
import { CATEGORY_AUTH_GROUP } from '../registry/types';
import { parsePolicyNumbers } from './types';

const AST_ID = 'login';

export function LoginASTForm(): React.ReactNode {
  const { executeAST, isRunning } = useAST();
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

  const handleSubmit = useCallback(
    (formData: { username: string; password: string; testMode: boolean; parallel: boolean }) => {
      const payload: Record<string, unknown> = {
        username: formData.username,
        password: formData.password,
        userId: user?.id || 'anonymous',
        authGroup: CATEGORY_AUTH_GROUP.fire,
        testMode: formData.testMode,
      };

      // Include policy numbers if provided
      if (validPolicies.length > 0) {
        payload.policyNumbers = validPolicies;
      }

      // Enable parallel processing if selected
      if (formData.parallel) {
        payload.parallel = true;
      }

      executeAST('login', payload);
    },
    [executeAST, validPolicies, user]
  );

  return (
    <ASTFormWrapper
      title="TSO Login"
      description="Automated TSO login with policy processing"
      showParallel={astConfig?.supportsParallel ?? false}
      onSubmit={handleSubmit}
      footer={
        <Button
          type="submit"
          variant="primary"
          size="md"
          className="w-full"
          isLoading={isRunning}
        >
          {isRunning
            ? (validPolicies.length > 0 ? 'Processing...' : 'Running...')
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
