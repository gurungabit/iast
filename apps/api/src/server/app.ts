// ============================================================================
// Fastify Server Application
// ============================================================================

import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { config } from '../config';
import { authRoutes } from '../routes';
import { terminalWebSocket } from '../ws';
import { closeValkeyClient } from '../valkey';

export async function buildApp(): Promise<ReturnType<typeof Fastify>> {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      transport:
        config.env === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
              },
            }
          : undefined,
    },
  });

  // Register CORS
  await app.register(cors, {
    origin: config.server.cors.origin,
    credentials: config.server.cors.credentials,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // Register WebSocket
  await app.register(websocket, {
    options: {
      maxPayload: 1024 * 1024, // 1MB
    },
  });

  // Health check
  app.get('/health', () => {
    return { status: 'ok', timestamp: Date.now() };
  });

  // Register routes
  authRoutes(app);
  terminalWebSocket(app);

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    app.log.info('Shutting down...');
    await closeValkeyClient();
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  return app;
}
