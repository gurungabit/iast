// ============================================================================
// useCredentials Hook - Manage persisted mainframe credentials
// ============================================================================

import { useState, useCallback, useEffect } from 'react';
import {
  type Credentials,
  CREDENTIALS_STORAGE_KEY,
  DEFAULT_CREDENTIALS,
} from './types';

export interface UseCredentialsReturn {
  /** Current credentials */
  credentials: Credentials;
  /** Set username */
  setUsername: (username: string) => void;
  /** Set password */
  setPassword: (password: string) => void;
  /** Set remember me preference */
  setRememberMe: (rememberMe: boolean) => void;
  /** Clear all stored credentials */
  clearCredentials: () => void;
  /** Whether credentials are valid (non-empty) */
  isValid: boolean;
}

function loadCredentials(): Credentials {
  try {
    const stored = localStorage.getItem(CREDENTIALS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<Credentials>;
      return {
        username: parsed.username || DEFAULT_CREDENTIALS.username,
        password: parsed.password || DEFAULT_CREDENTIALS.password,
        rememberMe: parsed.rememberMe ?? false,
      };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_CREDENTIALS;
}

function saveCredentials(credentials: Credentials): void {
  if (credentials.rememberMe) {
    localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify(credentials));
  } else {
    localStorage.removeItem(CREDENTIALS_STORAGE_KEY);
  }
}

/**
 * Hook to manage mainframe credentials with localStorage persistence.
 * Used across multiple ASTs that require authentication.
 */
export function useCredentials(): UseCredentialsReturn {
  const [credentials, setCredentials] = useState<Credentials>(loadCredentials);

  // Save to localStorage when rememberMe changes or credentials change
  useEffect(() => {
    saveCredentials(credentials);
  }, [credentials]);

  const setUsername = useCallback((username: string) => {
    setCredentials((prev) => ({ ...prev, username }));
  }, []);

  const setPassword = useCallback((password: string) => {
    setCredentials((prev) => ({ ...prev, password }));
  }, []);

  const setRememberMe = useCallback((rememberMe: boolean) => {
    setCredentials((prev) => ({ ...prev, rememberMe }));
  }, []);

  const clearCredentials = useCallback(() => {
    localStorage.removeItem(CREDENTIALS_STORAGE_KEY);
    setCredentials(DEFAULT_CREDENTIALS);
  }, []);

  const isValid = credentials.username.trim().length > 0 && credentials.password.length > 0;

  return {
    credentials,
    setUsername,
    setPassword,
    setRememberMe,
    clearCredentials,
    isValid,
  };
}
