// ============================================================================
// AST Registry Types
// ============================================================================

import type { ComponentType } from 'react';

/**
 * AST category for grouping in the UI
 */
export type ASTCategory = 'auto' | 'fire';

/**
 * Auth group mapping for each category
 */
export const CATEGORY_AUTH_GROUP: Record<ASTCategory, string> = {
  auto: '@OOAUTO',
  fire: '@OOFIRE',
};

/**
 * AST configuration - defines metadata for an AST
 */
export interface ASTConfig {
  /** Unique identifier for the AST (used in executeAST calls) */
  id: string;
  
  /** Display name shown in the UI */
  name: string;
  
  /** Short description of what this AST does */
  description: string;
  
  /** Category for grouping */
  category: ASTCategory;
  
  /** Whether this AST is enabled */
  enabled: boolean;
  
  /** Whether this AST is visible in the dropdown (can be hidden but still callable) */
  visible: boolean;
  
  /** Keywords for search matching */
  keywords: string[];
  
  /** Version string for tracking */
  version?: string;
  
  /** Author or team that maintains this AST */
  author?: string;
  
  /** Whether this AST supports parallel execution */
  supportsParallel?: boolean;
  
  /** The React component that renders this AST's form */
  component: ComponentType;
}

/**
 * AST Registry - holds all registered ASTs
 */
export interface ASTRegistry {
  /** All registered ASTs by ID */
  asts: Map<string, ASTConfig>;
  
  /** Get an AST by ID */
  get: (id: string) => ASTConfig | undefined;
  
  /** Get all enabled ASTs */
  getEnabled: () => ASTConfig[];
  
  /** Get all visible ASTs */
  getVisible: () => ASTConfig[];
  
  /** Get ASTs by category */
  getByCategory: (category: ASTCategory) => ASTConfig[];
  
  /** Search ASTs by name, description, or keywords */
  search: (query: string) => ASTConfig[];
  
  /** Register a new AST */
  register: (config: ASTConfig) => void;
  
  /** Enable/disable an AST */
  setEnabled: (id: string, enabled: boolean) => void;
  
  /** Set visibility of an AST */
  setVisible: (id: string, visible: boolean) => void;
}

/**
 * Category metadata for display
 */
export interface CategoryInfo {
  id: ASTCategory;
  name: string;
  description: string;
}

/**
 * All category metadata
 */
export const CATEGORY_INFO: Record<ASTCategory, CategoryInfo> = {
  auto: {
    id: 'auto',
    name: 'Auto',
    description: 'Auto insurance automation scripts',
  },
  fire: {
    id: 'fire',
    name: 'Fire',
    description: 'Fire/property insurance automation scripts',
  },
};
