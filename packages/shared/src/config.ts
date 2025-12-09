// ============================================================================
// Configuration Types
// ============================================================================

export interface ServerConfig {
  host: string;
  port: number;
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
}

export interface ValkeyConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  tls?: boolean;
}

export interface EntraConfig {
  tenantId: string;
  clientId: string;
  apiAudience: string;
  apiScope: string;
  authorityHost?: string;
}

export interface TN3270Config {
  host: string;
  port: number;
  maxSessions: number;
}

export interface DynamoDBConfig {
  endpoint: string;
  region: string;
  tableName: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface AppConfig {
  env: 'development' | 'production' | 'test';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  server: ServerConfig;
  valkey: ValkeyConfig;
  entra: EntraConfig;
  tn3270: TN3270Config;
  dynamodb: DynamoDBConfig;
}

// ============================================================================
// Default Configuration Values
// ============================================================================

export const DEFAULT_SERVER_CONFIG: ServerConfig = {
  host: '0.0.0.0',
  port: 3001,
  cors: {
    origin: 'http://localhost:5173',
    credentials: true,
  },
};

export const DEFAULT_VALKEY_CONFIG: ValkeyConfig = {
  host: 'localhost',
  port: 6379,
};

export const DEFAULT_ENTRA_CONFIG: EntraConfig = {
  tenantId: 'enter-tenant-id',
  clientId: 'enter-client-id',
  apiAudience: 'api://enter-api-client-id',
  apiScope: 'api://enter-api-client-id/delegate',
  authorityHost: 'https://login.microsoftonline.com',
};

export const DEFAULT_TN3270_CONFIG: TN3270Config = {
  host: 'localhost',
  port: 3270,
  maxSessions: 10,
};

export const DEFAULT_DYNAMODB_CONFIG: DynamoDBConfig = {
  endpoint: 'http://127.0.0.1:8042',
  region: 'us-east-1',
  tableName: 'terminal',
  accessKeyId: 'dummy',
  secretAccessKey: 'dummy',
};

export function getDefaultConfig(): AppConfig {
  return {
    env: 'development',
    logLevel: 'debug',
    server: { ...DEFAULT_SERVER_CONFIG },
    valkey: { ...DEFAULT_VALKEY_CONFIG },
    entra: { ...DEFAULT_ENTRA_CONFIG },
    tn3270: { ...DEFAULT_TN3270_CONFIG },
    dynamodb: { ...DEFAULT_DYNAMODB_CONFIG },
  };
}
