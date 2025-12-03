// ============================================================================
// useAST Hook - Access AST context
// ============================================================================

import { useContext } from 'react';
import { ASTContext, type ASTContextValue } from '../context/ASTContext';

export function useAST(): ASTContextValue {
  const context = useContext(ASTContext);
  if (!context) {
    throw new Error('useAST must be used within an ASTProvider');
  }
  return context;
}
