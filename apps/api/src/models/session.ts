// ============================================================================
// Session Model - Terminal session tracking
// ============================================================================

export interface TerminalSession {
  id: string;
  userId: string;
  createdAt: number;
  lastActivityAt: number;
  status: 'active' | 'closed';
}

// In-memory session store
const sessions = new Map<string, TerminalSession>();
const userSessions = new Map<string, Set<string>>(); // userId -> Set<sessionId>

export function createSession(sessionId: string, userId: string): TerminalSession {
  const now = Date.now();
  const session: TerminalSession = {
    id: sessionId,
    userId,
    createdAt: now,
    lastActivityAt: now,
    status: 'active',
  };

  sessions.set(sessionId, session);

  // Track sessions per user
  let userSessionSet = userSessions.get(userId);
  if (!userSessionSet) {
    userSessionSet = new Set();
    userSessions.set(userId, userSessionSet);
  }
  userSessionSet.add(sessionId);

  return session;
}

export function findSession(sessionId: string): TerminalSession | null {
  return sessions.get(sessionId) ?? null;
}

export function updateSessionActivity(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.lastActivityAt = Date.now();
  }
}

export function closeSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.status = 'closed';
    const userSessionSet = userSessions.get(session.userId);
    if (userSessionSet) {
      userSessionSet.delete(sessionId);
    }
  }
}

export function getUserSessions(userId: string): TerminalSession[] {
  const sessionIds = userSessions.get(userId);
  if (!sessionIds) return [];

  return Array.from(sessionIds)
    .map((id) => sessions.get(id))
    .filter((s): s is TerminalSession => s !== undefined && s.status === 'active');
}

export function getActiveSessionCount(userId: string): number {
  return getUserSessions(userId).length;
}

export function sessionBelongsToUser(sessionId: string, userId: string): boolean {
  const session = sessions.get(sessionId);
  return session?.userId === userId;
}
