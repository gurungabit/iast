// ============================================================================
// BiRenewASTForm Component - Form for BI Renew AST
// ============================================================================

import { useCallback, useState } from 'react';
import { Button, DatePicker } from '../../components/ui';
import { useAST } from '../../hooks/useAST';
import { useAuthContext } from '../../context/AuthContext';
import { useCredentials, ASTFormWrapper } from '../shared';
import { useASTRegistry } from '../registry';
import { CATEGORY_AUTH_GROUP } from '../registry/types';
import { formatDateForBackend, getDefaultDate } from './types';

const AST_ID = 'bi_renew';

export function BiRenewASTForm(): React.ReactNode {
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

  // BI Renew specific state
  const [missedRunDate, setMissedRunDate] = useState<string>(getDefaultDate());
  const [testMode, setTestMode] = useState<boolean>(false);
  const [useParallel, setUseParallel] = useState<boolean>(false);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (isValid && !isRunning) {
        const payload: Record<string, unknown> = {
          username: credentials.username,
          password: credentials.password,
          userId: user?.id || 'anonymous',
          authGroup: CATEGORY_AUTH_GROUP.auto,
          testMode,
        };

        // Include date if provided
        if (missedRunDate) {
          payload.date = formatDateForBackend(missedRunDate);
        }

        // Enable parallel processing if selected
        if (useParallel) {
          payload.parallel = true;
        }

        executeAST('bi_renew', payload);
      }
    },
    [executeAST, credentials, isValid, isRunning, user, missedRunDate, testMode, useParallel]
  );

  return (
    <ASTFormWrapper
      title="BI Renew"
      description="Process BI renewal pending records"
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
          {isRunning ? 'Processing...' : 'Run BI Renew'}
        </Button>
      }
    >
      {/* Missed Run Date Picker */}
      <DatePicker
        label="Missed Run Date"
        value={missedRunDate}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMissedRunDate(e.target.value)}
        maxDaysBack={10}
        allowFuture={false}
        hint="Select a date up to 10 days in the past"
        disabled={isRunning}
      />
    </ASTFormWrapper>
  );
}
