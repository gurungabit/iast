#!/bin/bash
# ============================================================================
# DynamoDB Local Setup Script
# ============================================================================
# Creates the single table for the terminal application.
# Run this once after starting DynamoDB Local.
#
# Usage: ./scripts/setup-dynamodb.sh
#
# Single Table Design:
# ====================
# PK                    SK                        Entity
# ──────────────────────────────────────────────────────────
# USER#<userId>         PROFILE                   User profile
# USER#<userId>         SESSION#<sessionId>       User's session
# SESSION#<sessionId>   EXECUTION#<execId>        Session's AST execution
# EXECUTION#<execId>    POLICY#<policyNum>        Execution's policy result
#
# GSI1 (email-index): GSI1PK=email for user lookup by email
# ============================================================================

set -e

ENDPOINT_URL="${DYNAMODB_ENDPOINT:-http://localhost:8042}"
REGION="${AWS_REGION:-us-east-1}"
TABLE_NAME="${TABLE_NAME:-terminal}"

# DynamoDB Local requires dummy credentials
export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-dummy}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-dummy}"

echo "🔧 Setting up DynamoDB Local at $ENDPOINT_URL"
echo ""

# Common AWS CLI options
AWS_OPTS="--endpoint-url $ENDPOINT_URL --region $REGION"

# ---------------------------------------------------------------------------
# Single Table: terminal
# ---------------------------------------------------------------------------
echo "📦 Creating table: $TABLE_NAME"
if aws dynamodb describe-table $AWS_OPTS --table-name "$TABLE_NAME" > /dev/null 2>&1; then
  echo "   ⏭️  Table already exists, skipping"
else
  aws dynamodb create-table $AWS_OPTS \
    --table-name "$TABLE_NAME" \
    --key-schema \
      'AttributeName=PK,KeyType=HASH' \
      'AttributeName=SK,KeyType=RANGE' \
    --attribute-definitions \
      'AttributeName=PK,AttributeType=S' \
      'AttributeName=SK,AttributeType=S' \
      'AttributeName=GSI1PK,AttributeType=S' \
    --billing-mode PAY_PER_REQUEST \
    --global-secondary-indexes '[
      {
        "IndexName": "GSI1",
        "KeySchema": [
          {"AttributeName": "GSI1PK", "KeyType": "HASH"},
          {"AttributeName": "SK", "KeyType": "RANGE"}
        ],
        "Projection": {"ProjectionType": "ALL"}
      }
    ]' \
    > /dev/null
  echo "   ✅ Created"
fi

echo ""
echo "✅ DynamoDB setup complete!"
echo ""

# List all tables
echo "📋 Tables:"
aws dynamodb list-tables $AWS_OPTS --no-cli-pager --query 'TableNames[]' --output text | tr '\t' '\n' | sed 's/^/   - /'
