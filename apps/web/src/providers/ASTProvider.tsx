// ============================================================================
// AST Provider - State management for AST operations
// ============================================================================

import { useReducer, useCallback, type ReactNode } from 'react';
import { ASTContext, type ASTContextValue } from '../context/ASTContext';
import type { ASTStatus, ASTResult } from '../ast/types';

// ============================================================================
// State Types
// ============================================================================

interface ASTState {
  runningAST: string | null;
  status: ASTStatus;
  lastResult: ASTResult | null;
  runAST: ((astName: string, params?: Record<string, unknown>) => void) | null;
}

type ASTAction =
  | { type: 'SET_RUN_CALLBACK'; callback: (astName: string, params?: Record<string, unknown>) => void }
  | { type: 'START_AST'; astName: string }
  | { type: 'AST_COMPLETED'; result: ASTResult }
  | { type: 'RESET' };

// ============================================================================
// Reducer
// ============================================================================

const initialState: ASTState = {
  runningAST: null,
  status: 'idle',
  lastResult: null,
  runAST: null,
};

function astReducer(state: ASTState, action: ASTAction): ASTState {
  switch (action.type) {
    case 'SET_RUN_CALLBACK':
      return { ...state, runAST: action.callback };
    case 'START_AST':
      return {
        ...state,
        runningAST: action.astName,
        status: 'running',
        lastResult: null,
      };
    case 'AST_COMPLETED':
      return {
        ...state,
        runningAST: null,
        status: action.result.status,
        lastResult: action.result,
      };
    case 'RESET':
      return { ...state, runningAST: null, status: 'idle', lastResult: null };
    default:
      return state;
  }
}

// ============================================================================
// Provider Component
// ============================================================================

interface ASTProviderProps {
  children: ReactNode;
}

export function ASTProvider({ children }: ASTProviderProps): React.ReactNode {
  const [state, dispatch] = useReducer(astReducer, initialState);

  const setRunCallback = useCallback(
    (callback: (astName: string, params?: Record<string, unknown>) => void) => {
      dispatch({ type: 'SET_RUN_CALLBACK', callback });
    },
    []
  );

  const executeAST = useCallback(
    (astName: string, params?: Record<string, unknown>) => {
      if (state.runAST) {
        dispatch({ type: 'START_AST', astName });
        state.runAST(astName, params);
      } else {
        console.warn('AST run callback not set. Is terminal connected?');
      }
    },
    [state]
  );

  const handleASTComplete = useCallback((result: ASTResult) => {
    dispatch({ type: 'AST_COMPLETED', result });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const value: ASTContextValue = {
    ...state,
    executeAST,
    setRunCallback,
    handleASTComplete,
    reset,
    isRunning: state.status === 'running',
  };

  return <ASTContext.Provider value={value}>{children}</ASTContext.Provider>;
}
