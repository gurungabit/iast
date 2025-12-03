// ============================================================================
// Auth Service - JWT token management and password hashing
// ============================================================================

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import type { AuthTokenPayload, User, AuthResponse } from '@terminal/shared';
import {
  generateUserId,
  TerminalError,
  ERROR_CODES,
} from '@terminal/shared';
import {
  createUser,
  findUserByEmail,
  userExists,
  toPublicUser,
} from '../models/user';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, config.auth.bcryptRounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(user: User): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + config.auth.tokenExpirationSeconds * 1000;

  const payload: AuthTokenPayload = {
    sub: user.id,
    email: user.email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(expiresAt / 1000),
  };

  const token = jwt.sign(payload, config.auth.jwtSecret);

  return { token, expiresAt };
}

export function verifyToken(token: string): AuthTokenPayload {
  try {
    const payload = jwt.verify(token, config.auth.jwtSecret) as AuthTokenPayload;
    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw TerminalError.fromCode(ERROR_CODES.AUTH_TOKEN_EXPIRED);
    }
    throw TerminalError.fromCode(ERROR_CODES.AUTH_INVALID_TOKEN);
  }
}

export async function registerUser(email: string, password: string): Promise<AuthResponse> {
  // Check if user already exists
  if (userExists(email)) {
    throw new TerminalError({
      code: ERROR_CODES.VALIDATION_FAILED,
      message: 'Email already registered',
    });
  }

  // Hash password and create user
  const passwordHash = await hashPassword(password);
  const user = createUser({
    id: generateUserId(),
    email,
    passwordHash,
  });

  // Generate token
  const { token, expiresAt } = generateToken(user);

  return {
    user,
    token,
    expiresAt,
  };
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  // Find user
  const user = findUserByEmail(email);
  if (!user) {
    throw TerminalError.fromCode(ERROR_CODES.AUTH_INVALID_CREDENTIALS);
  }

  // Verify password
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    throw TerminalError.fromCode(ERROR_CODES.AUTH_INVALID_CREDENTIALS);
  }

  // Generate token
  const { token, expiresAt } = generateToken(toPublicUser(user));

  return {
    user: toPublicUser(user),
    token,
    expiresAt,
  };
}

export function refreshUserToken(currentToken: string): { token: string; expiresAt: number } {
  const payload = verifyToken(currentToken);

  // Find user to ensure they still exist
  const user = findUserByEmail(payload.email);
  if (!user) {
    throw TerminalError.fromCode(ERROR_CODES.AUTH_USER_NOT_FOUND);
  }

  return generateToken(toPublicUser(user));
}
