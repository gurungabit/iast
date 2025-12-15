// ============================================================================
// Lambda Scheduler - EventBridge triggered function to run scheduled AST jobs
// ============================================================================
//
// This Lambda is triggered by EventBridge at the scheduled time.
// It calls the API's POST /schedules/:id/run endpoint to execute the job.
//
// Environment Variables:
//   API_BASE_URL - Base URL of the API (e.g., https://api.example.com)
//   API_TOKEN    - Service account token for authentication
//
// EventBridge Event Format:
// {
//   "scheduleId": "abc123",
//   "userId": "user-456"
// }
// ============================================================================

import type { ScheduledEvent, Context } from 'aws-lambda';

interface ScheduleEventDetail {
    scheduleId: string;
    userId: string;
}

interface RunResponse {
    success: boolean;
    data?: {
        scheduleId: string;
        sessionId: string;
        astName: string;
        status: string;
    };
    error?: {
        code: string;
        message: string;
    };
}

export async function handler(
    event: ScheduledEvent,
    context: Context
): Promise<{ statusCode: number; body: string }> {
    console.log('Lambda invoked', { event, requestId: context.awsRequestId });

    const apiBaseUrl = process.env.API_BASE_URL;
    const apiToken = process.env.API_TOKEN;

    if (!apiBaseUrl || !apiToken) {
        console.error('Missing required environment variables');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Missing API_BASE_URL or API_TOKEN' }),
        };
    }

    // Parse the event detail
    const detail = event.detail as ScheduleEventDetail | undefined;

    if (!detail?.scheduleId) {
        console.error('Invalid event: missing scheduleId', { detail });
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing scheduleId in event detail' }),
        };
    }

    const { scheduleId } = detail;

    console.log('Running scheduled job', { scheduleId });

    try {
        // Call the API to run the scheduled job
        const response = await fetch(`${apiBaseUrl}/schedules/${scheduleId}/run`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiToken}`,
            },
        });

        const result = (await response.json()) as RunResponse;

        if (!response.ok) {
            console.error('API error', {
                scheduleId,
                status: response.status,
                error: result.error,
            });
            return {
                statusCode: response.status,
                body: JSON.stringify({
                    error: result.error?.message || 'Failed to run scheduled job',
                }),
            };
        }

        console.log('Scheduled job started successfully', {
            scheduleId,
            sessionId: result.data?.sessionId,
            astName: result.data?.astName,
        });

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                scheduleId,
                sessionId: result.data?.sessionId,
                astName: result.data?.astName,
            }),
        };
    } catch (error) {
        console.error('Lambda execution error', { scheduleId, error });
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: error instanceof Error ? error.message : 'Unknown error',
            }),
        };
    }
}
