// ============================================================================
// WebSocket Service - TN3270 Terminal Communication
// ============================================================================

import { config } from '../config';
import type { ConnectionStatus } from '../types';
import {
  type MessageEnvelope,
  createDataMessage,
  createPingMessage,
  createSessionCreateMessage,
  createSessionDestroyMessage,
  serializeMessage,
  deserializeMessage,
} from '@terminal/shared';
import { getStoredToken } from '../utils/storage';

export type WebSocketEventHandler = {
  onMessage: (message: MessageEnvelope) => void;
  onStatusChange: (status: ConnectionStatus) => void;
  onError: (error: Error) => void;
};

export class TerminalWebSocket {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private handlers: WebSocketEventHandler;
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private isClosing = false;
  private seq = 0;

  constructor(sessionId: string, handlers: WebSocketEventHandler) {
    this.sessionId = sessionId;
    this.handlers = handlers;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isClosing = false;
    this.handlers.onStatusChange('connecting');

    const token = getStoredToken();
    const params = new URLSearchParams();
    if (token) params.set('token', token);
    const queryString = params.toString();
    const url = `${config.wsBaseUrl}/terminal/${this.sessionId}${queryString ? `?${queryString}` : ''}`;

    try {
      this.ws = new WebSocket(url);
      this.setupEventListeners();
    } catch (error) {
      this.handlers.onError(
        error instanceof Error ? error : new Error('Failed to create WebSocket')
      );
      this.handlers.onStatusChange('error');
      this.scheduleReconnect();
    }
  }

  private setupEventListeners(): void {
    if (!this.ws) return;

    this.ws.onopen = (): void => {
      this.reconnectAttempts = 0;
      this.handlers.onStatusChange('connected');
      this.startHeartbeat();

      // Send session create message for TN3270 terminal
      const createMsg = createSessionCreateMessage(this.sessionId, {
        terminalType: 'tn3270',
        cols: 80,
        rows: 43,
      });
      this.sendRaw(serializeMessage(createMsg));
    };

    this.ws.onmessage = (event: MessageEvent<string>): void => {
      try {
        const message = deserializeMessage(event.data);
        this.handlers.onMessage(message);
      } catch (error) {
        this.handlers.onError(
          error instanceof Error ? error : new Error('Failed to parse message')
        );
      }
    };

    this.ws.onerror = (): void => {
      this.handlers.onError(new Error('WebSocket error'));
      this.handlers.onStatusChange('error');
    };

    this.ws.onclose = (): void => {
      this.stopHeartbeat();

      if (!this.isClosing) {
        this.handlers.onStatusChange('reconnecting');
        this.scheduleReconnect();
      } else {
        this.handlers.onStatusChange('disconnected');
      }
    };
  }

  private scheduleReconnect(): void {
    if (this.isClosing) return;
    if (this.reconnectAttempts >= config.reconnect.maxAttempts) {
      this.handlers.onStatusChange('error');
      this.handlers.onError(new Error('Max reconnection attempts reached'));
      return;
    }

    const delay = Math.min(
      config.reconnect.initialDelayMs * Math.pow(config.reconnect.backoffMultiplier, this.reconnectAttempts),
      config.reconnect.maxDelayMs
    );

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        const pingMsg = createPingMessage(this.sessionId);
        this.sendRaw(serializeMessage(pingMsg));
      }
    }, config.heartbeat.intervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private sendRaw(data: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  sendData(data: string): void {
    const message = createDataMessage(this.sessionId, data);
    message.seq = ++this.seq;
    this.sendRaw(serializeMessage(message));
  }

  disconnect(): void {
    this.isClosing = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.stopHeartbeat();

    if (this.ws?.readyState === WebSocket.OPEN) {
      const destroyMsg = createSessionDestroyMessage(this.sessionId);
      this.sendRaw(serializeMessage(destroyMsg));
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.handlers.onStatusChange('disconnected');
  }

  getSessionId(): string {
    return this.sessionId;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export function createTerminalWebSocket(
  sessionId: string,
  handlers: WebSocketEventHandler
): TerminalWebSocket {
  return new TerminalWebSocket(sessionId, handlers);
}
