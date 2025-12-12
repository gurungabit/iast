// ============================================================================
// BI Renew AST Types
// ============================================================================

import type { BaseASTPayload } from '../types';

export interface BiRenewASTPayload extends BaseASTPayload {
  username: string;
  password: string;
  /** Missed run date in YYYY-MM-DD format */
  date?: string;
  /** Test mode - run without making changes */
  testMode?: boolean;
  /** Enable parallel processing */
  parallel?: boolean;
  /** Auth group (auto-populated based on category) */
  authGroup?: string;
}

/**
 * Convert date from YYYY-MM-DD (input) to MM/DD/YYYY (backend format)
 */
export function formatDateForBackend(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${month}/${day}/${year}`;
}

/**
 * Get default date (yesterday or last business day)
 */
export function getDefaultDate(): string {
  const today = new Date();
  today.setDate(today.getDate() - 1); // Default to yesterday
  return today.toISOString().split('T')[0];
}
