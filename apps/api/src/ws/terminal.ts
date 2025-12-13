// ============================================================================
// WebSocket Terminal Handler - Direct Bridge to Gateway EC2
// ============================================================================

import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket as FastifyWebSocket } from '@fastify/websocket';
import WebSocket from 'ws';
import {
  deserializeMessage,
  serializeMessage,
  createErrorMessage,
  createPongMessage,
  isPingMessage,
  isSessionCreateMessage,
  ERROR_CODES,
} from '@terminal/shared';
import { verifyToken } from '../services/auth';
import { createTerminalSession, endTerminalSession } from '../services/session';
import {
  getGatewaySession,
  registerGatewaySession,
  getLeastLoadedInstance,
} from '../services/registry';
import { bridgeWebSockets } from './bridge';
import { config } from '../config';

interface TerminalParams {
  sessionId: string;
}

interface TerminalQuery {
  token?: string;
}

// Gateway WebSocket port (gateway runs WebSocket server on this port)
const GATEWAY_WS_PORT = 8080;

export function terminalWebSocket(fastify: FastifyInstance): void {
  fastify.get<{
    Params: TerminalParams;
    Querystring: TerminalQuery;
  }>(
    '/terminal/:sessionId',
    { websocket: true },
    (
      socket: FastifyWebSocket,
      request: FastifyRequest<{
        Params: TerminalParams;
        Querystring: TerminalQuery;
      }>
    ) => {
      const { sessionId } = request.params;
      const { token } = request.query;

      // Buffer messages that arrive before init is complete
      const messageBuffer: Buffer[] = [];
      let initComplete = false;
      let messageHandler: ((data: Buffer) => Promise<void>) | null = null;

      // Set up message handler IMMEDIATELY (sync) to capture early messages
      socket.on('message', (data: Buffer) => {
        fastify.log.info({ sessionId, initComplete }, 'Raw message received');
        if (initComplete && messageHandler) {
          messageHandler(data);
        } else {
          messageBuffer.push(data);
          fastify.log.info({ sessionId, bufferedCount: messageBuffer.length }, 'Buffered message');
        }
      });

      // Handle async initialization
      const initConnection = async (): Promise<void> => {
        let userId: string | null = null;

        // Verify token if provided
        if (token) {
          try {
            const payload = await verifyToken(token);
            userId = payload.sub;
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

        if (!userId) {
          const errorMsg = createErrorMessage(
            sessionId,
            ERROR_CODES.AUTH_REQUIRED,
            'Authentication required'
          );
          socket.send(serializeMessage(errorMsg));
          socket.close(1008, 'Unauthorized');
          return;
        }

        // Create terminal session record
        try {
          createTerminalSession(userId, sessionId);
        } catch (err) {
          if (err instanceof Error && 'code' in err) {
            const errorMsg = createErrorMessage(sessionId, (err as { code: string }).code, err.message);
            socket.send(serializeMessage(errorMsg));
            socket.close(1008, err.message);
            return;
          }
          throw err;
        }

        fastify.log.info({ sessionId, userId }, 'Terminal WebSocket connected');

        // Check if session already has a gateway assignment
        let gatewaySession = await getGatewaySession(sessionId);

        if (!gatewaySession) {
          // New session - assign to a gateway instance
          // For now, use the configured gateway host (single gateway mode)
          // In production, this would pick the least-loaded EC2
          const instanceIp = config.tn3270?.host || await getLeastLoadedInstance();

          fastify.log.info({ sessionId, instanceIp }, 'Assigning session to gateway');

          // Register session in Redis
          await registerGatewaySession(sessionId, instanceIp, userId);

          gatewaySession = {
            instanceIp,
            userId,
            createdAt: Date.now(),
            status: 'active',
          };
        }

        // Handle session.create message - this signals gateway to connect to mainframe
        // For now, we still need to wait for the client to send this message
        // The gateway will establish TN3270 connection when it receives session.create

        // Set up message handler for session.create (before bridge is established)
        const handlePreBridgeMessage = async (data: Buffer): Promise<void> => {
          try {
            const messageStr = data.toString();
            fastify.log.info({ sessionId, messagePreview: messageStr.substring(0, 100) }, 'Received pre-bridge message');
            const message = deserializeMessage(messageStr);
            fastify.log.info({ sessionId, messageType: message.type }, 'Parsed message type');

            if (isPingMessage(message)) {
              const pong = createPongMessage(sessionId);
              socket.send(serializeMessage(pong));
              return;
            }

            if (isSessionCreateMessage(message)) {
              fastify.log.info({ sessionId }, 'Received session.create, connecting to gateway');

              // Connect to gateway WebSocket
              const gatewayUrl = `ws://${gatewaySession!.instanceIp}:${GATEWAY_WS_PORT}/session/${sessionId}`;
              fastify.log.info({ sessionId, gatewayUrl }, 'Connecting to gateway');

              const gatewayWs = new WebSocket(gatewayUrl);

              gatewayWs.on('open', () => {
                fastify.log.info({ sessionId }, 'Gateway connected, establishing bridge');

                // Remove pre-bridge handler
                socket.removeListener('message', handlePreBridgeMessage);

                // Forward the session.create message to gateway
                gatewayWs.send(data);

                // Bridge the connections
                bridgeWebSockets(socket as unknown as WebSocket, gatewayWs, sessionId, fastify.log);
              });

              gatewayWs.on('error', (err: Error) => {
                fastify.log.error({ sessionId, err: err.message }, 'Failed to connect to gateway');
                const errorMsg = createErrorMessage(
                  sessionId,
                  ERROR_CODES.TERMINAL_CONNECTION_FAILED,
                  'Gateway unavailable'
                );
                socket.send(serializeMessage(errorMsg));
                socket.close(4003, 'Gateway unavailable');
              });
            }
          } catch (err) {
            fastify.log.error({ err }, 'Failed to process pre-bridge message');
          }
        };

        // Set the message handler and mark init as complete
        messageHandler = handlePreBridgeMessage;
        initComplete = true;
        fastify.log.info({ sessionId, bufferedCount: messageBuffer.length }, 'Init complete, processing buffered messages');

        // Process any buffered messages
        for (const bufferedData of messageBuffer) {
          await handlePreBridgeMessage(bufferedData);
        }
        messageBuffer.length = 0;

        // Handle close before bridge is established
        socket.on('close', () => {
          fastify.log.info({ sessionId }, 'Browser disconnected before bridge');
          endTerminalSession(sessionId, userId);
        });

        socket.on('error', (err: Error) => {
          fastify.log.error({ sessionId, err: err.message }, 'WebSocket error');
        });
      };

      // Start async initialization
      initConnection().catch((err) => {
        fastify.log.error({ err }, 'Failed to initialize WebSocket connection');
        const errorMsg = createErrorMessage(
          sessionId,
          ERROR_CODES.INTERNAL_ERROR,
          'Connection initialization failed'
        );
        socket.send(serializeMessage(errorMsg));
        socket.close(1011, 'Internal Error');
      });
    }
  );
}
