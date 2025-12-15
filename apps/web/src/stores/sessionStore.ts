// ============================================================================
// Session Store - Zustand store for WebSocket and terminal session management
// ============================================================================
//
// This store manages WebSocket connections globally so they persist across
// route changes. The terminal screen buffer is stored here, allowing the
// Terminal component to be unmounted/remounted without losing connection.
// ============================================================================

import { create } from 'zustand';
import type { ConnectionStatus } from '../types';
import {
    type MessageEnvelope,
    type TN3270Field,
    type ASTStatusMeta,
    type ASTProgressMeta,
    type ASTItemResultMeta,
    isDataMessage,
    isErrorMessage,
    isSessionCreatedMessage,
    isSessionDestroyedMessage,
    isTN3270ScreenMessage,
    isASTStatusMessage,
    isASTProgressMessage,
    isASTItemResultMessage,
    isASTPausedMessage,
} from '@terminal/shared';
import {
    createTerminalWebSocket,
    type TerminalWebSocket,
} from '../services/websocket';

// ============================================================================
// Types
// ============================================================================

export interface SessionState {
    /** WebSocket connection instance */
    ws: TerminalWebSocket | null;
    /** Connection status */
    status: ConnectionStatus;
    /** Screen buffer - stores raw terminal output for replay on remount */
    screenBuffer: string[];
    /** TN3270 field definitions */
    fields: TN3270Field[];
    /** Current cursor position */
    cursorPosition: { row: number; col: number };
    /** Last error message */
    lastError: string | null;
    /** Whether the session has been initialized (first connect done) */
    initialized: boolean;
}

interface SessionStore {
    /** Active sessions keyed by sessionId */
    sessions: Record<string, SessionState>;

    /** Currently active session ID (for global access) */
    activeSessionId: string | null;

    // -------------------------------------------------------------------------
    // Session Management
    // -------------------------------------------------------------------------

    /** Set the active session */
    setActiveSession: (sessionId: string | null) => void;

    /** Initialize a session (creates state entry, does not connect) */
    initSession: (sessionId: string) => void;

    /** Connect to a session's WebSocket */
    connect: (sessionId: string) => void;

    /** Disconnect a session's WebSocket (keeps state) */
    disconnect: (sessionId: string) => void;

    /** Destroy a session completely (disconnect + clear state) */
    destroySession: (sessionId: string) => void;

    // -------------------------------------------------------------------------
    // Callbacks for AST events (set by components that care about AST updates)
    // -------------------------------------------------------------------------

    /** Callback when AST status changes */
    onASTStatus: ((sessionId: string, status: ASTStatusMeta) => void) | null;
    setASTStatusCallback: (cb: ((sessionId: string, status: ASTStatusMeta) => void) | null) => void;

    /** Callback when AST progress updates */
    onASTProgress: ((sessionId: string, progress: ASTProgressMeta) => void) | null;
    setASTProgressCallback: (cb: ((sessionId: string, progress: ASTProgressMeta) => void) | null) => void;

    /** Callback when AST item result arrives */
    onASTItemResult: ((sessionId: string, result: ASTItemResultMeta) => void) | null;
    setASTItemResultCallback: (cb: ((sessionId: string, result: ASTItemResultMeta) => void) | null) => void;

    /** Callback when AST paused state changes */
    onASTPaused: ((sessionId: string, paused: boolean) => void) | null;
    setASTPausedCallback: (cb: ((sessionId: string, paused: boolean) => void) | null) => void;

    // -------------------------------------------------------------------------
    // Terminal Actions
    // -------------------------------------------------------------------------

    /** Send key/data to terminal */
    sendKey: (sessionId: string, key: string) => void;

    /** Run an AST */
    runAST: (sessionId: string, astName: string, params?: Record<string, unknown>) => void;

    /** Pause AST */
    pauseAST: (sessionId: string) => void;

    /** Resume AST */
    resumeAST: (sessionId: string) => void;

    /** Cancel AST */
    cancelAST: (sessionId: string) => void;

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    /** Handle incoming WebSocket message (internal) */
    _handleMessage: (sessionId: string, message: MessageEnvelope) => void;

    /** Handle status change (internal) */
    _handleStatusChange: (sessionId: string, status: ConnectionStatus) => void;

