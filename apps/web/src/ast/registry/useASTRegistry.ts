// ============================================================================
// useASTRegistry Hook - Access the AST registry in components
// ============================================================================

import { useState, useCallback, useMemo } from 'react';
import { astRegistry } from './registry';
import type { ASTConfig, ASTCategory } from './types';

export interface UseASTRegistryReturn {
  /** All visible ASTs */
  allASTs: ASTConfig[];
  
  /** Search results based on current query */
  searchResults: ASTConfig[];
  
  /** Current search query */
  searchQuery: string;
  
  /** Set search query */
  setSearchQuery: (query: string) => void;
  
  /** Currently selected AST */
  selectedAST: ASTConfig | null;
  
  /** Select an AST by ID */
  selectAST: (id: string | null) => void;
  
  /** Get ASTs grouped by category */
  groupedASTs: Record<ASTCategory, ASTConfig[]>;
  
  /** Get a specific AST by ID */
  getAST: (id: string) => ASTConfig | undefined;
  
  /** Check if an AST is enabled */
  isEnabled: (id: string) => boolean;
}

export function useASTRegistry(): UseASTRegistryReturn {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedASTId, setSelectedASTId] = useState<string | null>(null);

  const allASTs = useMemo(() => astRegistry.getVisible(), []);

  const searchResults = useMemo(() => {
    return astRegistry.search(searchQuery);
  }, [searchQuery]);

  const selectedAST = useMemo(() => {
    if (!selectedASTId) return null;
    return astRegistry.get(selectedASTId) ?? null;
  }, [selectedASTId]);

  const selectAST = useCallback((id: string | null) => {
    setSelectedASTId(id);
  }, []);

  const groupedASTs = useMemo(() => {
    const groups: Record<ASTCategory, ASTConfig[]> = {
      authentication: [],
      navigation: [],
      'data-entry': [],
      reporting: [],
      utilities: [],
      admin: [],
      custom: [],
    };

    for (const ast of allASTs) {
      groups[ast.category].push(ast);
    }

    return groups;
  }, [allASTs]);

  const getAST = useCallback((id: string) => {
    return astRegistry.get(id);
  }, []);

  const isEnabled = useCallback((id: string) => {
    const ast = astRegistry.get(id);
    return ast?.enabled ?? false;
  }, []);

  return {
    allASTs,
    searchResults,
    searchQuery,
    setSearchQuery,
    selectedAST,
    selectAST,
    groupedASTs,
    getAST,
    isEnabled,
  };
}
