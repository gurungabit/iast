// ============================================================================
// Azure Entra ID token validation
// ============================================================================

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { config } from '../config';
import { TerminalError, ERROR_CODES } from '@terminal/shared';

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  if (!config.entra.jwksUri) {
    throw new TerminalError({
      code: ERROR_CODES.AUTH_REQUIRED,
      message: 'Entra configuration missing',
    });
  }
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(config.entra.jwksUri));
  }
  return jwks;
}

export interface EntraTokenPayload extends JWTPayload {
  oid?: string;
  tid?: string;
  name?: string;
  preferred_username?: string;
  scp?: string;
}

export async function verifyEntraToken(token: string): Promise<EntraTokenPayload> {
  if (!config.entra.authority || !config.entra.apiAudience) {
    throw new TerminalError({
      code: ERROR_CODES.AUTH_REQUIRED,
      message: 'Entra configuration missing',
    });
  }

  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: config.entra.authority,
      audience: config.entra.apiAudience,
    });

    return payload as EntraTokenPayload;
  } catch (err) {
    throw new TerminalError({
      code: ERROR_CODES.AUTH_INVALID_TOKEN,
      message: 'Invalid Entra access token',
    });
  }
}

export function extractEntraUserId(payload: EntraTokenPayload): string {
  return payload.oid || payload.sub || '';
}

