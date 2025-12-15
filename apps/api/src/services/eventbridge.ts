// ============================================================================
// EventBridge Scheduler Service - Schedule AST runs at specific times
// ============================================================================
//
// This module integrates with AWS EventBridge Scheduler to trigger Lambda
// functions at scheduled times.
//
// Required Environment Variables:
//   SCHEDULER_LAMBDA_ARN  - ARN of the lambda-scheduler function
//   SCHEDULER_ROLE_ARN    - ARN of the IAM role for EventBridge to invoke Lambda
//   SCHEDULER_GROUP_NAME  - EventBridge schedule group name (optional, default: 'ast-schedules')
//
// Required IAM Permissions:
//   - scheduler:CreateSchedule
//   - scheduler:DeleteSchedule
//   - scheduler:GetSchedule
//   - iam:PassRole (for the scheduler role)
//
// ============================================================================

import {
    SchedulerClient,
    CreateScheduleCommand,
    DeleteScheduleCommand,
    GetScheduleCommand,
    type CreateScheduleCommandInput,
} from '@aws-sdk/client-scheduler';

// ============================================================================
// Configuration
// ============================================================================

const LAMBDA_ARN = process.env.SCHEDULER_LAMBDA_ARN ?? '';
const ROLE_ARN = process.env.SCHEDULER_ROLE_ARN ?? '';
const GROUP_NAME = process.env.SCHEDULER_GROUP_NAME ?? 'ast-schedules';

// ============================================================================
// Client
// ============================================================================

let schedulerClient: SchedulerClient | null = null;

function getSchedulerClient(): SchedulerClient {
    if (!schedulerClient) {
        schedulerClient = new SchedulerClient({
            // Region will be picked up from AWS_REGION env var or default config
        });
    }
    return schedulerClient;
}

// ============================================================================
// Types
// ============================================================================

export interface CreateScheduleParams {
    scheduleId: string;
    userId: string;
    scheduledTime: string; // ISO 8601 format
    timezone: string;
}

export interface ScheduleResult {
    success: boolean;
    scheduleName?: string;
    error?: string;
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Create an EventBridge schedule to trigger the Lambda at the specified time.
 *
 * @param params - Schedule parameters
 * @returns Result with schedule name or error
 */
export async function createEventBridgeSchedule(
    params: CreateScheduleParams
): Promise<ScheduleResult> {
    if (!LAMBDA_ARN || !ROLE_ARN) {
        return {
            success: false,
            error: 'EventBridge Scheduler not configured: missing SCHEDULER_LAMBDA_ARN or SCHEDULER_ROLE_ARN',
        };
    }

    const client = getSchedulerClient();
    const scheduleName = `ast-${params.scheduleId}`;

    try {
        // Convert ISO time to EventBridge schedule expression
        // EventBridge uses: at(yyyy-mm-ddThh:mm:ss)
        const scheduleExpression = `at(${params.scheduledTime.replace('Z', '')})`;

        const input: CreateScheduleCommandInput = {
            Name: scheduleName,
            GroupName: GROUP_NAME,
            ScheduleExpression: scheduleExpression,
            ScheduleExpressionTimezone: params.timezone,
            FlexibleTimeWindow: {
                Mode: 'OFF', // Execute at exact time
            },
            Target: {
                Arn: LAMBDA_ARN,
                RoleArn: ROLE_ARN,
                Input: JSON.stringify({
                    scheduleId: params.scheduleId,
                    userId: params.userId,
                }),
            },
            // Auto-delete after execution
            ActionAfterCompletion: 'DELETE',
        };

        await client.send(new CreateScheduleCommand(input));

        return {
            success: true,
            scheduleName,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to create EventBridge schedule:', { params, error: message });

        return {
            success: false,
            error: `Failed to create schedule: ${message}`,
        };
    }
}

/**
 * Delete an EventBridge schedule.
 *
 * @param scheduleId - The schedule ID (used to derive schedule name)
 * @returns Result indicating success or failure
 */
export async function deleteEventBridgeSchedule(
    scheduleId: string
): Promise<ScheduleResult> {
    if (!LAMBDA_ARN || !ROLE_ARN) {
        // Not configured, nothing to delete
        return { success: true };
    }

    const client = getSchedulerClient();
    const scheduleName = `ast-${scheduleId}`;

    try {
        await client.send(
            new DeleteScheduleCommand({
                Name: scheduleName,
                GroupName: GROUP_NAME,
            })
        );

        return { success: true, scheduleName };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';

        // Ignore "not found" errors (schedule may have already executed and been deleted)
        if (message.includes('ResourceNotFoundException')) {
            return { success: true, scheduleName };
        }

        console.error('Failed to delete EventBridge schedule:', { scheduleId, error: message });

        return {
            success: false,
            error: `Failed to delete schedule: ${message}`,
        };
    }
}

/**
 * Check if an EventBridge schedule exists.
 *
 * @param scheduleId - The schedule ID
 * @returns True if schedule exists
 */
export async function eventBridgeScheduleExists(scheduleId: string): Promise<boolean> {
    if (!LAMBDA_ARN || !ROLE_ARN) {
        return false;
    }

    const client = getSchedulerClient();
    const scheduleName = `ast-${scheduleId}`;

    try {
        await client.send(
            new GetScheduleCommand({
                Name: scheduleName,
                GroupName: GROUP_NAME,
            })
        );
        return true;
    } catch {
        return false;
    }
}
