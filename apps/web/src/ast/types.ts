// ============================================================================
// AST Types - Shared types for all AST modules
// ============================================================================

export type ASTStatus = 'idle' | 'running' | 'paused' | 'success' | 'failed' | 'timeout' | 'cancelled';

export type ASTItemStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export interface ASTResult {
  status: ASTStatus;
  message?: string;
  error?: string;
  duration?: number;
  data?: Record<string, unknown>;
}

export interface ASTProgress {
  current: number;
  total: number;
  currentItem?: string;
  itemStatus?: ASTItemStatus;
  message?: string;
  /** Percentage complete (0-100) */
  percentage: number;
}

export interface ASTItemResult {
  itemId: string;
  status: ASTItemStatus;
  durationMs?: number;
  error?: string;
  data?: Record<string, unknown>;
}

/**
 * Base interface for AST payloads.
 * Each AST should extend this with its specific fields.
 */
export interface BaseASTPayload {
  [key: string]: unknown;
}
