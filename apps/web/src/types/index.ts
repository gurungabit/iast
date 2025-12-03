// ============================================================================
// Frontend Types
// ============================================================================

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface TerminalSession {
  id: string;
  createdAt: number;
  status: ConnectionStatus;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  token: string | null;
  expiresAt: number | null;
  isLoading: boolean;
  error: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface TerminalDimensions {
  cols: number;
  rows: number;
}

export interface WebSocketMessage {
  type: string;
  data: unknown;
}

// Re-export shared types for convenience
export type {
  MessageEnvelope,
  DataMessage,
  ResizeMessage,
  ErrorMessage,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  User,
} from '@terminal/shared';
