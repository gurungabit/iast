// ============================================================================
// API Configuration
// ============================================================================

import type { AppConfig } from '@terminal/shared';
import { getDefaultConfig } from '@terminal/shared';

function getEnvString(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value) {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === 'true') return true;
  if (value === 'false') return false;
  return defaultValue;
}

export function loadConfig(): AppConfig {
  const defaults = getDefaultConfig();

  return {
    env: getEnvString('NODE_ENV', 'development') as AppConfig['env'],
    logLevel: getEnvString('LOG_LEVEL', 'debug') as AppConfig['logLevel'],
    server: {
      host: getEnvString('HOST', defaults.server.host),
      port: getEnvNumber('PORT', defaults.server.port),
      cors: {
        origin: getEnvString('CORS_ORIGIN', 'http://localhost:5173'),
        credentials: true,
      },
    },
    valkey: {
      host: getEnvString('VALKEY_HOST', defaults.valkey.host),
      port: getEnvNumber('VALKEY_PORT', defaults.valkey.port),
      password: process.env['VALKEY_PASSWORD'],
      db: getEnvNumber('VALKEY_DB', 0),
      tls: getEnvBoolean('VALKEY_TLS', false),
    },
    auth: {
      jwtSecret: getEnvString('JWT_SECRET', defaults.auth.jwtSecret),
      tokenExpirationSeconds: getEnvNumber('TOKEN_EXPIRATION_SECONDS', defaults.auth.tokenExpirationSeconds),
      refreshTokenExpirationSeconds: getEnvNumber('REFRESH_TOKEN_EXPIRATION_SECONDS', defaults.auth.refreshTokenExpirationSeconds),
      bcryptRounds: getEnvNumber('BCRYPT_ROUNDS', defaults.auth.bcryptRounds),
    },
    pty: {
      defaultShell: getEnvString('DEFAULT_SHELL', defaults.pty.defaultShell),
      defaultCols: getEnvNumber('DEFAULT_COLS', defaults.pty.defaultCols),
      defaultRows: getEnvNumber('DEFAULT_ROWS', defaults.pty.defaultRows),
      scrollback: getEnvNumber('SCROLLBACK', defaults.pty.scrollback),
      maxSessions: getEnvNumber('MAX_SESSIONS', defaults.pty.maxSessions),
    },
  };
}

export const config = loadConfig();
