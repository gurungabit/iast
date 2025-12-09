import { PublicClientApplication, InteractionRequiredAuthError, type AccountInfo } from '@azure/msal-browser';
import type { AuthUser } from '../types';

const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID as string;
const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID as string;
const redirectUri = (import.meta.env.VITE_ENTRA_REDIRECT_URI as string) ?? window.location.origin;
const apiScope = import.meta.env.VITE_ENTRA_API_SCOPE as string;

const authority = `https://login.microsoftonline.com/${tenantId}`;

export const loginRequest = {
  scopes: [apiScope],
};

export const msalInstance = new PublicClientApplication({
  auth: {
    clientId,
    authority,
    redirectUri,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
});

export async function initializeMsal(): Promise<void> {
  await msalInstance.initialize();

  const redirectResult = await msalInstance.handleRedirectPromise();
  if (redirectResult?.account) {
    msalInstance.setActiveAccount(redirectResult.account);
    return;
  }

  const activeAccount = msalInstance.getActiveAccount();
  if (!activeAccount) {
    const [firstAccount] = msalInstance.getAllAccounts();
    if (firstAccount) {
      msalInstance.setActiveAccount(firstAccount);
    }
  }
}

export function accountToAuthUser(account: AccountInfo | null): AuthUser | null {
  if (!account) return null;
  const claims = account.idTokenClaims ?? {};
  return {
    id: (claims.oid as string) ?? account.localAccountId,
    email: (claims.preferred_username as string) ?? account.username,
    name: (claims.name as string) ?? account.name ?? account.username,
    tenantId: (claims.tid as string) ?? undefined,
  };
}

export async function acquireApiToken(): Promise<string> {
  const account = msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0];
  if (!account) {
    throw new Error('No active account. Please sign in.');
  }

  try {
    const result = await msalInstance.acquireTokenSilent({
      ...loginRequest,
      account,
    });
    return result.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      await msalInstance.acquireTokenRedirect(loginRequest);
    }
    throw error instanceof Error ? error : new Error('Failed to acquire token');
  }
}

