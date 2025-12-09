// ============================================================================
// Auth Routes
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  createSuccessResponse,
  createErrorResponse,
  ERROR_CODES,
  TerminalError,
} from '@terminal/shared';
import { authenticateUser } from '../services/auth';

export function authRoutes(fastify: FastifyInstance): void {
  // Get current user
  fastify.get('/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return await reply.status(401).send(createErrorResponse(ERROR_CODES.AUTH_REQUIRED));
      }

      const token = authHeader.slice(7).trim();
      const user = await authenticateUser(token);

      return await reply.send(createSuccessResponse(user));
    } catch (error) {
      if (error instanceof TerminalError) {
        return await reply.status(401).send(createErrorResponse(error.code, error.message));
      }
      fastify.log.error(error);
      return await reply.status(500).send(createErrorResponse(ERROR_CODES.INTERNAL_ERROR));
    }
  });
}
