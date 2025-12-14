// ============================================================================
// useExecutionObserver - Hook for observing running executions
// ============================================================================
//
// This hook observes AST execution progress by subscribing to the global
// session store's WebSocket connection. It does NOT create its own WebSocket.
// ============================================================================

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  type ASTProgressMeta,
  type ASTStatusMeta,
  type ASTControlAction,
} from '@terminal/shared';
import { useSessionStore, useSessionStatus } from '../stores/sessionStore';

export type ObserverStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface PolicyResult {
  itemId: string;
  status: 'success' | 'failed' | 'skipped';
  durationMs?: number;
  error?: string;
  data?: Record<string, unknown>;
}

interface InternalState {
  progress: ASTProgressMeta | null;
  policyResults: PolicyResult[];
  astStatus: ASTStatusMeta | null;
  isPaused: boolean;
  error: string | null;
}

export interface ExecutionObserverState {
  status: ObserverStatus;
  progress: ASTProgressMeta | null;
  policyResults: PolicyResult[];
  astStatus: ASTStatusMeta | null;
  isPaused: boolean;
  error: string | null;
}

interface UseExecutionObserverOptions {
  sessionId: string | null;
  executionId: string;
  enabled?: boolean;
  /** Initial paused state from execution record (e.g., when reconnecting) */
  initialPaused?: boolean;
}

/**
 * Hook to observe a running AST execution.
 * 
 * IMPORTANT: This hook now uses the global sessionStore's WebSocket connection
 * instead of creating its own. This prevents connection conflicts when navigating
 * between pages.
 */
export function useExecutionObserver({
  sessionId,
  executionId,
  enabled = true,
  initialPaused = false,
}: UseExecutionObserverOptions): ExecutionObserverState & {
  disconnect: () => void;
  sendControl: (action: ASTControlAction) => void;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
} {
  // Internal state for AST updates (excluding status which is derived)
  const [internalState, setInternalState] = useState<InternalState>({
    progress: null,
    policyResults: [],
    astStatus: null,
    isPaused: initialPaused,
    error: null,
  });

  const mountedRef = useRef(true);
  const prevExecutionIdRef = useRef(executionId);

  // Get store actions
  const connect = useSessionStore((s) => s.connect);
  const initSession = useSessionStore((s) => s.initSession);
  const pauseAST = useSessionStore((s) => s.pauseAST);
  const resumeAST = useSessionStore((s) => s.resumeAST);
  const cancelAST = useSessionStore((s) => s.cancelAST);
  const setASTStatusCallback = useSessionStore((s) => s.setASTStatusCallback);
  const setASTProgressCallback = useSessionStore((s) => s.setASTProgressCallback);
  const setASTItemResultCallback = useSessionStore((s) => s.setASTItemResultCallback);
  const setASTPausedCallback = useSessionStore((s) => s.setASTPausedCallback);

  // Get connection status from store
  const sessionStatus = useSessionStatus(sessionId || '');

  // Derive observer status from session status (not in an effect)
  const status: ObserverStatus = useMemo(() => {
    if (!sessionId || !enabled) {
      return 'disconnected';
    }

    switch (sessionStatus) {
      case 'connected':
        return 'connected';
      case 'connecting':
      case 'reconnecting':
        return 'connecting';
      case 'error':
        return 'error';
      default:
        return 'disconnected';
    }
  }, [sessionId, enabled, sessionStatus]);

  // Reset internal state when execution changes
  // This is an intentional state reset when the execution ID changes - it's a valid pattern
  useEffect(() => {
    if (prevExecutionIdRef.current !== executionId) {
      prevExecutionIdRef.current = executionId;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional reset when executionId changes
      setInternalState({
        progress: null,
        policyResults: [],
        astStatus: null,
        isPaused: initialPaused,
        error: null,
      });
    }
  }, [executionId, initialPaused]);

  // Track mounted state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Subscribe to AST callbacks from the store
  useEffect(() => {
    if (!enabled || !sessionId) {
      return;
    }

    // Initialize and connect the session (reuses existing connection)
    initSession(sessionId);
    connect(sessionId);

    // Set up callbacks to receive AST updates
    setASTStatusCallback((sid, astStatus) => {
      if (sid === sessionId && mountedRef.current) {
        setInternalState(prev => ({ ...prev, astStatus }));
      }
    });

    setASTProgressCallback((sid, progress) => {
      if (sid === sessionId && progress.executionId === executionId && mountedRef.current) {
        setInternalState(prev => {
          // Handle -1 sentinel values (indicates message-only update)
          // Preserve previous current/total when receiving -1
          const mergedProgress = progress.current === -1 && progress.total === -1
            ? {
              ...prev.progress,
              ...progress,
              current: prev.progress?.current ?? 0,
              total: prev.progress?.total ?? 0,
              percent: prev.progress?.percent ?? 0,
            }
            : progress;
          return { ...prev, progress: mergedProgress };
        });
      }
    });

    setASTItemResultCallback((sid, result) => {
      if (sid === sessionId && result.executionId === executionId && mountedRef.current) {
        const policyResult: PolicyResult = {
          itemId: result.itemId,
          status: result.status,
          durationMs: result.durationMs,
          error: result.error,
          data: result.data,
        };
        setInternalState(prev => ({
          ...prev,
          policyResults: [...prev.policyResults, policyResult],
        }));
      }
    });

    setASTPausedCallback((sid, paused) => {
      if (sid === sessionId && mountedRef.current) {
        setInternalState(prev => ({ ...prev, isPaused: paused }));
      }
    });

    // Note: We do NOT disconnect on cleanup - the connection is managed by sessionStore
    // and should persist across route changes
  }, [sessionId, executionId, enabled, initSession, connect, setASTStatusCallback, setASTProgressCallback, setASTItemResultCallback, setASTPausedCallback]);

  // Control actions - use store methods
  const sendControl = useCallback((action: ASTControlAction) => {
    if (!sessionId) return;

    switch (action) {
      case 'pause':
        pauseAST(sessionId);
        break;
      case 'resume':
        resumeAST(sessionId);
        break;
      case 'cancel':
        cancelAST(sessionId);
        break;
    }
  }, [sessionId, pauseAST, resumeAST, cancelAST]);

  const pause = useCallback(() => sendControl('pause'), [sendControl]);
  const resume = useCallback(() => sendControl('resume'), [sendControl]);
  const cancel = useCallback(() => sendControl('cancel'), [sendControl]);

  // disconnect is now a no-op - we don't want observers to disconnect the shared WebSocket
  const disconnect = useCallback(() => {
    // No-op: Connection is managed by sessionStore
  }, []);

  // Combine derived status with internal state for return value
  return {
    status,
    ...internalState,
    disconnect,
    sendControl,
    pause,
    resume,
    cancel,
  };
}
