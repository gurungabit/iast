// ============================================================================
// useAuth Hook - Authentication State Management with Persistence
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import type { AuthState } from '../types';
import type { LoginRequest, RegisterRequest } from '@terminal/shared';
import {
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  validateToken,
} from '../services/auth';
import {
  getStoredToken,
  getStoredUser,
  getStoredExpiresAt,
  isTokenExpired,
  clearAuthStorage,
} from '../utils/storage';

export interface UseAuthReturn {
  state: AuthState;
  login: (request: LoginRequest) => Promise<boolean>;
  register: (request: RegisterRequest) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
}

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    expiresAt: null,
    isLoading: true,
    error: null,
  });

  // Check stored auth on mount
  useEffect(() => {
    const initAuth = async (): Promise<void> => {
      const token = getStoredToken();
      const user = getStoredUser();
      const expiresAt = getStoredExpiresAt();

      if (token && user && !isTokenExpired()) {
        // Validate token with server
        const isValid = await validateToken();
        if (isValid) {
          setState({
            isAuthenticated: true,
            user,
            token,
            expiresAt,
            isLoading: false,
            error: null,
          });
          return;
        }
      }

      // Clear invalid auth
      clearAuthStorage();
      setState({
        isAuthenticated: false,
        user: null,
        token: null,
        expiresAt: null,
        isLoading: false,
        error: null,
      });
    };

    void initAuth();
  }, []);

  const login = useCallback(async (request: LoginRequest): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    const result = await apiLogin(request);

    if (result.success) {
      const { user, token, expiresAt } = result.data;
      setState({
        isAuthenticated: true,
        user: { id: user.id, email: user.email },
        token,
        expiresAt,
        isLoading: false,
        error: null,
      });
      return true;
    }

    setState((prev) => ({
      ...prev,
      isLoading: false,
      error: result.error.message,
    }));
    return false;
  }, []);

  const register = useCallback(async (request: RegisterRequest): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    const result = await apiRegister(request);

    if (result.success) {
      const { user, token, expiresAt } = result.data;
      setState({
        isAuthenticated: true,
        user: { id: user.id, email: user.email },
        token,
        expiresAt,
        isLoading: false,
        error: null,
      });
      return true;
    }

    setState((prev) => ({
      ...prev,
      isLoading: false,
      error: result.error.message,
    }));
    return false;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    await apiLogout();
    setState({
      isAuthenticated: false,
      user: null,
      token: null,
      expiresAt: null,
      isLoading: false,
      error: null,
    });
  }, []);

  const checkAuth = useCallback(async (): Promise<boolean> => {
    const token = getStoredToken();
    if (!token || isTokenExpired()) {
      clearAuthStorage();
      setState({
        isAuthenticated: false,
        user: null,
        token: null,
        expiresAt: null,
        isLoading: false,
        error: null,
      });
      return false;
    }

    const isValid = await validateToken();
    if (!isValid) {
      clearAuthStorage();
      setState({
        isAuthenticated: false,
        user: null,
        token: null,
        expiresAt: null,
        isLoading: false,
        error: null,
      });
      return false;
    }

    return true;
  }, []);

  return {
    state,
    login,
    register,
    logout,
    checkAuth,
  };
}