    /** Handle error (internal) */
    _handleError: (sessionId: string, error: Error) => void;
}

// ============================================================================
// Initial State
// ============================================================================

const createInitialSessionState = (): SessionState => ({
    ws: null,
    status: 'disconnected',
    screenBuffer: [],
    fields: [],
    cursorPosition: { row: 0, col: 0 },
    lastError: null,
    initialized: false,
});

// ============================================================================
// Store
// ============================================================================

export const useSessionStore = create<SessionStore>((set, get) => ({
    sessions: {},
    activeSessionId: null,

    // AST callbacks
    onASTStatus: null,
    onASTProgress: null,
    onASTItemResult: null,
    onASTPaused: null,

    setActiveSession: (sessionId) => {
        set({ activeSessionId: sessionId });
    },

    initSession: (sessionId) => {
        const { sessions } = get();
        if (!sessions[sessionId]) {
            set({
                sessions: {
                    ...sessions,
                    [sessionId]: createInitialSessionState(),
                },
            });
        }
    },

    connect: (sessionId) => {
        const { sessions, _handleMessage, _handleStatusChange, _handleError } = get();
        let session = sessions[sessionId];

        // Create session if it doesn't exist
        if (!session) {
            session = createInitialSessionState();
            set({
                sessions: {
                    ...sessions,
                    [sessionId]: session,
                },
            });
        }

        // Already connected or connecting - check both the ws instance and its actual connection state
        if (session.ws && session.ws.isConnected()) {
            return;
        }

        // If there's a WebSocket instance but it's not connected, it may have been disconnected
        // Don't create a new one if we already have one that's just not connected yet
        if (session.ws) {
            // Reconnect existing WebSocket
            session.ws.connect();
            return;
        }

        // Create WebSocket
        const ws = createTerminalWebSocket(sessionId, {
            onMessage: (message) => _handleMessage(sessionId, message),
            onStatusChange: (status) => _handleStatusChange(sessionId, status),
            onError: (error) => _handleError(sessionId, error),
        });

        // Update state with WebSocket
        set({
            sessions: {
                ...get().sessions,
                [sessionId]: {
                    ...get().sessions[sessionId],
                    ws,
                    status: 'connecting',
                },
            },
        });

        // Connect
        ws.connect();
    },

    disconnect: (sessionId) => {
        const { sessions } = get();
        const session = sessions[sessionId];
        if (!session?.ws) return;

        session.ws.disconnect();

        set({
            sessions: {
                ...sessions,
                [sessionId]: {
                    ...session,
                    ws: null,
                    status: 'disconnected',
                },
            },
        });
    },

    destroySession: (sessionId) => {
        const { sessions } = get();
        const session = sessions[sessionId];

        if (session?.ws) {
            session.ws.disconnect(true); // Send destroy message
        }

        const { [sessionId]: _removed, ...rest } = sessions;
        set({ sessions: rest });
    },

    // AST callback setters
    setASTStatusCallback: (cb) => set({ onASTStatus: cb }),
    setASTProgressCallback: (cb) => set({ onASTProgress: cb }),
    setASTItemResultCallback: (cb) => set({ onASTItemResult: cb }),
    setASTPausedCallback: (cb) => set({ onASTPaused: cb }),

    // Terminal actions
    sendKey: (sessionId, key) => {
        const session = get().sessions[sessionId];
        session?.ws?.sendData(key);
    },

    runAST: (sessionId, astName, params) => {
        const session = get().sessions[sessionId];
        session?.ws?.sendASTRun(astName, params);
    },

    pauseAST: (sessionId) => {
        const session = get().sessions[sessionId];
        session?.ws?.sendASTPause();
    },

    resumeAST: (sessionId) => {
        const session = get().sessions[sessionId];
        session?.ws?.sendASTResume();
    },

    cancelAST: (sessionId) => {
        const session = get().sessions[sessionId];
        session?.ws?.sendASTCancel();
    },

    // Internal handlers
    _handleMessage: (sessionId, message) => {
        const { sessions, onASTStatus, onASTProgress, onASTItemResult, onASTPaused } = get();
        const session = sessions[sessionId];
        if (!session) return;

        // Handle AST messages - call callbacks if registered
        if (isASTStatusMessage(message)) {
            onASTStatus?.(sessionId, message.meta);
            return;
        }
        if (isASTProgressMessage(message)) {
            onASTProgress?.(sessionId, message.meta);
            return;
        }
        if (isASTItemResultMessage(message)) {
            onASTItemResult?.(sessionId, message.meta);
            return;
        }
        if (isASTPausedMessage(message)) {
            onASTPaused?.(sessionId, message.meta.paused);
            return;
        }

        // Handle terminal display messages - store in buffer
        if (isDataMessage(message) || isTN3270ScreenMessage(message)) {
            const updates: Partial<SessionState> = {
                screenBuffer: [...session.screenBuffer, message.payload],
            };

            // TN3270 screen also has field info
            if (isTN3270ScreenMessage(message)) {
                updates.fields = message.meta.fields;
                updates.cursorPosition = {
                    row: message.meta.cursorRow,
                    col: message.meta.cursorCol,
                };
            }

            set({
                sessions: {
                    ...sessions,
                    [sessionId]: {
                        ...session,
                        ...updates,
                        initialized: true,
                    },
                },
            });
        } else if (isErrorMessage(message)) {
            set({
                sessions: {
                    ...sessions,
                    [sessionId]: {
                        ...session,
                        lastError: message.payload,
                        screenBuffer: [...session.screenBuffer, `\r\n\x1b[31mError: ${message.payload}\x1b[0m\r\n`],
                    },
                },
            });
        } else if (isSessionCreatedMessage(message)) {
            // Only add "Session started" on first connect
            if (!session.initialized) {
                set({
                    sessions: {
                        ...sessions,
                        [sessionId]: {
                            ...session,
                            screenBuffer: [...session.screenBuffer, `\r\n\x1b[32mSession started (shell: ${message.meta.shell})\x1b[0m\r\n`],
                            initialized: true,
                        },
                    },
                });
            }
        } else if (isSessionDestroyedMessage(message)) {
            set({
                sessions: {
                    ...sessions,
                    [sessionId]: {
                        ...session,
                        screenBuffer: [...session.screenBuffer, `\r\n\x1b[33mSession ended\x1b[0m\r\n`],
                    },
                },
            });
        }
        // Ignore pong messages
    },

    _handleStatusChange: (sessionId, status) => {
        const { sessions } = get();
        const session = sessions[sessionId];
        if (!session) return;

        set({
            sessions: {
                ...sessions,
                [sessionId]: {
                    ...session,
                    status,
                },
            },
        });
    },

    _handleError: (sessionId, error) => {
        const { sessions } = get();
        const session = sessions[sessionId];
        if (!session) return;

        console.error('Session WebSocket error:', sessionId, error);

        set({
            sessions: {
                ...sessions,
                [sessionId]: {
                    ...session,
                    lastError: error.message,
                },
            },
        });
    },
}));

