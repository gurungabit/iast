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
}
