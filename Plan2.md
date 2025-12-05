# Plan: DynamoDB Local + Policy Processing Infrastructure

## Overview
Add DynamoDB Local for persistent storage of users, sessions, AST executions, and policy processing results. Extend Login AST to accept policy numbers and process each one.

---

## Steps

### 1. Add DynamoDB Local to Docker Compose
**File**: `infra/docker-compose.dev.yml`
- Add `dynamodb-local` service on port 8042
- Add volume for data persistence

### 2. Create DynamoDB Setup Script
**File**: `scripts/setup-dynamodb.sh`
- Create tables using AWS CLI:
  - `users` - User accounts
  - `sessions` - User sessions (terminal connections)
  - `ast_registry` - AST metadata (sync with frontend registry)
  - `ast_executions` - Running/completed AST instances
  - `policy_results` - Per-policy processing results

### 3. Add DynamoDB Python Client
**Files**:
- `gateway/src/db/__init__.py`
- `gateway/src/db/client.py` - DynamoDB client wrapper
- `gateway/src/db/models.py` - Pydantic models for tables
- `gateway/src/db/repositories/` - Repository pattern for each table

### 4. Define Table Schemas

**users**
| Attribute | Type | Key |
|-----------|------|-----|
| user_id | S | PK |
| email | S | GSI |
| created_at | S | |

**sessions**
| Attribute | Type | Key |
|-----------|------|-----|
| session_id | S | PK |
| user_id | S | GSI |
| status | S | |
| created_at | S | |
| last_activity | S | |

**ast_executions**
| Attribute | Type | Key |
|-----------|------|-----|
| execution_id | S | PK |
| session_id | S | GSI |
| ast_name | S | |
| status | S | |
| progress | N | (0-100) |
| total_items | N | |
| completed_items | N | |
| started_at | S | |
| completed_at | S | |
| params | M | |
| result | M | |

**policy_results**
| Attribute | Type | Key |
|-----------|------|-----|
| execution_id | S | PK |
| policy_number | S | SK |
| status | S | |
| started_at | S | |
| completed_at | S | |
| error | S | |
| screenshots | L | |

### 5. Update Login AST for Batch Processing
**File**: `gateway/src/ast/login.py`
- Accept `policy_numbers: list[str]` parameter
- Loop through each policy, login/logout
- Save per-policy results to DynamoDB
- Report progress via WebSocket messages

### 6. Add Progress Tracking to AST Base
**File**: `gateway/src/ast/base.py`
- Add `report_progress(current, total, message)` method
- Emit `ast.progress` WebSocket messages

### 7. Update Frontend Login Form
**File**: `apps/web/src/ast/login/LoginASTForm.tsx`
- Add textarea for policy numbers (comma or newline separated)
- Validate: alphanumeric, exactly 9 characters per policy number
- Show progress bar during execution (current/total with percentage)
- Display per-policy results in a scrollable list:
  - Policy number
  - Status icon (success/failed/pending)
  - Duration
  - Error message if failed

### 8. Add Progress Message Type
**Files**:
- `packages/shared/src/messages.ts` - Add `ast.progress` message type
- `gateway/src/models/ast.py` - Add Python equivalent

---

## Further Considerations

1. **AWS SDK vs boto3?** For Python, use `boto3` with endpoint override for local. For future Terraform, same code works with real DynamoDB.

2. **Progress granularity?** Send progress after each policy completes for real-time UI updates.

3. **Policy number format?** Alphanumeric, exactly 9 characters (e.g., "ABC123DEF", "POL456789"). Validate on frontend before submission.
