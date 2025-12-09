// ============================================================================
// Auth Middleware - Extract user info from Entra ID token
// ============================================================================

import type { FastifyRequest } from 'fastify';
import { verifyEntraToken, extractEntraUserId } from './entra';
import { TerminalError, ERROR_CODES } from '@terminal/shared';
import { upsertEntraUser } from '../models/user';

export interface EntraUser {
  id: string;
  email?: string;
  name?: string;
}

export async function requireUserId(request: FastifyRequest): Promise<string> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw TerminalError.fromCode(ERROR_CODES.AUTH_REQUIRED);
  }

  const token = authHeader.slice(7);
  const payload = await verifyEntraToken(token);
  const userId = extractEntraUserId(payload);

  if (!userId) {
    throw TerminalError.fromCode(ERROR_CODES.AUTH_REQUIRED);
  }

  return userId;
}

export async function requireUser(request: FastifyRequest): Promise<EntraUser> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw TerminalError.fromCode(ERROR_CODES.AUTH_REQUIRED);
  }

  const token = authHeader.slice(7);
  const payload = await verifyEntraToken(token);
  const userId = extractEntraUserId(payload);

  if (!userId) {
    throw TerminalError.fromCode(ERROR_CODES.AUTH_REQUIRED);
  }

  const email = payload.preferred_username || payload.email;
  if (!email) {
    throw TerminalError.fromCode(ERROR_CODES.AUTH_REQUIRED);
  }

  const user = await upsertEntraUser({
    id: userId,
    email,
    name: payload.name,
  });

  return {
    id: user.id,
    email: user.email,
    name: payload.name,
  };
}

