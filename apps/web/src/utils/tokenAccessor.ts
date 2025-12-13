// ============================================================================
// Token Accessor - Provides access to MSAL tokens outside React context
// ============================================================================

// Check if we're in dev mode (Vite sets this automatically)
const DEV_MODE = import.meta.env.DEV;
const DEV_SESSION_KEY = '__dev_auth__';

/**
 * Type for the token accessor function
 */
type TokenAccessor = () => Promise<string | null>;

/**
 * Stored token accessor function - set by useAuth hook
 */
let tokenAccessor: TokenAccessor | null = null;

/**
 * Check if dev session is active (reads sessionStorage directly)
 */
function isDevSessionActive(): boolean {
  if (!DEV_MODE) return false;
  try {
    return sessionStorage.getItem(DEV_SESSION_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Enable dev mode bypass
 */
export function enableDevMode(): void {
  if (DEV_MODE) {
    try {
      sessionStorage.setItem(DEV_SESSION_KEY, 'true');
      console.log('🔓 Dev mode enabled');
      window.location.reload();
    } catch (e) {
      console.error('Failed to enable dev mode:', e);
    }
  }
}

/**
 * Check if dev mode is available
 */
export function isDevModeAvailable(): boolean {
  return DEV_MODE;
}

/**
 * Check if dev mode is active
 */
export function isDevModeActive(): boolean {
  return isDevSessionActive();
}

/**
 * Set the token accessor function (called from useAuth hook)
 */
export function setTokenAccessor(accessor: TokenAccessor): void {
  tokenAccessor = accessor;
}

/**
 * Clear the token accessor (called when no MSAL account)
 * NOTE: Does NOT clear dev session - that's only for explicit logout
 */
export function clearTokenAccessor(): void {
  tokenAccessor = null;
}

/**
 * Full logout - clears token accessor AND dev session
 */
export function fullLogout(): void {
  tokenAccessor = null;
  try {
    sessionStorage.removeItem(DEV_SESSION_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get the current access token
 * Can be called from anywhere (services, WebSocket handlers, etc.)
 */
export async function getAccessToken(): Promise<string | null> {
  // Dev mode bypass - check sessionStorage directly
  if (isDevSessionActive()) {
    console.log('[getAccessToken] Using dev token');
    return 'dev';
  }

  if (!tokenAccessor) {
    console.warn('Token accessor not initialized - user may not be authenticated');
    return null;
  }
  return tokenAccessor();
}
