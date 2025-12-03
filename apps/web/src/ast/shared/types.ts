// ============================================================================
// Shared Credentials Types and Constants
// ============================================================================

/**
 * Mainframe credentials used across multiple ASTs
 */
export interface Credentials {
  username: string;
  password: string;
  rememberMe: boolean;
}

/**
 * Storage key for persisted credentials
 */
export const CREDENTIALS_STORAGE_KEY = 'ast.credentials';

/**
 * Default credentials (for development)
 */
export const DEFAULT_CREDENTIALS: Credentials = {
  username: 'herc01',
  password: 'CUL8TR',
  rememberMe: false,
};
