// ============================================================================
// WebSocket Terminal Handler
// ============================================================================

import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import {
  deserializeMessage,
  serializeMessage,
  createErrorMessage,
  createPongMessage,
  isDataMessage,
  isResizeMessage,
  isPingMessage,
  isSessionCreateMessage,
  isSessionDestroyMessage,
  TerminalError,
  ERROR_CODES,
} from '@terminal/shared';
import { verifyToken } from '../services/auth';
import { createTerminalSession, endTerminalSession, touchSession } from '../services/session';
import { getValkeyClient } from '../valkey';

interface TerminalParams {
  sessionId: string;
}

interface TerminalQuery {
  token?: string;
}

export function terminalWebSocket(fastify: FastifyInstance): void {
  fastify.get<{
    Params: TerminalParams;
    Querystring: TerminalQuery;
  }>('/terminal/:sessionId', { websocket: true }, (socket: WebSocket, request: FastifyRequest<{
    Params: TerminalParams;
    Querystring: TerminalQuery;
  }>) => {
    const { sessionId } = request.params;
    const { token } = request.query;

    let userId: string | null = null;
    let isAuthenticated = false;

    // Verify token if provided
    if (token) {
      try {
        const payload = verifyToken(token);
        userId = payload.sub;
        isAuthenticated = true;
      } catch {
        const errorMsg = createErrorMessage(
          sessionId,
          ERROR_CODES.AUTH_INVALID_TOKEN,
          'Invalid authentication token'
        );
        socket.send(serializeMessage(errorMsg));
        socket.close(1008, 'Unauthorized');
        return;
      }
    }

    if (!isAuthenticated || !userId) {
      const errorMsg = createErrorMessage(
        sessionId,
        ERROR_CODES.AUTH_REQUIRED,
        'Authentication required'
      );
      socket.send(serializeMessage(errorMsg));
      socket.close(1008, 'Unauthorized');
      return;
    }

    // Create or get terminal session
    try {
      createTerminalSession(userId, sessionId);
    } catch (err) {
      if (err instanceof TerminalError) {
        const errorMsg = createErrorMessage(sessionId, err.code, err.message);
        socket.send(serializeMessage(errorMsg));
        socket.close(1008, err.message);
        return;
      }
      throw err;
    }

    const valkey = getValkeyClient();

    // Subscribe to PTY output
    const handleOutput = (message: string): void => {
      if (socket.readyState === socket.OPEN) {
        socket.send(message);
      }
    };

    valkey.subscribeToOutput(sessionId, handleOutput).catch((err: unknown) => {
      fastify.log.error({ err }, 'Failed to subscribe to output');
    });

    // Handle incoming messages
    socket.on('message', (data: Buffer) => {
      try {
        const message = deserializeMessage(data.toString());
        touchSession(sessionId);

        if (isDataMessage(message)) {
          // Forward input to PTY via Valkey
          valkey.publishInput(sessionId, message).catch((err: unknown) => {
            fastify.log.error({ err }, 'Failed to publish input');
          });
        } else if (isResizeMessage(message)) {
          // Forward resize to PTY via Valkey control channel
          valkey.publishControl(sessionId, message).catch((err: unknown) => {
            fastify.log.error({ err }, 'Failed to publish resize');
          });
        } else if (isPingMessage(message)) {
          // Respond with pong
          const pong = createPongMessage(sessionId);
          socket.send(serializeMessage(pong));
        } else if (isSessionCreateMessage(message)) {
          // Forward session create to gateway via global control channel
          fastify.log.info({ sessionId: message.sessionId }, 'Forwarding session create to gateway');
          valkey.publishGatewayControl(message).catch((err: unknown) => {
            fastify.log.error({ err }, 'Failed to publish session create');
          });
        } else if (isSessionDestroyMessage(message)) {
          // Forward session destroy to gateway
          valkey.publishControl(sessionId, message).catch((err: unknown) => {
            fastify.log.error({ err }, 'Failed to publish session destroy');
          });
        }
      } catch (err) {
        fastify.log.error({ err }, 'Failed to process message');
        const errorMsg = createErrorMessage(
          sessionId,
          ERROR_CODES.WS_MESSAGE_INVALID,
          'Invalid message format'
        );
        socket.send(serializeMessage(errorMsg));
      }
    });

    // Handle close
    socket.on('close', () => {
      valkey.unsubscribeFromOutput(sessionId).catch((err: unknown) => {
        fastify.log.error({ err }, 'Failed to unsubscribe');
      });
      endTerminalSession(sessionId, userId);
    });

    // Handle errors
    socket.on('error', (err: Error) => {
      fastify.log.error({ err }, 'WebSocket error');
    });
  });
}
