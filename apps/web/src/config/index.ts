// ============================================================================
// Frontend Configuration
// ============================================================================

export interface FrontendConfig {
  apiBaseUrl: string;
  wsBaseUrl: string;
  auth: {
    tokenStorageKey: string;
    userStorageKey: string;
    expiresAtStorageKey: string;
  };
  terminal: {
    defaultCols: number;
    defaultRows: number;
    fontSize: number;
    fontFamily: string;
    cursorBlink: boolean;
    scrollback: number;
  };
  reconnect: {
    maxAttempts: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };
  heartbeat: {
    intervalMs: number;
    timeoutMs: number;
  };
}

function getEnvString(key: string, defaultValue: string): string {
  const value = import.meta.env[key];
  return typeof value === 'string' ? value : defaultValue;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = import.meta.env[key];
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
}

export const config: FrontendConfig = {
  apiBaseUrl: getEnvString('VITE_API_BASE_URL', 'http://localhost:3001'),
  wsBaseUrl: getEnvString('VITE_WS_BASE_URL', 'ws://localhost:3001'),
  auth: {
    tokenStorageKey: 'terminal_auth_token',
    userStorageKey: 'terminal_auth_user',
    expiresAtStorageKey: 'terminal_auth_expires',
  },
  terminal: {
    defaultCols: getEnvNumber('VITE_TERMINAL_COLS', 80),
    defaultRows: getEnvNumber('VITE_TERMINAL_ROWS', 24),
    fontSize: getEnvNumber('VITE_TERMINAL_FONT_SIZE', 14),
    fontFamily: getEnvString('VITE_TERMINAL_FONT_FAMILY', 'Menlo, Monaco, "Courier New", monospace'),
    cursorBlink: true,
    scrollback: getEnvNumber('VITE_TERMINAL_SCROLLBACK', 10000),
  },
  reconnect: {
    maxAttempts: 5,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
  },
  heartbeat: {
    intervalMs: 30000,
    timeoutMs: 5000,
  },
};

export default config;
