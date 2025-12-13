// ============================================================================
// Token Accessor - Provides access to MSAL tokens outside React context
// ============================================================================

// Check if we're in dev mode (Vite sets this automatically)
const DEV_MODE = import.meta.env.DEV;

/**
 * Type for the token accessor function
 */
type TokenAccessor = () => Promise<string | null>;

/**
 * Stored token accessor function - set by useAuth hook
 */
let tokenAccessor: TokenAccessor | null = null;

/**
 * Dev mode bypass - when set, returns 'dev' token instead of MSAL token
 */
let devModeActive = false;

/**
 * Enable dev mode bypass (skips MSAL, uses 'dev' token)
 */
export function enableDevMode(): void {
  if (DEV_MODE) {
    devModeActive = true;
    console.log('🔓 Dev mode enabled - using bypass token');
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
  return devModeActive;
}

/**
 * Set the token accessor function (called from useAuth hook)
 */
export function setTokenAccessor(accessor: TokenAccessor): void {
  tokenAccessor = accessor;
}

/**
 * Clear the token accessor (called on logout)
 */
export function clearTokenAccessor(): void {
  tokenAccessor = null;
  devModeActive = false;
}

/**
 * Get the current access token
 * Can be called from anywhere (services, WebSocket handlers, etc.)
 */
export async function getAccessToken(): Promise<string | null> {
  // Dev mode bypass - return 'dev' token instead of MSAL token
  if (devModeActive) {
    return 'dev';
  }

  if (!tokenAccessor) {
    console.warn('Token accessor not initialized - user may not be authenticated');
    return null;
  }
  return tokenAccessor();
}

