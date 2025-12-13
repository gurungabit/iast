// ============================================================================
// Gateway Session Registry - Using DynamoDB (no Redis needed)
// ============================================================================

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
    DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { config } from '../config';

// Key prefix for gateway session mapping
const GATEWAY_PREFIX = 'GATEWAY#';

export interface GatewaySession {
    instanceIp: string;
    userId: string;
    createdAt: number;
    status: 'active' | 'terminated';
}

// DynamoDB client (reuse config from existing client)
const client = new DynamoDBClient({
    endpoint: config.dynamodb.endpoint,
    region: config.dynamodb.region,
    credentials: {
        accessKeyId: config.dynamodb.accessKeyId,
        secretAccessKey: config.dynamodb.secretAccessKey,
    },
});

const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
        removeUndefinedValues: true,
    },
});

const TABLE_NAME = config.dynamodb.tableName;

/**
 * Look up gateway session from DynamoDB.
 * Returns gateway EC2 info for the session.
 *
 * Key structure:
 *   PK: SESSION#<sessionId>
 *   SK: GATEWAY#mapping
 */
export async function getGatewaySession(sessionId: string): Promise<GatewaySession | null> {
    const result = await docClient.send(
        new GetCommand({
            TableName: TABLE_NAME,
            Key: {
                PK: `SESSION#${sessionId}`,
                SK: `${GATEWAY_PREFIX}mapping`,
            },
        })
    );

    if (!result.Item) return null;

    return {
        instanceIp: result.Item.instanceIp as string,
        userId: result.Item.userId as string,
        createdAt: result.Item.createdAt as number,
        status: result.Item.status as 'active' | 'terminated',
    };
}

/**
 * Register a new gateway session in DynamoDB.
 * Called when API creates a session and assigns it to an EC2.
 *
 * TTL: 24 hours (DynamoDB TTL attribute)
 */
export async function registerGatewaySession(
    sessionId: string,
    instanceIp: string,
    userId: string
): Promise<void> {
    const now = Date.now();
    const ttl = Math.floor(now / 1000) + 86400; // 24 hours from now (in seconds)

    await docClient.send(
        new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                PK: `SESSION#${sessionId}`,
                SK: `${GATEWAY_PREFIX}mapping`,
                instanceIp,
                userId,
                createdAt: now,
                status: 'active',
                ttl, // DynamoDB TTL attribute for auto-cleanup
            },
        })
    );
}

/**
 * Remove gateway session mapping from DynamoDB.
 */
export async function terminateGatewaySession(sessionId: string): Promise<void> {
    await docClient.send(
        new DeleteCommand({
            TableName: TABLE_NAME,
            Key: {
                PK: `SESSION#${sessionId}`,
                SK: `${GATEWAY_PREFIX}mapping`,
            },
        })
    );
}

/**
 * Get the least-loaded gateway instance for new session assignment.
 * For now, returns the configured TN3270 host (single gateway mode).
 *
 * In production with EC2 ASG:
 * - Query instances registered in DynamoDB
 * - Count sessions per instance
 * - Return instance with lowest count
 */
export async function getLeastLoadedInstance(): Promise<string> {
    // TODO: In production, implement instance discovery + load balancing
    // For now, return the TN3270 host from config
    return config.tn3270?.host || 'localhost';
}
