// ============================================================================
// Session Service - Terminal session management
// ============================================================================

import { config } from '../config';
import {
  createSession,
  findSession,
  closeSession,
  getActiveSessionCount,
  sessionBelongsToUser,
  updateSessionActivity,
  type TerminalSession,
} from '../models/session';
import {
  TerminalError,
  ERROR_CODES,
  generateSessionId,
} from '@terminal/shared';

export function createTerminalSession(userId: string, providedSessionId?: string): TerminalSession {
  // Check session limit
  const activeCount = getActiveSessionCount(userId);
  if (activeCount >= config.pty.maxSessions) {
    throw TerminalError.fromCode(ERROR_CODES.SESSION_LIMIT_EXCEEDED, {
      maxSessions: config.pty.maxSessions,
      activeCount,
    });
  }

  const sessionId = providedSessionId ?? generateSessionId();

  // Check if session already exists
  const existing = findSession(sessionId);
  if (existing && existing.status === 'active') {
    // Session exists and is active - verify ownership
    if (!sessionBelongsToUser(sessionId, userId)) {
      throw TerminalError.fromCode(ERROR_CODES.AUTH_REQUIRED);
    }
    return existing;
  }

  return createSession(sessionId, userId);
}

export function getTerminalSession(sessionId: string, userId: string): TerminalSession {
  const session = findSession(sessionId);
  if (!session) {
    throw TerminalError.fromCode(ERROR_CODES.SESSION_NOT_FOUND);
  }

  if (!sessionBelongsToUser(sessionId, userId)) {
    throw TerminalError.fromCode(ERROR_CODES.AUTH_REQUIRED);
  }

  if (session.status !== 'active') {
    throw TerminalError.fromCode(ERROR_CODES.SESSION_INVALID_STATE);
  }

  return session;
}

export function endTerminalSession(sessionId: string, userId: string): void {
  const session = findSession(sessionId);
  if (!session) {
    return; // Already closed or doesn't exist
  }

  if (!sessionBelongsToUser(sessionId, userId)) {
    throw TerminalError.fromCode(ERROR_CODES.AUTH_REQUIRED);
  }

  closeSession(sessionId);
}

export function touchSession(sessionId: string): void {
  updateSessionActivity(sessionId);
}

export { findSession, getActiveSessionCount, sessionBelongsToUser };
