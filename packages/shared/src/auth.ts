// ============================================================================
// Auth Types
// ============================================================================

export interface User {
  id: string;
  email: string;
  createdAt: number;
  updatedAt: number;
}

export interface UserSession {
  id: string;
  userId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface AuthSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: number;
  createdAt: number;
}

export interface AuthTokenPayload {
  sub: string; // userId
  email: string;
  iat: number;
  exp: number;
}

// ============================================================================
// Auth Request/Response Types
// ============================================================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  expiresAt: number;
}

export interface RefreshTokenRequest {
  token: string;
}

export interface RefreshTokenResponse {
  token: string;
  expiresAt: number;
}

// ============================================================================
// Validation
// ============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export function isValidPassword(password: string): boolean {
  // Minimum 8 characters
  return password.length >= 8;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateLoginRequest(request: LoginRequest): ValidationResult {
  const errors: string[] = [];

  if (!request.email || typeof request.email !== 'string') {
    errors.push('Email is required');
  } else if (!isValidEmail(request.email)) {
    errors.push('Invalid email format');
  }

  if (!request.password || typeof request.password !== 'string') {
    errors.push('Password is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateRegisterRequest(request: RegisterRequest): ValidationResult {
  const errors: string[] = [];

  if (!request.email || typeof request.email !== 'string') {
    errors.push('Email is required');
  } else if (!isValidEmail(request.email)) {
    errors.push('Invalid email format');
  }

  if (!request.password || typeof request.password !== 'string') {
    errors.push('Password is required');
  } else if (!isValidPassword(request.password)) {
    errors.push('Password must be at least 8 characters');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Storage Keys
// ============================================================================

export const AUTH_STORAGE_KEYS = {
  TOKEN: 'terminal_auth_token',
  USER: 'terminal_auth_user',
  EXPIRES_AT: 'terminal_auth_expires',
} as const;
