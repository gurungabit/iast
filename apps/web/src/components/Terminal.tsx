// ============================================================================
// Terminal Component
// ============================================================================

import { useEffect } from 'react';
import { useTerminal } from '../hooks/useTerminal';
import type { ConnectionStatus } from '../types';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  sessionId?: string;
  autoConnect?: boolean;
  onStatusChange?: (status: ConnectionStatus) => void;
}

function getStatusColor(status: ConnectionStatus): string {
  switch (status) {
    case 'connected':
      return '#0dbc79';
    case 'connecting':
    case 'reconnecting':
      return '#e5e510';
    case 'error':
      return '#cd3131';
    case 'disconnected':
    default:
      return '#666666';
  }
}

function getStatusText(status: ConnectionStatus): string {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting...';
    case 'reconnecting':
      return 'Reconnecting...';
    case 'error':
      return 'Error';
    case 'disconnected':
    default:
      return 'Disconnected';
  }
}

export function Terminal({ sessionId, autoConnect = true, onStatusChange }: TerminalProps): React.ReactNode {
  const {
    terminalRef,
    status,
    dimensions,
    sessionId: activeSessionId,
    connect,
    disconnect,
    focus,
  } = useTerminal({ sessionId, autoConnect });

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  useEffect(() => {
    // Focus terminal on mount
    focus();
  }, [focus]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--color-dark-bg)' }}>
      {/* Status bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          backgroundColor: 'var(--color-dark-elevated)',
          borderBottom: '1px solid var(--color-border-subtle)',
          fontSize: '12px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: getStatusColor(status),
              }}
            />
            <span style={{ color: '#cccccc' }}>{getStatusText(status)}</span>
          </div>
          <span style={{ color: '#808080' }}>
            {dimensions.cols}×{dimensions.rows}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#808080', fontSize: '11px' }}>
            Session: {activeSessionId.slice(0, 8)}...
          </span>
          {status === 'disconnected' || status === 'error' ? (
            <button
              onClick={connect}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                backgroundColor: '#0e639c',
                color: '#ffffff',
                border: 'none',
                borderRadius: '2px',
                cursor: 'pointer',
              }}
            >
              Connect
            </button>
          ) : status === 'connected' ? (
            <button
              onClick={disconnect}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                backgroundColor: '#5a5a5a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '2px',
                cursor: 'pointer',
              }}
            >
              Disconnect
            </button>
          ) : null}
        </div>
      </div>

      {/* Terminal container */}
      <div
        ref={terminalRef}
        style={{
          flex: 1,
          padding: '4px',
          overflow: 'hidden',
        }}
        onClick={focus}
      />
    </div>
  );
}
