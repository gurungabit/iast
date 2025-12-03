// ============================================================================
// Storage Utilities - Persistent Auth
// ============================================================================

import type { AuthUser } from '../types';
import { config } from '../config';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(config.auth.tokenStorageKey);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string): void {
  try {
    localStorage.setItem(config.auth.tokenStorageKey, token);
  } catch {
    console.error('Failed to store token');
  }
}

export function removeStoredToken(): void {
  try {
    localStorage.removeItem(config.auth.tokenStorageKey);
  } catch {
    console.error('Failed to remove token');
  }
}

export function getStoredUser(): AuthUser | null {
  try {
    const data = localStorage.getItem(config.auth.userStorageKey);
    if (!data) return null;
    return JSON.parse(data) as AuthUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthUser): void {
  try {
    localStorage.setItem(config.auth.userStorageKey, JSON.stringify(user));
  } catch {
    console.error('Failed to store user');
  }
}

export function removeStoredUser(): void {
  try {
    localStorage.removeItem(config.auth.userStorageKey);
  } catch {
    console.error('Failed to remove user');
  }
}

export function getStoredExpiresAt(): number | null {
  try {
    const data = localStorage.getItem(config.auth.expiresAtStorageKey);
    if (!data) return null;
    const parsed = parseInt(data, 10);
    return isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

export function setStoredExpiresAt(expiresAt: number): void {
  try {
    localStorage.setItem(config.auth.expiresAtStorageKey, expiresAt.toString());
  } catch {
    console.error('Failed to store expiration');
  }
}

export function removeStoredExpiresAt(): void {
  try {
    localStorage.removeItem(config.auth.expiresAtStorageKey);
  } catch {
    console.error('Failed to remove expiration');
  }
}

export function clearAuthStorage(): void {
  removeStoredToken();
  removeStoredUser();
  removeStoredExpiresAt();
}

export function isTokenExpired(): boolean {
  const expiresAt = getStoredExpiresAt();
  if (!expiresAt) return true;
  // Consider token expired 5 minutes before actual expiration
  return Date.now() >= expiresAt - 5 * 60 * 1000;
}

export function getStoredSessionId(): string | null {
  try {
    return sessionStorage.getItem('terminal_session_id');
  } catch {
    return null;
  }
}

export function setStoredSessionId(sessionId: string): void {
  try {
    sessionStorage.setItem('terminal_session_id', sessionId);
  } catch {
    console.error('Failed to store session ID');
  }
}

export function removeStoredSessionId(): void {
  try {
    sessionStorage.removeItem('terminal_session_id');
  } catch {
    console.error('Failed to remove session ID');
  }
}
