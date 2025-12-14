// ============================================================================
// useTerminal Hook - TN3270 xterm.js Integration
// ============================================================================
//
// This hook manages the xterm.js terminal instance and connects it to the
// global session store. The WebSocket connection is managed by the store,
// so the terminal can be unmounted and remounted without losing connection.
// ============================================================================

import { useRef, useEffect, useCallback, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { config } from '../config';
import type { ConnectionStatus, TerminalDimensions } from '../types';
import type { TN3270Field, ASTStatusMeta, ASTProgressMeta, ASTItemResultMeta } from '@terminal/shared';
import { useSessionStore, useSession, useSessionStatus, useSessionFields, useSessionCursor } from '../stores/sessionStore';

export interface UseTerminalOptions {
  sessionId: string;
  autoConnect?: boolean;
  /** Disable terminal input (e.g., when AST is running) */
  inputDisabled?: boolean;
  /** Callback when AST status is received */
  onASTStatus?: (status: ASTStatusMeta) => void;
  /** Callback when AST progress is received */
  onASTProgress?: (progress: ASTProgressMeta) => void;
  /** Callback when AST item result is received */
  onASTItemResult?: (itemResult: ASTItemResultMeta) => void;
  /** Callback when AST paused state changes */
  onASTPaused?: (isPaused: boolean) => void;
}

export interface UseTerminalReturn {
  terminalRef: React.RefObject<HTMLDivElement | null>;
  status: ConnectionStatus;
  dimensions: TerminalDimensions;
  sessionId: string;
  /** TN3270 field map */
  fields: TN3270Field[];
  /** TN3270 cursor position */
  cursorPosition: { row: number; col: number };
  /** Whether the TN3270 session has expired */
  isExpired: boolean;
  connect: () => void;
  disconnect: () => void;
  /** Disconnect and destroy the TN3270 session on the backend */
  destroySession: () => void;
  /** Reset expired state and create a new session */
  resetExpired: () => void;
  write: (data: string) => void;
  sendKey: (key: string) => void;
  resize: (cols: number, rows: number) => void;
  clear: () => void;
  focus: () => void;
  /** Move cursor to position */
  moveCursor: (row: number, col: number) => void;
  /** Check if a position is in an input field */
  isInputPosition: (row: number, col: number) => boolean;
  /** Run an AST (Automated Streamlined Transaction) */
  runAST: (astName: string, params?: Record<string, unknown>) => void;
  /** Pause the currently running AST */
  pauseAST: () => void;
  /** Resume the paused AST */
  resumeAST: () => void;
  /** Cancel the currently running AST */
  cancelAST: () => void;
}

// TN3270 uses fixed 80x43 (IBM-3278-4-E)
const FIXED_COLS = 80;
const FIXED_ROWS = 43;

export function useTerminal(options: UseTerminalOptions): UseTerminalReturn {
  const { sessionId, autoConnect = true, inputDisabled = false, onASTStatus, onASTProgress, onASTItemResult, onASTPaused } = options;

  const terminalRef = useRef<HTMLDivElement | null>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const inputDisabledRef = useRef(inputDisabled);
  const lastBufferLengthRef = useRef(0);

  // Keep inputDisabled ref in sync
  useEffect(() => {
    inputDisabledRef.current = inputDisabled;
  }, [inputDisabled]);

  // Get store actions
  const connect = useSessionStore((state) => state.connect);
  const disconnect = useSessionStore((state) => state.disconnect);
  const destroySessionAction = useSessionStore((state) => state.destroySession);
  const initSession = useSessionStore((state) => state.initSession);
  const resetExpiredAction = useSessionStore((state) => state.resetExpired);
  const sendKeyAction = useSessionStore((state) => state.sendKey);
  const runASTAction = useSessionStore((state) => state.runAST);
  const pauseASTAction = useSessionStore((state) => state.pauseAST);
  const resumeASTAction = useSessionStore((state) => state.resumeAST);
  const cancelASTAction = useSessionStore((state) => state.cancelAST);
  const setASTStatusCallback = useSessionStore((state) => state.setASTStatusCallback);
  const setASTProgressCallback = useSessionStore((state) => state.setASTProgressCallback);
  const setASTItemResultCallback = useSessionStore((state) => state.setASTItemResultCallback);
  const setASTPausedCallback = useSessionStore((state) => state.setASTPausedCallback);

  // Get session state from store
  const session = useSession(sessionId);
  const status = useSessionStatus(sessionId);
  const fields = useSessionFields(sessionId);
  const cursorPosition = useSessionCursor(sessionId);
  void cursorPosition; // Used for reactivity but we use localCursorPosition for UI

  const [dimensions, setDimensions] = useState<TerminalDimensions>({
    cols: FIXED_COLS,
    rows: FIXED_ROWS,
  });

  // Local cursor state for click handling
  const [localCursorPosition, setLocalCursorPosition] = useState<{ row: number; col: number }>({ row: 0, col: 0 });
  const fieldsRef = useRef<TN3270Field[]>([]);

  // Sync fields ref
  useEffect(() => {
    fieldsRef.current = fields;
  }, [fields]);

  // Register AST callbacks with the store
  useEffect(() => {
    if (onASTStatus) {
      setASTStatusCallback((sid, s) => {
        if (sid === sessionId) onASTStatus(s);
      });
    }
    if (onASTProgress) {
      setASTProgressCallback((sid, p) => {
        if (sid === sessionId) onASTProgress(p);
      });
    }
    if (onASTItemResult) {
      setASTItemResultCallback((sid, r) => {
        if (sid === sessionId) onASTItemResult(r);
      });
    }
    if (onASTPaused) {
      setASTPausedCallback((sid, paused) => {
        if (sid === sessionId) onASTPaused(paused);
      });
    }

    return () => {
      // Don't clear callbacks on unmount - other sessions may need them
    };
  }, [sessionId, onASTStatus, onASTProgress, onASTItemResult, onASTPaused, setASTStatusCallback, setASTProgressCallback, setASTItemResultCallback, setASTPausedCallback]);

  // Check if a position is in an unprotected (input) field
  const isInputPosition = useCallback((row: number, col: number): boolean => {
    const currentFields = fieldsRef.current;
    if (currentFields.length === 0) return false;

    const addr = row * FIXED_COLS + col;

    for (const field of currentFields) {
      if (field.end > field.start) {
        if (addr >= field.start && addr < field.end) {
          return !field.protected;
        }
      } else {
        if (addr >= field.start || addr < field.end) {
          return !field.protected;
        }
      }
    }

    return false;
  }, []);

  // Initialize and connect session
  useEffect(() => {
    initSession(sessionId);

    if (autoConnect) {
      connect(sessionId);
    }

    // Don't disconnect on unmount - connection persists
  }, [sessionId, autoConnect, initSession, connect]);

  // Listen to screen buffer changes and write to terminal
  useEffect(() => {
    if (!terminalInstance.current || !session) return;

    const buffer = session.screenBuffer;

    // Write any new content since last render
    for (let i = lastBufferLengthRef.current; i < buffer.length; i++) {
      terminalInstance.current.write(buffer[i]);
    }

    lastBufferLengthRef.current = buffer.length;
  }, [session?.screenBuffer]);

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current || terminalInstance.current) return;

    const terminal = new Terminal({
      cursorBlink: config.terminal.cursorBlink,
      fontSize: config.terminal.fontSize,
      fontFamily: config.terminal.fontFamily,
      scrollback: 0,
      cols: FIXED_COLS,
      rows: FIXED_ROWS,
      theme: {
        background: '#0a0a0c',
        foreground: '#e4e4e7',
        cursor: '#a1a1aa',
        selectionBackground: '#3f3f46',
        black: '#09090b',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#f4f4f5',
        brightBlack: '#52525b',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#fafafa',
      },
    });

    const fit = new FitAddon();
    const webLinks = new WebLinksAddon();

    terminal.loadAddon(fit);
    terminal.loadAddon(webLinks);

    terminal.open(terminalRef.current);

    terminalInstance.current = terminal;
    fitAddon.current = fit;

    // Replay existing screen buffer if any
    const existingSession = useSessionStore.getState().sessions[sessionId];
    if (existingSession?.screenBuffer) {
      for (const content of existingSession.screenBuffer) {
        terminal.write(content);
      }
      lastBufferLengthRef.current = existingSession.screenBuffer.length;
    }

    // Handle user input - send to store
    terminal.onData((data: string): void => {
      if (inputDisabledRef.current) return;
      sendKeyAction(sessionId, data);
    });

    // Track cursor position
    const cursorInterval = setInterval(() => {
      if (terminalInstance.current) {
        const row = terminalInstance.current.buffer.active.cursorY;
        const col = terminalInstance.current.buffer.active.cursorX;
        setLocalCursorPosition(prev => {
          if (prev.row !== row || prev.col !== col) {
            return { row, col };
          }
          return prev;
        });
      }
    }, 50);

    // Click handler
    let clickHandler: ((e: Event) => void) | null = null;
    let viewportElement: Element | null = null;

    setTimeout(() => {
      viewportElement = terminalRef.current?.querySelector('.xterm-screen') ?? null;
      if (viewportElement) {
        clickHandler = (e: Event): void => {
          if (!terminalInstance.current || !viewportElement) return;
          const mouseEvent = e as MouseEvent;

          const rect = viewportElement.getBoundingClientRect();
          const cellWidth = rect.width / FIXED_COLS;
          const cellHeight = rect.height / FIXED_ROWS;

          const col = Math.floor((mouseEvent.clientX - rect.left) / cellWidth);
          const row = Math.floor((mouseEvent.clientY - rect.top) / cellHeight);

          const clampedCol = Math.max(0, Math.min(col, FIXED_COLS - 1));
          const clampedRow = Math.max(0, Math.min(row, FIXED_ROWS - 1));

          terminalInstance.current.write(`\x1b[${clampedRow + 1};${clampedCol + 1}H`);
          setLocalCursorPosition({ row: clampedRow, col: clampedCol });
        };

        viewportElement.addEventListener('mousedown', clickHandler);
      }
    }, 100);

    return (): void => {
      clearInterval(cursorInterval);
      if (clickHandler && viewportElement) {
        viewportElement.removeEventListener('mousedown', clickHandler);
      }
      terminal.dispose();
      terminalInstance.current = null;
      fitAddon.current = null;
      lastBufferLengthRef.current = 0;
    };
  }, [sessionId, sendKeyAction]);

  const handleConnect = useCallback((): void => {
    connect(sessionId);
  }, [connect, sessionId]);

  const handleDisconnect = useCallback((): void => {
    disconnect(sessionId);
  }, [disconnect, sessionId]);

  const handleDestroySession = useCallback((): void => {
    destroySessionAction(sessionId);
  }, [destroySessionAction, sessionId]);

  const write = useCallback((data: string): void => {
    terminalInstance.current?.write(data);
  }, []);

  const sendKey = useCallback((key: string): void => {
    if (inputDisabledRef.current) return;
    sendKeyAction(sessionId, key);
  }, [sendKeyAction, sessionId]);

  const resize = useCallback((cols: number, rows: number): void => {
    if (terminalInstance.current) {
      terminalInstance.current.resize(cols, rows);
      setDimensions({ cols, rows });
    }
  }, []);

  const clear = useCallback((): void => {
    terminalInstance.current?.clear();
  }, []);

  const focus = useCallback((): void => {
    terminalInstance.current?.focus();
  }, []);

  const moveCursor = useCallback((row: number, col: number): void => {
    if (!terminalInstance.current) return;
    terminalInstance.current.write(`\x1b[${row + 1};${col + 1}H`);
    setLocalCursorPosition({ row, col });
  }, []);

  const runAST = useCallback((astName: string, params?: Record<string, unknown>): void => {
    runASTAction(sessionId, astName, params);
  }, [runASTAction, sessionId]);

  const pauseAST = useCallback((): void => {
    pauseASTAction(sessionId);
  }, [pauseASTAction, sessionId]);

  const resumeAST = useCallback((): void => {
    resumeASTAction(sessionId);
  }, [resumeASTAction, sessionId]);

  const cancelAST = useCallback((): void => {
    cancelASTAction(sessionId);
  }, [cancelASTAction, sessionId]);
  // Create a new session after expiry
  const handleResetExpired = useCallback((): void => {
    resetExpiredAction(sessionId);
    // Reconnect will create a new session
    connect(sessionId);
  }, [resetExpiredAction, connect, sessionId]);

  return {
    terminalRef,
    status,
    dimensions,
    sessionId,
    fields,
    cursorPosition: localCursorPosition,
    isExpired: session?.isExpired ?? false,
    connect: handleConnect,
    disconnect: handleDisconnect,
    destroySession: handleDestroySession,
    resetExpired: handleResetExpired,
    write,
    sendKey,
    resize,
    clear,
    focus,
    moveCursor,
    isInputPosition,
    runAST,
    pauseAST,
    resumeAST,
    cancelAST,
  };
}
