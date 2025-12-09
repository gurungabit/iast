// ============================================================================
// useAuth Hook - Authentication State Management with Persistence
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { accountToAuthUser, acquireApiToken, loginRequest } from '../auth/entra';
import { msalInstance } from '../auth/entra';
import { fetchCurrentUser } from '../services/auth';
import type { AuthState, AuthUser } from '../types';

export interface UseAuthReturn {
  state: AuthState;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string>;
}

export function useAuth(): UseAuthReturn {
  const { instance, accounts, inProgress } = useMsal();
  const isMsalAuthenticated = useIsAuthenticated();
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    isLoading: true,
    error: null,
  });

  const activeAccountUser = useMemo<AuthUser | null>(() => {
    const account = instance.getActiveAccount() ?? accounts[0] ?? null;
    return accountToAuthUser(account);
  }, [accounts, instance]);

  useEffect(() => {
    if (!instance.getActiveAccount() && accounts.length > 0) {
      instance.setActiveAccount(accounts[0]);
    }
  }, [accounts, instance]);

  useEffect(() => {
    const syncUser = async (): Promise<void> => {
      if (!isMsalAuthenticated) {
        setState({
          isAuthenticated: false,
          user: null,
          isLoading: false,
          error: null,
        });
        return;
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        // Ensure access token works with backend and user is provisioned
        await acquireApiToken();
        const backendUser = await fetchCurrentUser();
        setState({
          isAuthenticated: true,
          user: {
            id: backendUser.id,
            email: backendUser.email,
            name: backendUser.name ?? activeAccountUser?.name,
            tenantId: backendUser.tenantId ?? activeAccountUser?.tenantId,
          },
          isLoading: false,
          error: null,
        });
      } catch (error) {
        setState({
          isAuthenticated: false,
          user: null,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Authentication failed',
        });
      }
    };

    void syncUser();
  }, [isMsalAuthenticated, activeAccountUser]);

  const login = useCallback(async (): Promise<void> => {
    await instance.loginRedirect(loginRequest);
  }, [instance]);

  const logout = useCallback(async (): Promise<void> => {
    await msalInstance.logoutRedirect();
    setState({
      isAuthenticated: false,
      user: null,
      isLoading: false,
      error: null,
    });
  }, []);

  const getAccessToken = useCallback(async (): Promise<string> => {
    return acquireApiToken();
  }, []);

  return {
    state: {
      ...state,
      isLoading: state.isLoading || inProgress !== 'none',
    },
    login,
    logout,
    getAccessToken,
  };
}
