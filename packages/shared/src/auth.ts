// ============================================================================
// Auth Types
// ============================================================================

export interface User {
  id: string;
  email: string;
  name?: string;
  tenantId?: string;
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

// Entra access token (JWT) claims we care about
export interface EntraTokenClaims {
  sub: string;
  oid?: string;
  tid?: string;
  aud: string | string[];
  scp?: string;
  preferred_username?: string;
  name?: string;
  iat?: number;
  exp?: number;
}

// ============================================================================
// Auth Request/Response Types
// ============================================================================

