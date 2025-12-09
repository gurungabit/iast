// ============================================================================
// useAuth Hook - Azure Entra ID Authentication with MSAL
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useMsal } from '@azure/msal-react';
import { InteractionStatus, InteractionRequiredAuthError } from '@azure/msal-browser';
import { graphTokenRequest, apiConfig, msalInstance } from '../config/msalConfig';

export interface UserInfo {
  id: string;
  name: string;
  email: string;
  username: string;
}

export interface UseAuthReturn {
  isAuthenticated: boolean;
  isLoading: boolean;
  userInfo: UserInfo | null;
  accessToken: string | null;
  getAccessToken: () => Promise<string | null>;
  getApiAccessToken: () => Promise<string | null>;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const { instance, accounts, inProgress } = useMsal();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const account = accounts[0] ?? instance.getActiveAccount() ?? msalInstance.getActiveAccount();

  useEffect(() => {
    if (account && !instance.getActiveAccount()) {
      instance.setActiveAccount(account);
      msalInstance.setActiveAccount(account);
    }
  }, [account, instance]);

  // Derive user info from account using useMemo
  const userInfo = useMemo<UserInfo | null>(() => {
    if (!account) return null;
    return {
      id: account.localAccountId,
      name: account.name || '',
      email: account.username || '',
      username: account.username || '',
    };
  }, [account]);

  const isAuthenticated = !!account;

  /**
   * Acquire Graph API access token silently (for user profile)
   * Falls back to interactive login if silent acquisition fails
   */
  const acquireToken = useCallback(async (): Promise<string | null> => {
    if (!account) {
      return null;
    }

    if (inProgress !== InteractionStatus.None) {
      return null;
    }

    try {
      // Try silent token acquisition first
      const response = await instance.acquireTokenSilent({
        ...graphTokenRequest,
        account,
      });

      setAccessToken(response.accessToken);
      return response.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        try {
          await instance.acquireTokenRedirect({
            ...graphTokenRequest,
            account,
          });
          return null; // Will redirect
        } catch {
          return null;
        }
      }
      return null;
    }
  }, [account, instance, inProgress]);

  /**
   * Get API access token for backend authentication
   * Uses custom API scope configured in Azure
   */
  const getApiAccessToken = useCallback(async (): Promise<string | null> => {
    const activeAccount = account ?? instance.getActiveAccount() ?? instance.getAllAccounts()[0];
    if (!activeAccount) {
      return null;
    }

    if (inProgress !== InteractionStatus.None) {
      return null;
    }

    try {
      const response = await instance.acquireTokenSilent({
        scopes: apiConfig.scopes,
        account: activeAccount,
      });

      return response.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        try {
          await instance.acquireTokenRedirect({
            scopes: apiConfig.scopes,
            account: activeAccount,
          });
          return null;
        } catch {
          return null;
        }
      }
      return null;
    }
  }, [account, instance, inProgress]);

  /**
   * Get current access token or acquire new one
   */
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (accessToken) {
      return accessToken;
    }
    return await acquireToken();
  }, [accessToken, acquireToken]);

  /**
   * Login user
   */
  const login = useCallback(async () => {
    try {
      await instance.loginRedirect(graphTokenRequest);
    } catch {
      // no-op
    }
  }, [instance]);

  /**
   * Logout user
   */
  const logout = useCallback(async () => {
    try {
      await instance.logoutRedirect({
        account: account ?? instance.getActiveAccount() ?? undefined,
      });
      setAccessToken(null);
    } catch {
      // no-op
    }
  }, [instance, account]);

  // Initial token acquisition
  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      if (account && !accessToken && inProgress === InteractionStatus.None) {
        await acquireToken();
      }
      if (!cancelled) {
        setIsLoading(false);
      }
    };

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [account, accessToken, acquireToken, inProgress]);

  return {
    isAuthenticated,
    isLoading,
    userInfo,
    accessToken,
    getAccessToken,
    getApiAccessToken, // API token for backend authentication
    login,
    logout,
  };
}
