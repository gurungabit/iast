// ============================================================================
// Auth Routes
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  type LoginRequest,
  type RegisterRequest,
  validateLoginRequest,
  validateRegisterRequest,
  createSuccessResponse,
  createErrorResponse,
  ERROR_CODES,
  TerminalError,
} from '@terminal/shared';
import { registerUser, loginUser, refreshUserToken, verifyToken } from '../services/auth';
import { findUserByEmail, toPublicUser } from '../models/user';

export function authRoutes(fastify: FastifyInstance): void {
  // Register
  fastify.post('/auth/register', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as RegisterRequest;

      // Validate request
      const validation = validateRegisterRequest(body);
      if (!validation.valid) {
        return await reply
          .status(400)
          .send(createErrorResponse(ERROR_CODES.VALIDATION_FAILED, validation.errors.join(', ')));
      }

      const result = await registerUser(body.email, body.password);
      return await reply.status(201).send(createSuccessResponse(result));
    } catch (error) {
      if (error instanceof TerminalError) {
        return await reply
          .status(400)
          .send(createErrorResponse(error.code, error.message, error.details));
      }
      fastify.log.error(error);
      return await reply.status(500).send(createErrorResponse(ERROR_CODES.INTERNAL_ERROR));
    }
  });

  // Login
  fastify.post('/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as LoginRequest;

      // Validate request
      const validation = validateLoginRequest(body);
      if (!validation.valid) {
        return await reply
          .status(400)
          .send(createErrorResponse(ERROR_CODES.VALIDATION_FAILED, validation.errors.join(', ')));
      }

      const result = await loginUser(body.email, body.password);
      return await reply.send(createSuccessResponse(result));
    } catch (error) {
      if (error instanceof TerminalError) {
        const status = error.code === ERROR_CODES.AUTH_INVALID_CREDENTIALS ? 401 : 400;
        return await reply.status(status).send(createErrorResponse(error.code, error.message));
      }
      fastify.log.error(error);
      return await reply.status(500).send(createErrorResponse(ERROR_CODES.INTERNAL_ERROR));
    }
  });

  // Refresh token
  fastify.post('/auth/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { token: string };

      if (!body.token) {
        return await reply
          .status(400)
          .send(createErrorResponse(ERROR_CODES.VALIDATION_MISSING_FIELD, 'Token is required'));
      }

      const result = await refreshUserToken(body.token);
      return await reply.send(createSuccessResponse(result));
    } catch (error) {
      if (error instanceof TerminalError) {
        return await reply.status(401).send(createErrorResponse(error.code, error.message));
      }
      fastify.log.error(error);
      return await reply.status(500).send(createErrorResponse(ERROR_CODES.INTERNAL_ERROR));
    }
  });

  // Get current user
  fastify.get('/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return await reply.status(401).send(createErrorResponse(ERROR_CODES.AUTH_REQUIRED));
      }

      const token = authHeader.slice(7);
      const payload = verifyToken(token);

      const user = await findUserByEmail(payload.email);
      if (!user) {
        return await reply.status(404).send(createErrorResponse(ERROR_CODES.AUTH_USER_NOT_FOUND));
      }

      return await reply.send(createSuccessResponse(toPublicUser(user)));
    } catch (error) {
      if (error instanceof TerminalError) {
        return await reply.status(401).send(createErrorResponse(error.code, error.message));
      }
      fastify.log.error(error);
      return await reply.status(500).send(createErrorResponse(ERROR_CODES.INTERNAL_ERROR));
    }
  });

  // Logout (client-side token invalidation)
  fastify.post('/auth/logout', async (_request: FastifyRequest, reply: FastifyReply) => {
    // In a production app, you'd invalidate the token server-side
    return await reply.send(createSuccessResponse({ message: 'Logged out successfully' }));
  });
}
