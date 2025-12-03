// ============================================================================
// Message Types - Discriminated Unions
// ============================================================================

export type MessageType =
  | 'data'
  | 'resize'
  | 'ping'
  | 'pong'
  | 'error'
  | 'session.create'
  | 'session.destroy'
  | 'session.created'
  | 'session.destroyed';

export type Encoding = 'utf-8' | 'base64';

// ============================================================================
// Base Message Envelope
// ============================================================================

interface BaseMessageEnvelope {
  sessionId: string;
  timestamp: number;
  encoding: Encoding;
  seq: number;
}

// ============================================================================
// Data Message - Terminal I/O
// ============================================================================

export interface DataMessage extends BaseMessageEnvelope {
  type: 'data';
  payload: string;
  meta?: Record<string, unknown>;
}

// ============================================================================
// Resize Message - Terminal dimensions
// ============================================================================

export interface ResizeMeta {
  cols: number;
  rows: number;
}

export interface ResizeMessage extends BaseMessageEnvelope {
  type: 'resize';
  payload: string;
  meta: ResizeMeta;
}

// ============================================================================
// Ping/Pong Messages - Heartbeat
// ============================================================================

export interface PingMessage extends BaseMessageEnvelope {
  type: 'ping';
  payload: string;
  meta?: Record<string, unknown>;
}

export interface PongMessage extends BaseMessageEnvelope {
  type: 'pong';
  payload: string;
  meta?: Record<string, unknown>;
}

// ============================================================================
// Error Message
// ============================================================================

export interface ErrorMeta {
  code: string;
  details?: Record<string, unknown>;
}

export interface ErrorMessage extends BaseMessageEnvelope {
  type: 'error';
  payload: string;
  meta: ErrorMeta;
}

// ============================================================================
// Session Messages
// ============================================================================

export interface SessionCreateMeta {
  shell?: string;
  cols?: number;
  rows?: number;
  env?: Record<string, string>;
  cwd?: string;
}

export interface SessionCreateMessage extends BaseMessageEnvelope {
  type: 'session.create';
  payload: string;
  meta?: SessionCreateMeta;
}

export interface SessionDestroyMessage extends BaseMessageEnvelope {
  type: 'session.destroy';
  payload: string;
  meta?: Record<string, unknown>;
}

export interface SessionCreatedMeta {
  pid?: number;
  shell: string;
}

export interface SessionCreatedMessage extends BaseMessageEnvelope {
  type: 'session.created';
  payload: string;
  meta: SessionCreatedMeta;
}

export interface SessionDestroyedMeta {
  exitCode?: number;
  signal?: string;
}

export interface SessionDestroyedMessage extends BaseMessageEnvelope {
  type: 'session.destroyed';
  payload: string;
  meta?: SessionDestroyedMeta;
}

// ============================================================================
// Union Type
// ============================================================================

export type MessageEnvelope =
  | DataMessage
  | ResizeMessage
  | PingMessage
  | PongMessage
  | ErrorMessage
  | SessionCreateMessage
  | SessionDestroyMessage
  | SessionCreatedMessage
  | SessionDestroyedMessage;

// ============================================================================
// Type Guards
// ============================================================================

export function isDataMessage(msg: MessageEnvelope): msg is DataMessage {
  return msg.type === 'data';
}

export function isResizeMessage(msg: MessageEnvelope): msg is ResizeMessage {
  return msg.type === 'resize';
}

export function isPingMessage(msg: MessageEnvelope): msg is PingMessage {
  return msg.type === 'ping';
}

export function isPongMessage(msg: MessageEnvelope): msg is PongMessage {
  return msg.type === 'pong';
}

export function isErrorMessage(msg: MessageEnvelope): msg is ErrorMessage {
  return msg.type === 'error';
}

export function isSessionCreateMessage(msg: MessageEnvelope): msg is SessionCreateMessage {
  return msg.type === 'session.create';
}

export function isSessionDestroyMessage(msg: MessageEnvelope): msg is SessionDestroyMessage {
  return msg.type === 'session.destroy';
}

