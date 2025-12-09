// ============================================================================
// User Model - DynamoDB store
// ============================================================================

import type { User, EntraTokenClaims } from '@terminal/shared';
import { TerminalError, ERROR_CODES } from '@terminal/shared';
import {
  createUserRecord,
  getUserById,
  getUserByEmail,
  type UserRecord,
  KeyPrefix,
} from '../services/dynamodb';

export interface UpsertUserInput {
  entraId: string;
  email: string;
  name?: string | null;
  tenantId?: string | null;
}

function toUser(record: UserRecord): User {
  return {
    id: record.id,
    email: record.email,
    name: record.name,
    tenantId: record.tenantId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function findUserById(id: string): Promise<User | null> {
  const record = await getUserById(id);
  return record ? toUser(record) : null;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const record = await getUserByEmail(email);
  return record ? toUser(record) : null;
}

export async function upsertUser(data: UpsertUserInput): Promise<User> {
  const now = Date.now();
  const existing = await getUserById(data.entraId);

  const userRecord: UserRecord = {
    PK: `${KeyPrefix.USER}${data.entraId}`,
    SK: KeyPrefix.PROFILE,
    GSI1PK: data.email.toLowerCase(),
    id: data.entraId,
    email: data.email,
    name: data.name ?? existing?.name,
    tenantId: data.tenantId ?? existing?.tenantId,
    entraId: data.entraId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await createUserRecord(userRecord);
  return toUser(userRecord);
}

export async function upsertUserFromClaims(claims: EntraTokenClaims): Promise<User> {
  const entraId = claims.oid ?? claims.sub;
  const email = claims.preferred_username;

  if (!entraId || !email) {
    throw TerminalError.fromCode(ERROR_CODES.AUTH_INVALID_TOKEN);
  }

  return await upsertUser({
    entraId,
    email,
    name: claims.name ?? null,
    tenantId: claims.tid ?? null,
  });
}
