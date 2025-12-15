# Lambda Scheduler

EventBridge-triggered Lambda function to run scheduled AST jobs.

## How it Works

1. EventBridge triggers this Lambda at the scheduled time
2. Lambda calls `POST /schedules/:id/run` on the API
3. API creates a session and starts the AST execution
4. User can connect to the terminal to watch the job

## Environment Variables

| Variable | Description |
|----------|-------------|
| `API_BASE_URL` | Base URL of the API (e.g., `https://api.example.com`) |
| `API_TOKEN` | Service account token for authentication |

## Event Format

EventBridge sends events with this structure:

```json
{
  "detail-type": "Scheduled AST Run",
  "source": "terminal.scheduler",
  "detail": {
    "scheduleId": "abc123",
    "userId": "user-456"
  }
}
```

## Build & Package

```bash
# From this directory
pnpm install
pnpm package   # Builds with esbuild and creates lambda-scheduler.zip

# OR from monorepo root
pnpm lambda:package
```

## Deploy

Upload `lambda-scheduler.zip` to AWS Lambda with:

- Runtime: Node.js 20.x
- Handler: `index.handler`
- Memory: 128 MB (minimal, just HTTP calls)
- Timeout: 30 seconds

## IAM Permissions

The Lambda execution role needs:

- Basic Lambda execution (CloudWatch Logs)
- No special AWS permissions (just calls HTTP API)
