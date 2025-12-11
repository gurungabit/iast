# IAST - Interactive Automated Streamlined Terminal

A web-based TN3270 terminal emulator with automation capabilities for IBM mainframe systems. Features real-time terminal emulation, Azure Entra ID authentication, and Automated Streamlined Transactions (ASTs).

## Quick Start

```bash
# Prerequisites check
node --version  # >= 24.0.0
pnpm --version  # >= 10.0.0
python --version  # >= 3.12
uv --version  # any recent version
docker --version  # for local infrastructure

# Clone and setup
git clone <>
cd iast

# Install all dependencies
pnpm install
cd gateway && uv sync && cd ..

# Start everything (infrastructure + all services)
pnpm dev
```

**Services:**

| Service | URL | Description |
|---------|-----|-------------|
| Web | `http://localhost:5173` | React frontend |
| API | `http://localhost:3000` | Fastify API server |
| Valkey | `localhost:6379` | Message broker |
| DynamoDB | `localhost:8042` | Local database |

---

## Prerequisites

### Required

| Tool | Version | Installation |
|------|---------|--------------|
| **Node.js** | >= 24.0.0 | [nodejs.org](https://nodejs.org) or `nvm install 24` |
| **pnpm** | >= 10.0.0 | `corepack enable && corepack prepare pnpm@latest --activate` |
| **Python** | >= 3.12 | [python.org](https://python.org) or `pyenv install 3.12` |
| **uv** | latest | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| **Docker** | latest | [docker.com](https://docker.com) |

### Optional

| Tool | Purpose |
|------|---------|
| **Hercules** | Local mainframe emulator for testing |
| **VPN** | Access to real mainframe systems |

---

## Development Setup

### 1. Install Dependencies

```bash
# TypeScript packages (pnpm workspaces)
pnpm install

# Python gateway
cd gateway && uv sync && cd ..
```

### 2. Configure Environment

Copy environment templates:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp gateway/.env.example gateway/.env
```

**API Server (`apps/api/.env`):**

```env
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info

# Valkey
VALKEY_HOST=localhost
VALKEY_PORT=6379

# DynamoDB Local
DYNAMODB_ENDPOINT=http://localhost:8042
DYNAMODB_REGION=us-east-1
DYNAMODB_TABLE_NAME=terminal
DYNAMODB_ACCESS_KEY_ID=dummy
DYNAMODB_SECRET_ACCESS_KEY=dummy

# Azure Entra ID
ENTRA_TENANT_ID=your-tenant-id
ENTRA_CLIENT_ID=your-api-client-id
ENTRA_AUDIENCE=api://your-api-client-id
```

**Web Frontend (`apps/web/.env`):**

```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000

# Azure Entra ID (SPA)
VITE_ENTRA_CLIENT_ID=your-spa-client-id
VITE_ENTRA_TENANT_ID=your-tenant-id
VITE_ENTRA_REDIRECT_URI=http://localhost:5173
VITE_ENTRA_API_SCOPE=api://your-api-client-id/.default
```

**Gateway (`gateway/.env`):**

```env
VALKEY_HOST=localhost
VALKEY_PORT=6379

# TN3270 Mainframe
TN3270_HOST=mainframe.example.com
TN3270_PORT=23
TN3270_MAX_SESSIONS=10

# DynamoDB
DYNAMODB_ENDPOINT=http://localhost:8042
DYNAMODB_REGION=us-east-1
DYNAMODB_TABLE_NAME=terminal
DYNAMODB_ACCESS_KEY_ID=dummy
DYNAMODB_SECRET_ACCESS_KEY=dummy
```

### 3. Start Development

```bash
# Start everything (recommended)
pnpm dev

# Or start components individually:
pnpm dev:valkey    # Infrastructure (Valkey + DynamoDB)
pnpm dev:api       # API server only
pnpm dev:web       # Frontend only
pnpm dev:gateway   # Python gateway only
```

---

## Development Commands

### Running Services

```bash
pnpm dev              # Start all services + infrastructure
pnpm app              # Start all services (infrastructure must be running)
pnpm dev:web          # React frontend (localhost:5173)
pnpm dev:api          # API server (localhost:3000)
pnpm dev:gateway      # Python gateway
pnpm dev:valkey       # Start Valkey + DynamoDB containers
pnpm dev:valkey:stop  # Stop infrastructure containers
```

### Code Quality

```bash
pnpm typecheck        # TypeScript type checking
pnpm lint             # ESLint (strict mode)
pnpm format           # Prettier formatting
pnpm build            # Build all packages
pnpm clean            # Clean all build artifacts
```

### Gateway (Python)

```bash
pnpm test:gateway     # Run pytest tests
pnpm coverage:gateway # Run tests with coverage
cd gateway && uv run gateway-format  # Format Python code
```

### Workspace Commands

```bash
# Add dependency to specific workspace
pnpm --filter @terminal/api add <package>
pnpm --filter @terminal/web add -D <package>

# Run command in specific workspace
pnpm --filter @terminal/api <script>

# Run across all workspaces
pnpm run --recursive <script>
```

---

## Project Structure

```text
iast/
├── apps/
│   ├── api/                    # Node.js API server (Fastify)
│   │   └── src/
│   │       ├── routes/         # HTTP endpoints
│   │       ├── ws/             # WebSocket handlers
│   │       ├── services/       # Business logic
│   │       └── valkey/         # Pub/sub client
│   │
│   └── web/                    # React frontend (Vite)
│       └── src/
│           ├── components/     # UI components
│           ├── hooks/          # React hooks
│           ├── routes/         # Page components
│           ├── stores/         # Zustand stores
│           └── services/       # API/WebSocket clients
│
├── packages/
│   └── shared/                 # Shared TypeScript types
│       └── src/
│           ├── messages.ts     # Message envelope types
│           ├── channels.ts     # Pub/sub channels
│           └── errors.ts       # Error codes
│
├── gateway/                    # Python TN3270 gateway
│   └── src/
│       ├── app.py              # Entry point
│       ├── services/           # TN3270, Valkey services
│       ├── core/               # AST framework
│       └── models/             # Pydantic models
│
├── infra/                      # Docker compose files
├── scripts/                    # Dev scripts
└── docs/                       # Architecture documentation
```

---

## Architecture

```text
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│  API Server │────▶│   Valkey    │────▶│   Gateway   │
│  (React +   │ WS  │  (Fastify)  │ P/S │  (Pub/Sub)  │ P/S │  (Python)   │
│  xterm.js)  │◀────│             │◀────│             │◀────│             │
└─────────────┘     └─────────────┘     └─────────────┘     └──────┬──────┘
                                                                    │ TN3270
                                                                    ▼
                                                            ┌─────────────┐
                                                            │  Mainframe  │
                                                            │   (z/OS)    │
                                                            └─────────────┘
```

**Data Flow:**

1. User types in browser terminal (xterm.js)
2. WebSocket sends keystrokes to API server
3. API publishes to Valkey channel `tn3270.input.<sessionId>`
4. Gateway receives and sends TN3270 commands to mainframe
5. Mainframe responds with screen data
6. Gateway renders to ANSI and publishes to `tn3270.output.<sessionId>`
7. API forwards via WebSocket to browser
8. xterm.js renders the terminal output

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Vite 7, TypeScript, xterm.js, TanStack Router, Zustand, Tailwind CSS v4 |
| **API Server** | Node.js 24, Fastify 5, TypeScript, ioredis, jose |
| **Gateway** | Python 3.12, asyncio, tnz, redis-py, Pydantic, structlog |
| **Message Broker** | Valkey (Redis-compatible) |
| **Database** | DynamoDB (single-table design) |
| **Auth** | Azure Entra ID (OAuth 2.0 + JWT) |

---

## Documentation

- [Architecture Guide](./docs/ARCHITECTURE.md) - Detailed system architecture
- [AWS Deployment](./docs/AWS_DEPLOYMENT.md) - Production deployment guide
- [Diagrams](./docs/diagrams.md) - Visual architecture diagrams
- [Copilot Instructions](./.github/copilot-instructions.md) - AI coding guidelines

---

## Troubleshooting

### Common Issues

**pnpm not found:**

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

**uv not found:**

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.bashrc  # or ~/.zshrc
```

**Docker containers won't start:**

```bash
# Check if ports are in use
lsof -i :6379  # Valkey
lsof -i :8042  # DynamoDB

# Force recreate containers
docker compose -f infra/docker-compose.dev.yml down -v
docker compose -f infra/docker-compose.dev.yml up -d
```

**TypeScript errors after update:**

```bash
pnpm clean
pnpm install
pnpm typecheck
```

**Python import errors:**

```bash
cd gateway
uv sync --reinstall
```

---
