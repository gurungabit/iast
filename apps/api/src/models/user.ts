// ============================================================================
// User Model - DynamoDB store
// ============================================================================

import type { User } from '@terminal/shared';
import {
  createUserRecord,
  getUserById,
  getUserByEmail,
  userExistsByEmail,
  type UserRecord,
  KeyPrefix,
} from '../services/dynamodb';

export interface CreateUserData {
  id: string;
  email: string;
  passwordHash?: string;
  name?: string;
}

export async function createUser(data: CreateUserData): Promise<User> {
  const now = Date.now();
  const userRecord: UserRecord = {
    PK: `${KeyPrefix.USER}${data.id}`,
    SK: KeyPrefix.PROFILE,
    GSI1PK: data.email.toLowerCase(),
    id: data.id,
    email: data.email,
    passwordHash: data.passwordHash,
    name: data.name,
    createdAt: now,
    updatedAt: now,
  };

  await createUserRecord(userRecord);

  return {
    id: userRecord.id,
    email: userRecord.email,
    createdAt: userRecord.createdAt,
    updatedAt: userRecord.updatedAt,
  };
}

export async function findUserById(id: string): Promise<(User & { passwordHash?: string }) | null> {
  return await getUserById(id);
}

export async function findUserByEmail(
  email: string
): Promise<(User & { passwordHash?: string }) | null> {
  return await getUserByEmail(email);
}

export async function userExists(email: string): Promise<boolean> {
  return await userExistsByEmail(email);
}

export function toPublicUser(user: User & { passwordHash?: string }): User {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// ============================================================================
// Entra User helpers (password-less)
// ============================================================================

export async function upsertEntraUser(params: {
  id: string;
  email: string;
  name?: string;
}): Promise<User> {
  const existing = await findUserById(params.id);
  if (existing) {
    return {
      id: existing.id,
      email: existing.email,
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt,
    };
  }

  return await createUser({
    id: params.id,
    email: params.email,
    name: params.name,
    // No password for Entra users
  });
}

// Demo user creation removed (no passwords for Entra users)
