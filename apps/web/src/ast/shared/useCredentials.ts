// ============================================================================
// useCredentials Hook - Manage mainframe credentials (session only)
// ============================================================================

import { useState, useCallback } from 'react';
import { type Credentials, DEFAULT_CREDENTIALS } from './types';

export interface UseCredentialsReturn {
  /** Current credentials */
  credentials: Credentials;
  /** Set username */
  setUsername: (username: string) => void;
  /** Set password */
  setPassword: (password: string) => void;
  /** Clear all credentials */
  clearCredentials: () => void;
  /** Whether credentials are valid (non-empty) */
  isValid: boolean;
}

/**
 * Hook to manage mainframe credentials (session only, no persistence).
 * Used across multiple ASTs that require authentication.
 */
export function useCredentials(): UseCredentialsReturn {
  const [credentials, setCredentials] = useState<Credentials>(DEFAULT_CREDENTIALS);

  const setUsername = useCallback((username: string) => {
    setCredentials((prev) => ({ ...prev, username }));
  }, []);

  const setPassword = useCallback((password: string) => {
    setCredentials((prev) => ({ ...prev, password }));
  }, []);

  const clearCredentials = useCallback(() => {
    setCredentials(DEFAULT_CREDENTIALS);
  }, []);

  const isValid = credentials.username.trim().length > 0 && credentials.password.length > 0;

  return {
    credentials,
    setUsername,
    setPassword,
    clearCredentials,
    isValid,
  };
}
