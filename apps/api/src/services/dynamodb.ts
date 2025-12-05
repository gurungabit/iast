// ============================================================================
// DynamoDB Client Service
// ============================================================================

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  type QueryCommandInput,
} from '@aws-sdk/lib-dynamodb';

// Key prefixes for single table design
export const KeyPrefix = {
  USER: 'USER#',
  SESSION: 'SESSION#',
  EXECUTION: 'EXECUTION#',
  POLICY: 'POLICY#',
  PROFILE: 'PROFILE',
} as const;

// Execution status types
export type ExecutionStatus = 'running' | 'success' | 'failed' | 'paused' | 'cancelled';

// Execution record from DynamoDB
export interface ExecutionRecord {
  PK: string;
  SK: string;
  GSI2PK: string;
  GSI2SK: string;
  execution_id: string;
  session_id: string;
  user_id: string;
  host_user: string;
  ast_name: string;
  status: ExecutionStatus;
  started_at: string;
  completed_at?: string;
  message?: string;
  error?: string;
  policy_count: number;
  success_count?: number;
  failed_count?: number;
  skipped_count?: number;
}

// Policy result from DynamoDB
export interface PolicyResultRecord {
  PK: string;
  SK: string;
  execution_id: string;
  policy_number: string;
  status: 'success' | 'failed' | 'skipped';
  duration_ms: number;
  started_at: string;
  completed_at: string;
  error?: string;
  policy_data?: Record<string, unknown>;
}

// Import config
import { config } from '../config';

// DynamoDB configuration from config
const DYNAMODB_ENDPOINT = config.dynamodb.endpoint;
const AWS_REGION = config.dynamodb.region;
const AWS_ACCESS_KEY_ID = config.dynamodb.accessKeyId;
const AWS_SECRET_ACCESS_KEY = config.dynamodb.secretAccessKey;
const TABLE_NAME = config.dynamodb.tableName;

// Create DynamoDB client
const client = new DynamoDBClient({
  endpoint: DYNAMODB_ENDPOINT,
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get executions for a user on a specific date
 */
export async function getExecutionsByDate(
  userId: string,
  date: string,
  options: {
    status?: ExecutionStatus;
    limit?: number;
    cursor?: Record<string, unknown>;
  } = {}
): Promise<{ items: ExecutionRecord[]; nextCursor?: Record<string, unknown> }> {
  const { status, limit = 20, cursor } = options;
  
  const gsi2pk = `${KeyPrefix.USER}${userId}#DATE#${date}`;
  
  const expressionValues: Record<string, unknown> = {
    ':pk': gsi2pk,
  };
  
  const params: QueryCommandInput = {
    TableName: TABLE_NAME,
    IndexName: 'GSI2',
    KeyConditionExpression: 'GSI2PK = :pk',
    ExpressionAttributeValues: expressionValues,
    ScanIndexForward: false, // Newest first
    Limit: limit,
  };
  
  if (status) {
    params.FilterExpression = '#status = :status';
    params.ExpressionAttributeNames = { '#status': 'status' };
    expressionValues[':status'] = status;
  }
  
  if (cursor) {
    params.ExclusiveStartKey = cursor;
  }
  
  const result = await docClient.send(new QueryCommand(params));
  
  return {
    items: (result.Items ?? []) as ExecutionRecord[],
    nextCursor: result.LastEvaluatedKey,
  };
}

/**
 * Get a single execution by ID using GSI3
 * Note: GSI3 contains both executions and policies, so we filter by entity_type
 * Important: Don't use Limit with FilterExpression - DynamoDB applies Limit BEFORE filter,
 * so if all scanned items are policies, we'd get 0 results even if the execution exists.
 */
export async function getExecutionById(
  executionId: string
): Promise<ExecutionRecord | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI3',
      KeyConditionExpression: 'execution_id = :id',
      FilterExpression: 'entity_type = :entityType',
      ExpressionAttributeValues: {
        ':id': executionId,
        ':entityType': 'EXECUTION',
      },
    })
  );
  
  const items = result.Items ?? [];
  return items.length > 0 ? (items[0] as ExecutionRecord) : null;
}

/**
 * Get all policy results for an execution
 */
export async function getExecutionPolicies(
  executionId: string,
  options: {
    status?: 'success' | 'failed' | 'skipped';
    limit?: number;
    cursor?: Record<string, unknown>;
  } = {}
): Promise<{ items: PolicyResultRecord[]; nextCursor?: Record<string, unknown> }> {
  const { status, limit = 100, cursor } = options;
  
  const expressionValues: Record<string, unknown> = {
    ':pk': `${KeyPrefix.EXECUTION}${executionId}`,
    ':skPrefix': KeyPrefix.POLICY,
  };
  
  const params: QueryCommandInput = {
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: expressionValues,
    Limit: limit,
  };
  
  if (status) {
    params.FilterExpression = '#status = :status';
    params.ExpressionAttributeNames = { '#status': 'status' };
    expressionValues[':status'] = status;
  }
  
  if (cursor) {
    params.ExclusiveStartKey = cursor;
  }
  
  const result = await docClient.send(new QueryCommand(params));
  
  return {
    items: (result.Items || []) as PolicyResultRecord[],
    nextCursor: result.LastEvaluatedKey,
  };
}

/**
 * Get failed policies for an execution
 */
export async function getFailedPolicies(
  executionId: string
): Promise<PolicyResultRecord[]> {
  const result = await getExecutionPolicies(executionId, { status: 'failed' });
  return result.items;
}
