// ============================================================================
// BiRenewASTForm Component - Form for BI Renew AST
// ============================================================================

import { useCallback } from 'react';
import { Button, DatePicker } from '../../components/ui';
import { useAST } from '../../hooks/useAST';
import { useFormField } from '../../hooks/useFormField';
import { useAuthContext } from '../../context/AuthContext';
import { ASTFormWrapper } from '../shared';
import { useASTRegistry } from '../registry';
import { CATEGORY_AUTH_GROUP } from '../registry/types';
import { formatDateForBackend, getDefaultDate } from './types';

const AST_ID = 'bi_renew';

export function BiRenewASTForm(): React.ReactNode {
  const { executeAST, isRunning } = useAST();
  const { user } = useAuthContext();
  const { getAST } = useASTRegistry();
  const astConfig = getAST(AST_ID);

  // BI Renew specific state (persisted per tab)
  const [missedRunDate, setMissedRunDate] = useFormField<string>('biRenew.missedRunDate', getDefaultDate());

  const handleSubmit = useCallback(
    (formData: { username: string; password: string; testMode: boolean; parallel: boolean }) => {
      const payload: Record<string, unknown> = {
        username: formData.username,
        password: formData.password,
        userId: user?.id || 'anonymous',
        authGroup: CATEGORY_AUTH_GROUP.auto,
        testMode: formData.testMode,
      };

      // Include date if provided
      if (missedRunDate) {
        payload.date = formatDateForBackend(missedRunDate);
      }

      // Enable parallel processing if selected
      if (formData.parallel) {
        payload.parallel = true;
      }

      executeAST('bi_renew', payload);
    },
    [executeAST, user, missedRunDate]
  );

  return (
    <ASTFormWrapper
      title="BI Renew"
      description="Process BI renewal pending records"
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
