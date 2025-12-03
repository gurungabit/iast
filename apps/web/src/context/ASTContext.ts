// ============================================================================
// AST Context - Shared context value for AST operations
// ============================================================================

import { createContext } from 'react';
import type { ASTStatus, ASTResult } from '../ast/types';

// ============================================================================
// Context Value Type
// ============================================================================

export interface ASTContextValue {
  /** Currently running AST name, if any */
  runningAST: string | null;
  /** Status of the last/current AST */
  status: ASTStatus;
  /** Result of the last AST execution */
  lastResult: ASTResult | null;
  /** Callback to run an AST (injected from terminal) */
  runAST: ((astName: string, params?: Record<string, unknown>) => void) | null;
  /** Execute an AST with parameters */
  executeAST: (astName: string, params?: Record<string, unknown>) => void;
  /** Set the run callback (from terminal hook) */
  setRunCallback: (callback: (astName: string, params?: Record<string, unknown>) => void) => void;
  /** Handle AST completion (from status messages) */
  handleASTComplete: (result: ASTResult) => void;
  /** Reset state */
  reset: () => void;
  /** Check if an AST is currently running */
  isRunning: boolean;
}

export const ASTContext = createContext<ASTContextValue | null>(null);