export function isSessionCreatedMessage(msg: MessageEnvelope): msg is SessionCreatedMessage {
  return msg.type === 'session.created';
}

export function isSessionDestroyedMessage(msg: MessageEnvelope): msg is SessionDestroyedMessage {
  return msg.type === 'session.destroyed';
}

// ============================================================================
// Factory Functions
// ============================================================================

let sequenceCounter = 0;

function getNextSeq(): number {
  return ++sequenceCounter;
}

export function resetSequence(value = 0): void {
  sequenceCounter = value;
}

export function createDataMessage(
  sessionId: string,
  payload: string,
  meta?: Record<string, unknown>
): DataMessage {
  return {
    type: 'data',
    sessionId,
    payload,
    timestamp: Date.now(),
    encoding: 'utf-8',
    seq: getNextSeq(),
    meta,
  };
}

export function createResizeMessage(
  sessionId: string,
  cols: number,
  rows: number
): ResizeMessage {
  return {
    type: 'resize',
    sessionId,
    payload: '',
    timestamp: Date.now(),
    encoding: 'utf-8',
    seq: getNextSeq(),
    meta: { cols, rows },
  };
}

export function createPingMessage(sessionId: string): PingMessage {
  return {
    type: 'ping',
    sessionId,
    payload: '',
    timestamp: Date.now(),
    encoding: 'utf-8',
    seq: getNextSeq(),
  };
}

export function createPongMessage(sessionId: string): PongMessage {
  return {
    type: 'pong',
    sessionId,
    payload: '',
    timestamp: Date.now(),
    encoding: 'utf-8',
    seq: getNextSeq(),
  };
}

export function createErrorMessage(
  sessionId: string,
  code: string,
  message: string,
  details?: Record<string, unknown>
): ErrorMessage {
  return {
    type: 'error',
    sessionId,
    payload: message,
    timestamp: Date.now(),
    encoding: 'utf-8',
    seq: getNextSeq(),
    meta: { code, details },
  };
}

export function createSessionCreateMessage(
  sessionId: string,
  options?: SessionCreateMeta
): SessionCreateMessage {
  return {
    type: 'session.create',
    sessionId,
    payload: '',
    timestamp: Date.now(),
    encoding: 'utf-8',
    seq: getNextSeq(),
    meta: options,
  };
}

export function createSessionDestroyMessage(sessionId: string): SessionDestroyMessage {
  return {
    type: 'session.destroy',
    sessionId,
    payload: '',
    timestamp: Date.now(),
    encoding: 'utf-8',
    seq: getNextSeq(),
  };
}

export function createSessionCreatedMessage(
  sessionId: string,
  shell: string,
  pid?: number
): SessionCreatedMessage {
  return {
    type: 'session.created',
    sessionId,
    payload: '',
    timestamp: Date.now(),
    encoding: 'utf-8',
    seq: getNextSeq(),
    meta: { shell, pid },
  };
}

export function createSessionDestroyedMessage(
  sessionId: string,
  exitCode?: number,
  signal?: string
): SessionDestroyedMessage {
  return {
    type: 'session.destroyed',
    sessionId,
    payload: '',
    timestamp: Date.now(),
    encoding: 'utf-8',
    seq: getNextSeq(),
    meta: { exitCode, signal },
  };
}

// ============================================================================
// Serialization
// ============================================================================

export function serializeMessage(msg: MessageEnvelope): string {
  return JSON.stringify(msg);
}

export function deserializeMessage(data: string): MessageEnvelope {
  const parsed: unknown = JSON.parse(data);
  if (!isValidMessageEnvelope(parsed)) {
    throw new Error('Invalid message envelope');
  }
  return parsed;
}

function isValidMessageEnvelope(obj: unknown): obj is MessageEnvelope {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  const msg = obj as Record<string, unknown>;
  return (
    typeof msg['type'] === 'string' &&
    typeof msg['sessionId'] === 'string' &&
    typeof msg['timestamp'] === 'number' &&
    typeof msg['encoding'] === 'string' &&
    typeof msg['seq'] === 'number'
  );
}
