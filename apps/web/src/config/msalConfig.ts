// ============================================================================
// Azure Entra ID (MSAL) configuration
// ============================================================================

import { PublicClientApplication, type Configuration, type SilentRequest } from '@azure/msal-browser';

const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID || '';
const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID || '';
const redirectUri = import.meta.env.VITE_ENTRA_REDIRECT_URI || window.location.origin;
const apiScopeEnv = import.meta.env.VITE_ENTRA_API_SCOPE || '';

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: tenantId ? `https://login.microsoftonline.com/${tenantId}` : undefined,
    redirectUri,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
};

/**
 * Scopes for acquiring Graph API tokens (user profile)
 */
export const graphTokenRequest: SilentRequest = {
  scopes: ['User.Read'],
};

/**
 * API Configuration for accessing backend API
 * Uses custom API scope for JWT validation
 */
export const apiConfig = {
  scopes: [apiScopeEnv].filter(Boolean),
};

export const msalInstance = new PublicClientApplication(msalConfig);

