// ============================================================================
// AST Types - Shared types for all AST modules
// ============================================================================

export type ASTStatus = 'idle' | 'running' | 'success' | 'failed' | 'timeout';

export interface ASTResult {
  status: ASTStatus;
  message?: string;
  error?: string;
  duration?: number;
  data?: Record<string, unknown>;
}

/**
 * Base interface for AST payloads.
 * Each AST should extend this with its specific fields.
 */
export interface BaseASTPayload {
  [key: string]: unknown;
}
