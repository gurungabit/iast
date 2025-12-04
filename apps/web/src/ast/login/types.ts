// ============================================================================
// Login AST Types
// ============================================================================

import type { BaseASTPayload } from '../types';

// Re-export shared credentials for backwards compatibility
export type { Credentials as LoginCredentials } from '../shared';
export { CREDENTIALS_STORAGE_KEY as LOGIN_STORAGE_KEY, DEFAULT_CREDENTIALS } from '../shared';

export interface LoginASTPayload extends BaseASTPayload {
  username: string;
  password: string;
  /** Optional list of policy numbers (9-char alphanumeric) */
  policyNumbers?: string[];
}

/**
 * Validates a policy number format.
 * Policy numbers must be exactly 9 alphanumeric characters.
 */
export function isValidPolicyNumber(policyNumber: string): boolean {
  return /^[A-Za-z0-9]{9}$/.test(policyNumber);
}

/**
 * Parse policy numbers from text input.
 * Handles comma, space, or newline separated values.
 * Returns only valid 9-character alphanumeric policy numbers.
 */
export function parsePolicyNumbers(input: string): string[] {
  if (!input.trim()) {
    return [];
  }
  
  // Split by comma, newline, or whitespace
  const parts = input.split(/[,\s\n]+/).filter(Boolean);
  
  // Clean up and validate
  return parts
    .map(p => p.trim().toUpperCase())
    .filter(isValidPolicyNumber);
}
