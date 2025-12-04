// ============================================================================
// AST Provider - State management for AST operations
// ============================================================================

import { useReducer, useCallback, type ReactNode } from 'react';
import { ASTContext, type ASTContextValue } from '../context/ASTContext';
import type { ASTStatus, ASTResult, ASTProgress, ASTItemResult } from '../ast/types';

// ============================================================================
// State Types
// ============================================================================

interface ASTState {
  runningAST: string | null;
  status: ASTStatus;
  lastResult: ASTResult | null;
  progress: ASTProgress | null;
  itemResults: ASTItemResult[];
  runAST: ((astName: string, params?: Record<string, unknown>) => void) | null;
}

type ASTAction =
  | { type: 'SET_RUN_CALLBACK'; callback: (astName: string, params?: Record<string, unknown>) => void }
  | { type: 'START_AST'; astName: string }
  | { type: 'AST_COMPLETED'; result: ASTResult }
  | { type: 'AST_PROGRESS'; progress: ASTProgress }
  | { type: 'AST_ITEM_RESULT'; itemResult: ASTItemResult }
  | { type: 'RESET' };

// ============================================================================
// Reducer
// ============================================================================

const initialState: ASTState = {
  runningAST: null,
  status: 'idle',
  lastResult: null,
  progress: null,
  itemResults: [],
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
        progress: null,
        itemResults: [],
      };
    case 'AST_COMPLETED':
      return {
        ...state,
        runningAST: null,
        status: action.result.status,
        lastResult: action.result,
        progress: null,
      };
    case 'AST_PROGRESS':
      return {
        ...state,
        progress: action.progress,
      };
    case 'AST_ITEM_RESULT':
      return {
        ...state,
        itemResults: [...state.itemResults, action.itemResult],
      };
    case 'RESET':
      return { ...state, runningAST: null, status: 'idle', lastResult: null, progress: null, itemResults: [] };
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

  const handleASTProgress = useCallback((progress: ASTProgress) => {
    dispatch({ type: 'AST_PROGRESS', progress });
  }, []);

  const handleASTItemResult = useCallback((itemResult: ASTItemResult) => {
    dispatch({ type: 'AST_ITEM_RESULT', itemResult });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const value: ASTContextValue = {
    ...state,
    executeAST,
    setRunCallback,
    handleASTComplete,
    handleASTProgress,
    handleASTItemResult,
    reset,
    isRunning: state.status === 'running',
  };

  return <ASTContext.Provider value={value}>{children}</ASTContext.Provider>;
}
