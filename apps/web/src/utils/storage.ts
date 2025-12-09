// ============================================================================
// Storage Utilities - Session helpers
// ============================================================================

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
