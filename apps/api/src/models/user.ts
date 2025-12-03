// ============================================================================
// User Model - In-memory store (replace with DB in production)
// ============================================================================

import bcrypt from 'bcrypt';
import type { User } from '@terminal/shared';

// In-memory user store - replace with database in production
const users = new Map<string, User & { passwordHash: string }>();
const usersByEmail = new Map<string, string>(); // email -> userId

export interface CreateUserData {
  id: string;
  email: string;
  passwordHash: string;
}

export function createUser(data: CreateUserData): User {
  const now = Date.now();
  const user = {
    id: data.id,
    email: data.email,
    passwordHash: data.passwordHash,
    createdAt: now,
    updatedAt: now,
  };

  users.set(data.id, user);
  usersByEmail.set(data.email.toLowerCase(), data.id);

  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function findUserById(id: string): (User & { passwordHash: string }) | null {
  return users.get(id) ?? null;
}

export function findUserByEmail(email: string): (User & { passwordHash: string }) | null {
  const userId = usersByEmail.get(email.toLowerCase());
  if (!userId) return null;
  return users.get(userId) ?? null;
}

export function userExists(email: string): boolean {
  return usersByEmail.has(email.toLowerCase());
}

export function toPublicUser(user: User & { passwordHash: string }): User {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// ============================================================================
// Demo User - Create on startup
// ============================================================================

async function createDemoUser(): Promise<void> {
  const demoEmail = 'demo@example.com';
  const demoPassword = 'demo1234';

  if (userExists(demoEmail)) {
    return;
  }

  // Hash password with bcrypt (10 rounds)
  const passwordHash = await bcrypt.hash(demoPassword, 10);

  createUser({
    id: 'demo-user-001',
    email: demoEmail,
    passwordHash,
  });

  console.log('✓ Demo user created: demo@example.com / demo1234');
}

// Create demo user on module load
void createDemoUser();