// ============================================================================
// Selector Hooks
// ============================================================================

// Stable fallback values to prevent infinite re-render loops
const EMPTY_ARRAY: TN3270Field[] = [];
const EMPTY_STRING_ARRAY: string[] = [];
const DEFAULT_CURSOR = { row: 0, col: 0 };

/** Get session state by ID */
export const useSession = (sessionId: string): SessionState | null => {
    return useSessionStore((state) => state.sessions[sessionId] ?? null);
};

/** Get connection status for a session */
export const useSessionStatus = (sessionId: string): ConnectionStatus => {
    return useSessionStore((state) => state.sessions[sessionId]?.status ?? 'disconnected');
};

/** Get screen buffer for a session */
export const useSessionScreenBuffer = (sessionId: string): string[] => {
    return useSessionStore((state) => state.sessions[sessionId]?.screenBuffer ?? EMPTY_STRING_ARRAY);
};

/** Get TN3270 fields for a session */
export const useSessionFields = (sessionId: string): TN3270Field[] => {
    return useSessionStore((state) => state.sessions[sessionId]?.fields ?? EMPTY_ARRAY);
};

/** Get cursor position for a session */
export const useSessionCursor = (sessionId: string): { row: number; col: number } => {
    return useSessionStore((state) => state.sessions[sessionId]?.cursorPosition ?? DEFAULT_CURSOR);
};
