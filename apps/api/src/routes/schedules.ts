// ============================================================================
// Schedule Routes - Scheduled AST execution
// ============================================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import {
    createSuccessResponse,
    createErrorResponse,
    ERROR_CODES,
    TerminalError,
} from '@terminal/shared';
import { verifyToken } from '../services/auth';
import {
    KeyPrefix,
    type ScheduleRecord,
    createScheduleRecord,
    getScheduleById,
    getSchedulesByUser,
    updateScheduleStatus,
} from '../services/dynamodb';
import { createUserSession } from '../models/userSession';
import { encryptCredentials, isEncryptionConfigured, type EncryptedData } from '../services/encryption';

export function scheduleRoutes(fastify: FastifyInstance): void {
    // =========================================================================
    // Create a new schedule
    // POST /schedules
    // =========================================================================
    fastify.post('/schedules', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader?.startsWith('Bearer ')) {
                return await reply.status(401).send(createErrorResponse(ERROR_CODES.AUTH_REQUIRED));
            }

            const token = authHeader.slice(7);
            const payload = await verifyToken(token);

            const body = request.body as {
                astName: string;
                params?: Record<string, unknown>;
                scheduledTime: string;
                timezone: string;
                notifyEmail?: string;
                credentials?: { username: string; password: string };
            };

            // Validate required fields
            if (!body.astName || typeof body.astName !== 'string') {
                return await reply
                    .status(400)
                    .send(createErrorResponse(ERROR_CODES.VALIDATION_MISSING_FIELD, 'astName is required'));
            }

            if (!body.scheduledTime || typeof body.scheduledTime !== 'string') {
                return await reply
                    .status(400)
                    .send(
                        createErrorResponse(ERROR_CODES.VALIDATION_MISSING_FIELD, 'scheduledTime is required')
                    );
            }

            if (!body.timezone || typeof body.timezone !== 'string') {
                return await reply
                    .status(400)
                    .send(createErrorResponse(ERROR_CODES.VALIDATION_MISSING_FIELD, 'timezone is required'));
            }

            // Validate scheduledTime is in the future
            const scheduledDate = new Date(body.scheduledTime);
            if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
                return await reply
                    .status(400)
                    .send(
                        createErrorResponse(
                            ERROR_CODES.VALIDATION_INVALID_FORMAT,
                            'scheduledTime must be a valid future date'
                        )
                    );
            }

            const scheduleId = randomUUID();
            const now = Date.now();

            // Encrypt credentials if provided and encryption is configured
            let encryptedCredentials: EncryptedData | undefined;
            if (body.credentials) {
                if (isEncryptionConfigured()) {
                    encryptedCredentials = encryptCredentials(body.credentials);
                    fastify.log.info({ scheduleId }, 'Credentials encrypted for schedule');
                } else {
                    fastify.log.warn({ scheduleId }, 'CREDENTIALS_ENCRYPTION_KEY not configured - storing credentials unencrypted');
                }
            }

            // Strip credentials from params to avoid storing them unencrypted
            const sanitizedParams = { ...(body.params ?? {}) };
            delete sanitizedParams.username;
            delete sanitizedParams.password;

            const schedule: ScheduleRecord = {
                PK: `${KeyPrefix.USER}${payload.sub}`,
                SK: `${KeyPrefix.SCHEDULE}${scheduleId}`,
                GSI1PK: KeyPrefix.SCHEDULE_PENDING,
                GSI1SK: `${body.scheduledTime}#${scheduleId}`,
                scheduleId,
                userId: payload.sub,
                astName: body.astName,
                params: sanitizedParams,
                scheduledTime: body.scheduledTime,
                timezone: body.timezone,
                notifyEmail: body.notifyEmail,
                status: 'pending',
                createdAt: now,
                updatedAt: now,
                // Store encrypted credentials (or raw if encryption not configured)
                encryptedCredentials,
                rawCredentials: !isEncryptionConfigured() ? body.credentials : undefined,
            };

            await createScheduleRecord(schedule);

            // TODO: Uncomment when EventBridge Scheduler is configured
            // ============================================================
            // Create EventBridge schedule to trigger Lambda at scheduled time
            // ============================================================
            // import { createEventBridgeSchedule } from '../services/eventbridge';
            //
            // const eventBridgeResult = await createEventBridgeSchedule({
            //     scheduleId,
            //     userId: payload.sub,
            //     scheduledTime: body.scheduledTime,
            //     timezone: body.timezone,
            // });
            //
            // if (!eventBridgeResult.success) {
            //     // Rollback: delete the schedule record if EventBridge fails
            //     await deleteScheduleRecord(payload.sub, scheduleId);
            //     return await reply.status(500).send(
            //         createErrorResponse(
            //             ERROR_CODES.INTERNAL_ERROR,
            //             eventBridgeResult.error ?? 'Failed to create EventBridge schedule'
            //         )
            //     );
            // }
            // ============================================================

            return await reply.status(201).send(
                createSuccessResponse({
                    scheduleId,
                    astName: body.astName,
                    scheduledTime: body.scheduledTime,
                    timezone: body.timezone,
                    status: 'pending',
                })
            );
        } catch (error) {
            if (error instanceof TerminalError) {
                return await reply.status(401).send(createErrorResponse(error.code, error.message));
            }
            fastify.log.error(error);
            return await reply.status(500).send(createErrorResponse(ERROR_CODES.INTERNAL_ERROR));
        }
    });

    // =========================================================================
    // Get all schedules for the user
    // GET /schedules
    // =========================================================================
    fastify.get('/schedules', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader?.startsWith('Bearer ')) {
                return await reply.status(401).send(createErrorResponse(ERROR_CODES.AUTH_REQUIRED));
            }

            const token = authHeader.slice(7);
            const payload = await verifyToken(token);

            const schedules = await getSchedulesByUser(payload.sub);

            // Map to response format
            const response = schedules.map((s) => ({
                scheduleId: s.scheduleId,
                astName: s.astName,
                scheduledTime: s.scheduledTime,
                timezone: s.timezone,
                status: s.status,
                sessionId: s.sessionId,
                executionId: s.executionId,
                createdAt: s.createdAt,
            }));

            return await reply.send(createSuccessResponse(response));
        } catch (error) {
            if (error instanceof TerminalError) {
                return await reply.status(401).send(createErrorResponse(error.code, error.message));
            }
            fastify.log.error(error);
            return await reply.status(500).send(createErrorResponse(ERROR_CODES.INTERNAL_ERROR));
        }
    });

    // =========================================================================
    // Get a specific schedule
    // GET /schedules/:id
    // =========================================================================
    fastify.get('/schedules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader?.startsWith('Bearer ')) {
                return await reply.status(401).send(createErrorResponse(ERROR_CODES.AUTH_REQUIRED));
            }

            const token = authHeader.slice(7);
            const payload = await verifyToken(token);

            const { id } = request.params as { id: string };

            const schedule = await getScheduleById(payload.sub, id);

            if (!schedule) {
                return await reply
                    .status(404)
                    .send(createErrorResponse(ERROR_CODES.RESOURCE_NOT_FOUND, 'Schedule not found'));
            }

            return await reply.send(
                createSuccessResponse({
                    scheduleId: schedule.scheduleId,
                    astName: schedule.astName,
                    params: schedule.params,
                    scheduledTime: schedule.scheduledTime,
                    timezone: schedule.timezone,
                    notifyEmail: schedule.notifyEmail,
                    status: schedule.status,
                    sessionId: schedule.sessionId,
                    executionId: schedule.executionId,
                    createdAt: schedule.createdAt,
                })
            );
        } catch (error) {
            if (error instanceof TerminalError) {
                return await reply.status(401).send(createErrorResponse(error.code, error.message));
            }
            fastify.log.error(error);
            return await reply.status(500).send(createErrorResponse(ERROR_CODES.INTERNAL_ERROR));
        }
    });

    // =========================================================================
    // Cancel a schedule
    // DELETE /schedules/:id
    // =========================================================================
    fastify.delete('/schedules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader?.startsWith('Bearer ')) {
                return await reply.status(401).send(createErrorResponse(ERROR_CODES.AUTH_REQUIRED));
            }

            const token = authHeader.slice(7);
            const payload = await verifyToken(token);

            const { id } = request.params as { id: string };

            const schedule = await getScheduleById(payload.sub, id);

            if (!schedule) {
                return await reply
                    .status(404)
                    .send(createErrorResponse(ERROR_CODES.RESOURCE_NOT_FOUND, 'Schedule not found'));
            }

            // Can only cancel pending schedules
            if (schedule.status !== 'pending') {
                return await reply
                    .status(400)
                    .send(
                        createErrorResponse(
                            ERROR_CODES.VALIDATION_INVALID_FORMAT,
                            'Only pending schedules can be cancelled'
                        )
                    );
            }

            await updateScheduleStatus(payload.sub, id, 'cancelled');

            return await reply.send(createSuccessResponse({ cancelled: true }));
        } catch (error) {
            if (error instanceof TerminalError) {
                return await reply.status(401).send(createErrorResponse(error.code, error.message));
            }
            fastify.log.error(error);
            return await reply.status(500).send(createErrorResponse(ERROR_CODES.INTERNAL_ERROR));
        }
    });

    // =========================================================================
    // Run a scheduled job (called by Lambda or manually)
    // POST /schedules/:id/run
    //
    // Example usage:
    //   curl -X POST http://localhost:3000/schedules/{scheduleId}/run \
    //     -H "Authorization: Bearer {token}" \
    //     -H "Content-Type: application/json"
    //
    // This endpoint:
    //   1. Creates a new session for the job
    //   2. Connects to the gateway
    //   3. Runs the AST
    //   4. Returns the sessionId so user can watch via terminal
    // =========================================================================
    fastify.post('/schedules/:id/run', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader?.startsWith('Bearer ')) {
                return await reply.status(401).send(createErrorResponse(ERROR_CODES.AUTH_REQUIRED));
            }

            const token = authHeader.slice(7);
            const payload = await verifyToken(token);

            const { id } = request.params as { id: string };

            // Get the schedule
            const schedule = await getScheduleById(payload.sub, id);

            if (!schedule) {
                return await reply
                    .status(404)
                    .send(createErrorResponse(ERROR_CODES.RESOURCE_NOT_FOUND, 'Schedule not found'));
            }

            // Check status
            if (schedule.status !== 'pending') {
                return await reply
                    .status(400)
                    .send(
                        createErrorResponse(
                            ERROR_CODES.VALIDATION_INVALID_FORMAT,
                            `Schedule is ${schedule.status}, cannot run`
                        )
                    );
            }

            // Create a session for this scheduled job
            const session = await createUserSession({
                userId: payload.sub,
                name: `Scheduled: ${schedule.astName} (${new Date().toISOString()})`,
            });

            // Update schedule to running with sessionId
            await updateScheduleStatus(payload.sub, id, 'running', {
                sessionId: session.id,
            });

            // TODO: Connect to gateway and run AST
            // For now, just return the session info so user can connect
            // The actual AST run will be triggered when user/lambda connects to the terminal

            fastify.log.info(
                { scheduleId: id, sessionId: session.id, astName: schedule.astName },
                'Scheduled job started'
            );

            return await reply.send(
                createSuccessResponse({
                    scheduleId: id,
                    sessionId: session.id,
                    astName: schedule.astName,
                    params: schedule.params,
                    status: 'running',
                    message: 'Session created. Connect to terminal to run AST.',
                })
            );
        } catch (error) {
            if (error instanceof TerminalError) {
                return await reply.status(401).send(createErrorResponse(error.code, error.message));
            }
            fastify.log.error(error);
            return await reply.status(500).send(createErrorResponse(ERROR_CODES.INTERNAL_ERROR));
        }
    });
}
