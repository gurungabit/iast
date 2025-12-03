// ============================================================================
// Auth Service - API calls for authentication
// ============================================================================

import { config } from '../config';
import type { AuthUser } from '../types';
import type { 
  LoginRequest, 
  RegisterRequest, 
  ApiResponse,
  AuthResponse 
} from '@terminal/shared';
import {
  getStoredToken,
  setStoredToken,
  setStoredUser,
  setStoredExpiresAt,
  clearAuthStorage,
} from '../utils/storage';

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${config.apiBaseUrl}${endpoint}`;
  const token = getStoredToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data: unknown = await response.json();
  return data as ApiResponse<T>;
}

export async function login(request: LoginRequest): Promise<ApiResponse<AuthResponse>> {
  const result = await apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(request),
  });

  if (result.success) {
    const { token, user, expiresAt } = result.data;
    setStoredToken(token);
    setStoredUser({ id: user.id, email: user.email });
    setStoredExpiresAt(expiresAt);
  }

  return result;
}

export async function register(request: RegisterRequest): Promise<ApiResponse<AuthResponse>> {
  const result = await apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(request),
  });

  if (result.success) {
    const { token, user, expiresAt } = result.data;
    setStoredToken(token);
    setStoredUser({ id: user.id, email: user.email });
    setStoredExpiresAt(expiresAt);
  }

  return result;
}

export async function refreshToken(): Promise<ApiResponse<{ token: string; expiresAt: number }>> {
  const currentToken = getStoredToken();
  if (!currentToken) {
    return {
      success: false,
      error: {
        code: 'E1001',
        message: 'No token to refresh',
        timestamp: Date.now(),
      },
    };
  }

  const result = await apiRequest<{ token: string; expiresAt: number }>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ token: currentToken }),
  });

  if (result.success) {
    setStoredToken(result.data.token);
    setStoredExpiresAt(result.data.expiresAt);
  }

  return result;
}

export async function logout(): Promise<void> {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } catch {
    // Ignore errors, clear storage anyway
  }
  clearAuthStorage();
}

export async function getCurrentUser(): Promise<ApiResponse<AuthUser>> {
  return apiRequest<AuthUser>('/auth/me');
}

export async function validateToken(): Promise<boolean> {
  const token = getStoredToken();
  if (!token) return false;

  const result = await getCurrentUser();
  return result.success;
}
