// ============================================================================
// useTerminal Hook - xterm.js Integration
// ============================================================================

import { useRef, useEffect, useCallback, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { config } from '../config';
import type { ConnectionStatus, TerminalDimensions } from '../types';
import {
  createTerminalWebSocket,
  type TerminalWebSocket,
} from '../services/websocket';
import {
  type MessageEnvelope,
  isDataMessage,
  isErrorMessage,
  isSessionCreatedMessage,
  isSessionDestroyedMessage,
  isPongMessage,
} from '@terminal/shared';
import { generateSessionId } from '@terminal/shared';
import {
  getStoredSessionId,
  setStoredSessionId,
} from '../utils/storage';

export interface UseTerminalOptions {
  sessionId?: string;
  autoConnect?: boolean;
}

export interface UseTerminalReturn {
  terminalRef: React.RefObject<HTMLDivElement | null>;
  status: ConnectionStatus;
  dimensions: TerminalDimensions;
  sessionId: string;
  connect: () => void;
  disconnect: () => void;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  clear: () => void;
  focus: () => void;
}

export function useTerminal(options: UseTerminalOptions = {}): UseTerminalReturn {
  const { autoConnect = true } = options;

  const terminalRef = useRef<HTMLDivElement | null>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const wsRef = useRef<TerminalWebSocket | null>(null);

  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [dimensions, setDimensions] = useState<TerminalDimensions>({
    cols: config.terminal.defaultCols,
    rows: config.terminal.defaultRows,
  });

  // Get or create session ID
  const [sessionId] = useState<string>(() => {
    if (options.sessionId) return options.sessionId;
    const stored = getStoredSessionId();
    if (stored) return stored;
    const newId = generateSessionId();
    setStoredSessionId(newId);
    return newId;
  });

  // Handle incoming messages
  const handleMessage = useCallback((message: MessageEnvelope): void => {
    if (!terminalInstance.current) return;

    if (isDataMessage(message)) {
      terminalInstance.current.write(message.payload);
    } else if (isErrorMessage(message)) {
      terminalInstance.current.write(`\r\n\x1b[31mError: ${message.payload}\x1b[0m\r\n`);
    } else if (isSessionCreatedMessage(message)) {
      terminalInstance.current.write(`\r\n\x1b[32mSession started (shell: ${message.meta.shell})\x1b[0m\r\n`);
    } else if (isSessionDestroyedMessage(message)) {
      terminalInstance.current.write(`\r\n\x1b[33mSession ended\x1b[0m\r\n`);
    } else if (isPongMessage(message)) {
      // Heartbeat response, ignore
    }
  }, []);

  // Handle status changes
  const handleStatusChange = useCallback((newStatus: ConnectionStatus): void => {
    setStatus(newStatus);
  }, []);

  // Handle errors - only show persistent errors, not transient connection issues
  const handleError = useCallback((error: Error): void => {
    console.error('Terminal WebSocket error:', error);
    // Only show error in terminal if it's a permanent failure (max reconnects reached)
    // Transient "WebSocket error" messages during reconnection are not shown
    if (terminalInstance.current && error.message !== 'WebSocket error') {
      terminalInstance.current.write(`\r\n\x1b[31mConnection error: ${error.message}\x1b[0m\r\n`);
    }
  }, []);

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current || terminalInstance.current) return;

    const terminal = new Terminal({
      cursorBlink: config.terminal.cursorBlink,
      fontSize: config.terminal.fontSize,
      fontFamily: config.terminal.fontFamily,
      scrollback: config.terminal.scrollback,
      cols: config.terminal.defaultCols,
      rows: config.terminal.defaultRows,
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
    fit.fit();

    terminalInstance.current = terminal;
    fitAddon.current = fit;

    // Handle user input
    terminal.onData((data: string): void => {
      wsRef.current?.sendData(data);
    });

    // Handle resize
    const handleResize = (): void => {
      if (fitAddon.current) {
        fitAddon.current.fit();
        if (terminalInstance.current) {
          const newDims = {
            cols: terminalInstance.current.cols,
            rows: terminalInstance.current.rows,
          };
          setDimensions(newDims);
          wsRef.current?.sendResize(newDims.cols, newDims.rows);
        }
      }
    };

    window.addEventListener('resize', handleResize);

    // Create WebSocket connection
    wsRef.current = createTerminalWebSocket(sessionId, {
      onMessage: handleMessage,
      onStatusChange: handleStatusChange,
      onError: handleError,
    });

    if (autoConnect) {
      wsRef.current.connect();
    }

    return (): void => {
      window.removeEventListener('resize', handleResize);
      wsRef.current?.disconnect();
      terminal.dispose();
      terminalInstance.current = null;
      fitAddon.current = null;
    };
  }, [sessionId, autoConnect, handleMessage, handleStatusChange, handleError]);

  const connect = useCallback((): void => {
    wsRef.current?.connect();
  }, []);

  const disconnect = useCallback((): void => {
    wsRef.current?.disconnect();
  }, []);

  const write = useCallback((data: string): void => {
    terminalInstance.current?.write(data);
  }, []);

  const resize = useCallback((cols: number, rows: number): void => {
    if (terminalInstance.current) {
      terminalInstance.current.resize(cols, rows);
      setDimensions({ cols, rows });
      wsRef.current?.sendResize(cols, rows);
    }
  }, []);

  const clear = useCallback((): void => {
    terminalInstance.current?.clear();
  }, []);

  const focus = useCallback((): void => {
    terminalInstance.current?.focus();
  }, []);

  return {
    terminalRef,
    status,
    dimensions,
    sessionId,
    connect,
    disconnect,
    write,
    resize,
    clear,
    focus,
  };
}
