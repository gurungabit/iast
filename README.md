# Terminal Monorepo

A full-stack web-based terminal application that provides secure, real-time TN3270 terminal emulation through a browser. The architecture follows a microservices pattern with clear separation of concerns.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Browser (Client)                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                     React + Vite + xterm.js                             │ │
│  │  ┌────────────────┐  ┌──────────────┐  ┌────────────────────────────┐   │ │
│  │  │  Entra SSO     │  │ Theme Toggle │  │     Terminal Component     │   │ │
│  │  │  (MSAL)        │  │ (Light/Dark) │  │    (xterm.js + WebSocket)  │   │ │
│  │  └────────────────┘  └──────────────┘  └────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTP (REST) + WebSocket
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            API Server (Node.js)                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                      Fastify + @fastify/websocket                       │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐   │ │
│  │  │  Auth Routes │  │   Session    │  │    WebSocket Terminal        │   │ │
│  │  │ (Entra JWT)  │  │  Management  │  │       Handler                │   │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Pub/Sub (Redis Protocol)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Valkey (Redis-compatible)                           │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         Pub/Sub Channels                                │ │
│  │  ┌──────────────────┐  ┌─────────────────┐  ┌──────────────────────┐    │ │
│  │  │ gateway.control  │  │ tn3270.input.<id>│  │  tn3270.output.<id>  │    │ │
│  │  │ (session create) │  │ (user keystrokes)│  │  (TN3270 output)     │    │ │
│  │  └──────────────────┘  └─────────────────┘  └──────────────────────┘    │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Pub/Sub (Redis Protocol)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TN3270 Gateway (Python)                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                    asyncio + redis-py + tn3270                          │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐   │ │
│  │  │ Valkey Client│  │ TN3270 Manager│  │      TN3270 Sessions         │   │ │
│  │  │  (Pub/Sub)   │  │ (connect)    │  │   (TN3270 connections)       │   │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
terminal/
├── apps/
│   ├── api/                    # Fastify backend server
│   │   └── src/
│   │       ├── routes/         # HTTP endpoints (auth)
│   │       ├── ws/             # WebSocket handlers
│   │       ├── services/       # Business logic (auth, session)
│   │       ├── models/         # Data models (user)
│   │       └── valkey/         # Valkey pub/sub client
│   │
│   └── web/                    # React frontend
│       └── src/
│           ├── components/     # UI components (Terminal, LoginForm, etc.)
│           ├── hooks/          # React hooks (useAuth, useTerminal, useTheme)
│           ├── services/       # API client, WebSocket service
│           └── config/         # Frontend configuration
│
├── packages/
│   └── shared/                 # Shared TypeScript types & utilities
│       └── src/
│           ├── messages.ts     # Message envelope types
│           ├── channels.ts     # Pub/sub channel definitions
│           ├── errors.ts       # Error codes & types
│           ├── auth.ts         # Auth-related types
│           └── utils.ts        # Shared utilities
│
├── gateway/                    # Python TN3270 gateway
│   └── src/
│       ├── app.py              # Main entry point
│       ├── tn3270_manager.py   # TN3270 session management
│       ├── valkey_client.py    # Async Valkey client
│       ├── models.py           # Pydantic message models
│       ├── config.py           # Gateway configuration
│       ├── tn3270_client.py    # TN3270 protocol client
│
├── infra/
│   └── docker-compose.dev.yml  # Valkey container for development
│
├── scripts/
│   ├── dev.sh                  # Development startup script
│   ├── dev-session.sh          # Per-session gateway management (dev)
│   └── setup-dynamodb.sh       # DynamoDB setup script
│
├── docs/
│   ├── ARCHITECTURE.md         # Detailed architecture documentation
│   └── diagrams.md             # Additional diagrams
│
├── .github/
│   └── copilot-instructions.md # GitHub Copilot instructions
│
└── tnz/                        # Placeholder directory
```

## Prerequisites

- Node.js 24+
- pnpm 10+
- Python 3.12+
- uv (Python package manager)
- Docker (for Valkey and DynamoDB Local)

## Quick Start

```bash
# Install dependencies
pnpm install
cd gateway && uv sync && cd ..

# Start infrastructure (Valkey + DynamoDB)
docker compose -f infra/docker-compose.dev.yml up -d

# Start all services
pnpm dev

# Services will be available at:
# - Web:    http://localhost:5173
# - API:    http://localhost:3000
# - Valkey: localhost:6379
# - DynamoDB: localhost:8042
```

## Development

### Build All

```bash
pnpm build
```

### Lint

```bash
pnpm lint
```

### Type Check

```bash
pnpm typecheck
```

### Format Code

```bash
pnpm format
```

### Clean

```bash
pnpm clean
```

## Environment Variables

### API (`apps/api/.env`)

```env
PORT=3000
HOST=0.0.0.0
VALKEY_HOST=localhost
VALKEY_PORT=6379
ENTRA_CLIENT_ID=ec73238a-bce6-4243-ae66-b84deafcac1f
ENTRA_TENANT_ID=fa23982e-6646-4a33-a5c4-1a848d02fcc4
ENTRA_API_AUDIENCE=api://ec73238a-bce6-4243-ae66-b84deafcac1f
ENTRA_API_SCOPE=api://ec73238a-bce6-4243-ae66-b84deafcac1f/delegate
ENTRA_AUTHORITY_HOST=https://login.microsoftonline.com
DYNAMODB_ENDPOINT=http://localhost:8042
DYNAMODB_REGION=us-east-1
DYNAMODB_TABLE_NAME=terminal
DYNAMODB_ACCESS_KEY_ID=dummy
DYNAMODB_SECRET_ACCESS_KEY=dummy
```

### Web (`apps/web/.env`)

```env
VITE_API_BASE_URL=/api
VITE_WS_BASE_URL=ws://127.0.0.1:3001
VITE_ENTRA_CLIENT_ID=ec73238a-bce6-4243-ae66-b84deafcac1f
VITE_ENTRA_TENANT_ID=fa23982e-6646-4a33-a5c4-1a848d02fcc4
VITE_ENTRA_REDIRECT_URI=http://localhost:5173
VITE_ENTRA_API_SCOPE=api://ec73238a-bce6-4243-ae66-b84deafcac1f/delegate
```

### Gateway (`gateway/.env`)

```env
VALKEY_HOST=localhost
VALKEY_PORT=6379
TN3270_HOST=your-tn3270-host
TN3270_PORT=23
TN3270_MAX_SESSIONS=10
```

## Message Flow

1. User signs in with Entra via MSAL in the browser (PKCE)
2. Browser acquires an access token for the API scope
3. API validates the Entra access token and auto-provisions the user in DynamoDB
4. Browser opens a WebSocket to the API with the same access token
5. API publishes `session.create` to `gateway.control` Valkey channel
6. Gateway establishes TN3270 connection and subscribes to `tn3270.input.<sessionId>`
7. User types in browser terminal (xterm.js)
8. Web sends `data` message via WebSocket to API
9. API publishes to `tn3270.input.<sessionId>` Valkey channel
10. Gateway sends to TN3270 host
11. TN3270 output is received by Gateway
12. Gateway publishes to `tn3270.output.<sessionId>` Valkey channel
13. API forwards WebSocket messages to the browser for rendering

## Error Codes

| Code | Category | Description |
|------|----------|-------------|
| E1xxx | Auth | Authentication errors |
| E2xxx | Session | Session management errors |
| E3xxx | TN3270 | TN3270 connection errors |
| E4xxx | WebSocket | WebSocket errors |
| E5xxx | Valkey | Valkey/Redis errors |

## License
