// ============================================================================
// Auth Service - Entra access token validation
// ============================================================================

import { createRemoteJWKSet, jwtVerify } from 'jose';
import { config } from '../config';
import type { EntraTokenClaims, User } from '@terminal/shared';
import { TerminalError, ERROR_CODES } from '@terminal/shared';
import { upsertUserFromClaims } from '../models/user';

const authorityHost = (config.entra.authorityHost ?? 'https://login.microsoftonline.com').replace(/\/$/, '');
const issuer = `${authorityHost}/${config.entra.tenantId}/v2.0`;
const jwks = createRemoteJWKSet(new URL(`${issuer}/discovery/v2.0/keys`));
const requiredAudience = config.entra.apiAudience;
const requiredScope = config.entra.apiScope;

function hasRequiredScope(claims: EntraTokenClaims): boolean {
  if (!requiredScope) return true;
  const scopes = (claims.scp ?? '').split(' ').filter(Boolean);
  const normalizedRequired = requiredScope.includes('/')
    ? requiredScope.split('/').pop() ?? requiredScope
    : requiredScope;

  return scopes.includes(requiredScope) || scopes.includes(normalizedRequired);
}

export async function verifyAccessToken(token: string): Promise<EntraTokenClaims> {
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: requiredAudience,
    });

    const claims = payload as EntraTokenClaims;

    if (!hasRequiredScope(claims)) {
      throw TerminalError.fromCode(ERROR_CODES.FORBIDDEN, { reason: 'missing_scope' });
    }

    return claims;
  } catch (error) {
    if ((error as Error).name === 'JWTExpired') {
      throw TerminalError.fromCode(ERROR_CODES.AUTH_TOKEN_EXPIRED);
    }

    if (error instanceof TerminalError) {
      throw error;
    }

    throw TerminalError.fromCode(ERROR_CODES.AUTH_INVALID_TOKEN);
  }
}

export async function authenticateUser(token: string): Promise<User> {
  const claims = await verifyAccessToken(token);
  return await upsertUserFromClaims(claims);
}
