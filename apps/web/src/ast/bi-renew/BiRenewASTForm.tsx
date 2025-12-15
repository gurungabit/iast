// ============================================================================
// BiRenewASTForm Component - Form for BI Renew AST
// ============================================================================

import { useCallback } from 'react';
import { DatePicker } from '../../components/ui';
import { useAST } from '../../hooks/useAST';
import { useFormField } from '../../hooks/useFormField';
import { useAuthContext } from '../../context/AuthContext';
import { ASTFormWrapper, type CommonFormParams } from '../shared';
import { useASTRegistry } from '../registry';
import { CATEGORY_AUTH_GROUP } from '../registry/types';
import { formatDateForBackend, getDefaultDate } from './types';

const AST_ID = 'bi_renew';

export function BiRenewASTForm(): React.ReactNode {
  const { executeAST } = useAST();
  const { user } = useAuthContext();
  const { getAST } = useASTRegistry();
  const astConfig = getAST(AST_ID);

  // BI Renew specific state (persisted per tab)
  const [missedRunDate, setMissedRunDate] = useFormField<string>('biRenew.missedRunDate', getDefaultDate());

  // Build the complete payload - called by wrapper for both run and schedule
  const buildPayload = useCallback((common: CommonFormParams): Record<string, unknown> => {
    const payload: Record<string, unknown> = {
      username: common.username,
      password: common.password,
      userId: user?.id || 'anonymous',
      authGroup: CATEGORY_AUTH_GROUP.auto,
      testMode: common.testMode,
    };

    if (missedRunDate) {
      payload.date = formatDateForBackend(missedRunDate);
    }

    if (common.parallel) {
      payload.parallel = true;
    }

    return payload;
  }, [user, missedRunDate]);

  // Called when running immediately
  const handleRun = useCallback((payload: Record<string, unknown>) => {
    executeAST('bi_renew', payload);
  }, [executeAST]);

  return (
    <ASTFormWrapper
      title="BI Renew"
      description="Process BI renewal pending records"
      showParallel={astConfig?.supportsParallel ?? false}
      submitLabel="Run BI Renew"
      astName="bi_renew"
      buildPayload={buildPayload}
      onRun={handleRun}
    >
      {/* Missed Run Date Picker */}
      <DatePicker
        label="Missed Run Date"
        value={missedRunDate}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMissedRunDate(e.target.value)}
        maxDaysBack={10}
        allowFuture={false}
        hint="Select a date up to 10 days in the past"
      />
    </ASTFormWrapper>
  );
}
