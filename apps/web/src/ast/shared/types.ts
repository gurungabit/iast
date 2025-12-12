// ============================================================================
// Shared Credentials Types and Constants
// ============================================================================

/**
 * Mainframe credentials used across multiple ASTs
 */
export interface Credentials {
  username: string;
  password: string;
}

/**
 * Default credentials (for development)
 */
export const DEFAULT_CREDENTIALS: Credentials = {
  username: '',
  password: '',
};

// Legacy export - kept for backwards compatibility but no longer used
export const CREDENTIALS_STORAGE_KEY = 'ast.credentials';
