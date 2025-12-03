# Terminal Monorepo

A full-stack web-based terminal application with React/Vite frontend, Fastify backend, and Python PTY gateway, connected via Valkey pub/sub.

## Architecture

```text
┌─────────────┐     WebSocket      ┌─────────────┐     Valkey      ┌─────────────┐
│   Browser   │ ◄─────────────────► │   API       │ ◄─────────────► │   Gateway   │
│   (xterm)   │                    │   (Fastify) │   Pub/Sub      │   (Python)  │
└─────────────┘                    └─────────────┘                 └──────┬──────┘
                                                                          │
                                                                          │ PTY
                                                                          ▼
                                                                   ┌─────────────┐
                                                                   │   Shell     │
                                                                   │   (zsh)     │
                                                                   └─────────────┘
```

## Project Structure

```text
terminal/
├── apps/
│   ├── web/          # React + Vite + xterm.js frontend
│   └── api/          # Fastify + WebSocket backend
├── packages/
│   └── shared/       # Shared TypeScript types (source-only)
├── gateway/          # Python PTY gateway
└── infra/            # Docker compose for development
```

## Prerequisites

- Node.js >= 24
- pnpm >= 10
- Python >= 3.12
- Docker (for Valkey)
- uv (Python package manager)

## Quick Start

### 1. Install Dependencies

```bash
# Install Node.js dependencies
pnpm install

# Install Python dependencies
cd gateway
uv sync
cd ..
```

### 2. Start Infrastructure

```bash
# Start Valkey (Redis-compatible)
docker compose -f infra/docker-compose.dev.yml up -d
```

### 3. Start Services

In separate terminals:

```bash
# Terminal 1: Start API server
pnpm --filter @terminal/api dev

# Terminal 2: Start web frontend
pnpm --filter @terminal/web dev

# Terminal 3: Start Python gateway
cd gateway
uv run gateway
```

### 4. Open Browser

Navigate to <http://localhost:5173>

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
pnpm type-check
```

## Environment Variables

### API (`apps/api/.env`)

```env
PORT=3000
HOST=0.0.0.0
VALKEY_HOST=localhost
VALKEY_PORT=6379
JWT_SECRET=your-secret-key
```

### Web (`apps/web/.env`)

```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

### Gateway (`gateway/.env`)

```env
VALKEY_HOST=localhost
VALKEY_PORT=6379
PTY_SHELL=/bin/zsh
PTY_MAX_SESSIONS=10
```

## Message Flow

1. User types in browser terminal (xterm.js)
2. Web sends `data` message via WebSocket to API
3. API publishes to `pty.input.<sessionId>` Valkey channel
4. Gateway subscribes and writes to PTY
5. PTY output is read by Gateway
6. Gateway publishes to `pty.output.<sessionId>` Valkey channel
7. API subscribes and forwards via WebSocket
8. Web receives and renders in xterm.js

## Error Codes

| Code | Category | Description |
|------|----------|-------------|
| E1xxx | Auth | Authentication errors |
| E2xxx | Session | Session management errors |
| E3xxx | PTY | PTY process errors |
| E4xxx | WebSocket | WebSocket errors |
| E5xxx | Valkey | Valkey/Redis errors |

## License

MIT
