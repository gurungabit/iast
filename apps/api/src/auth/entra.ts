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
  email?: string;
  scp?: string;
}

export async function verifyEntraToken(token: string): Promise<EntraTokenPayload> {
  if (!config.entra.authority || !config.entra.apiAudience) {
    throw new TerminalError({
      code: ERROR_CODES.AUTH_REQUIRED,
      message: 'Entra configuration missing',
    });
  }

  const allowedAudiences = Array.from(
    new Set(
      [
        config.entra.apiAudience,
        // Accept both api://<id> and bare <id>
        config.entra.apiAudience.startsWith('api://')
          ? config.entra.apiAudience.replace('api://', '')
          : `api://${config.entra.apiAudience}`,
        config.entra.clientId,
      ].filter(Boolean)
    )
  );

  const issuerBase = config.entra.authority.replace(/\/v2\.0$/, '');
  const allowedIssuers = [
    config.entra.authority,
    issuerBase.replace('login.microsoftonline.com', 'sts.windows.net'),
  ];

  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: allowedIssuers,
      audience: allowedAudiences,
    });

    // Debug logging to help diagnose 401s (safe fields only)
    console.info('[entra] token accepted', {
      aud: payload.aud,
      iss: payload.iss,
      tid: payload.tid,
      oid: payload.oid,
      scp: payload.scp,
      roles: (payload as EntraTokenPayload).roles,
    });

    return payload as EntraTokenPayload;
  } catch (err) {
    console.warn('[entra] token rejected', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw new TerminalError({
      code: ERROR_CODES.AUTH_INVALID_TOKEN,
      message: 'Invalid Entra access token',
    });
  }
}

export function extractEntraUserId(payload: EntraTokenPayload): string {
  return payload.oid || payload.sub || '';
}

