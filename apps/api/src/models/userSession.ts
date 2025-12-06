// ============================================================================
// User Session Model - Named persistent user sessions
// ============================================================================

import type { UserSession } from '@terminal/shared';
import { generateSessionId } from '@terminal/shared';
import {
  createSessionRecord,
  getSessionById,
  getUserSessions,
  updateSessionName,
  deleteSession,
  type SessionRecord,
  KeyPrefix,
} from '../services/dynamodb';

export interface CreateUserSessionData {
  userId: string;
  name: string;
}

export async function createUserSession(data: CreateUserSessionData): Promise<UserSession> {
  const sessionId = generateSessionId();
  const now = Date.now();

  const sessionRecord: SessionRecord = {
    PK: `${KeyPrefix.USER}${data.userId}`,
    SK: `${KeyPrefix.SESSION}${sessionId}`,
    userId: data.userId,
    sessionId,
    name: data.name,
    createdAt: now,
    updatedAt: now,
  };

  await createSessionRecord(sessionRecord);

  return {
    id: sessionId,
    userId: data.userId,
    name: data.name,
    createdAt: now,
    updatedAt: now,
  };
}

export async function findUserSessionById(
  userId: string,
  sessionId: string
): Promise<UserSession | null> {
  const record = await getSessionById(userId, sessionId);
  if (!record) return null;

  return {
    id: record.sessionId,
    userId: record.userId,
    name: record.name,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function getUserSessionsByUserId(userId: string): Promise<UserSession[]> {
  const records = await getUserSessions(userId);
  return records.map((record) => ({
    id: record.sessionId,
    userId: record.userId,
    name: record.name,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }));
}

export async function updateUserSessionName(
  userId: string,
  sessionId: string,
  newName: string
): Promise<void> {
  await updateSessionName(userId, sessionId, newName);
}

export async function deleteUserSession(userId: string, sessionId: string): Promise<void> {
  await deleteSession(userId, sessionId);
}
