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

export function loadConfig(): AppConfig {
  const defaults = getDefaultConfig();

  return {
    env: (process.env['NODE_ENV'] as AppConfig['env']) || 'development',
    logLevel: (process.env['LOG_LEVEL'] as AppConfig['logLevel']) || 'debug',
    server: {
      host: getEnvString('HOST', defaults.server.host),
      port: getEnvNumber('PORT', defaults.server.port),
      cors: {
        origin: getEnvString('CORS_ORIGIN', 'http://localhost:5173'),
        credentials: true,
      },
    },
    auth: {
      entraTenantId: getEnvString('ENTRA_TENANT_ID', defaults.auth.entraTenantId),
      entraClientId: getEnvString('ENTRA_CLIENT_ID', defaults.auth.entraClientId),
      entraAudience: getEnvString('ENTRA_API_AUDIENCE', defaults.auth.entraAudience),
    },
    tn3270: {
      host: getEnvString('TN3270_HOST', defaults.tn3270.host),
      port: getEnvNumber('TN3270_PORT', defaults.tn3270.port),
      maxSessions: getEnvNumber('TN3270_MAX_SESSIONS', defaults.tn3270.maxSessions),
    },
    dynamodb: {
      endpoint: getEnvString('DYNAMODB_ENDPOINT', defaults.dynamodb.endpoint),
      region: getEnvString('DYNAMODB_REGION', defaults.dynamodb.region),
      tableName: getEnvString('DYNAMODB_TABLE_NAME', defaults.dynamodb.tableName),
      accessKeyId: getEnvString('DYNAMODB_ACCESS_KEY_ID', defaults.dynamodb.accessKeyId),
      secretAccessKey: getEnvString('DYNAMODB_SECRET_ACCESS_KEY', defaults.dynamodb.secretAccessKey),
    },
  };
}

export const config = loadConfig();
