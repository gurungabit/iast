# IAST Project Guidelines

## Documentation & Context

Always use Context7 MCP tools when generating code, setup/configuration steps, or library/API documentation. Automatically resolve library IDs and fetch docs without explicit requests.

---

## Project Structure

```
terminal/
├── apps/
│   ├── api/          # Node.js API server (Fastify)
│   └── web/          # React frontend (Vite)
├── packages/
│   └── shared/       # Shared TypeScript types
├── gateway/          # Python TN3270 gateway
├── infra/            # Docker compose files
├── scripts/          # Dev scripts
└── docs/             # Architecture documentation
```

**Monorepo:** pnpm workspaces for TypeScript, uv for Python gateway.

---

## Package Managers

### TypeScript/JavaScript: pnpm

- **Version:** pnpm >= 10.0.0
- **Node:** >= 24.0.0
- **Always use pnpm**, never npm or yarn

```bash
# Install dependencies
pnpm install

# Add dependency to specific workspace
pnpm --filter @terminal/api add <package>
pnpm --filter @terminal/web add -D <package>

# Run workspace scripts
pnpm --filter @terminal/api dev
pnpm --filter @terminal/web build

# Run all workspaces
pnpm run --recursive build
pnpm run --recursive typecheck
```

### Python: uv

- **Version:** Python >= 3.12
- **Always use uv**, never pip directly

```bash
# Run gateway
cd gateway && uv run gateway

# Run tests
cd gateway && uv run gateway-tests

# Run with coverage
cd gateway && uv run gateway-coverage

# Add dependency (edit pyproject.toml, then sync)
uv sync
```

---

## TypeScript Coding Standards

### Strict Type Checking

All TypeScript code uses strict mode with maximum type safety:

```jsonc
// tsconfig.base.json settings - DO NOT RELAX
{
  "strict": true,
  "noImplicitAny": true,
  "noImplicitReturns": true,
  "noImplicitThis": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noFallthroughCasesInSwitch": true,
  "strictNullChecks": true,
  "strictFunctionTypes": true,
  "strictBindCallApply": true,
  "strictPropertyInitialization": true
}
```

### ESLint Rules (Enforced)

```typescript
// ❌ NEVER use 'any'
const data: any = {};  // Error

// ✅ Use proper types or 'unknown'
const data: unknown = {};
const data: Record<string, unknown> = {};

// ❌ NEVER ignore floating promises
fetchData();  // Error

// ✅ Always await or void promises
await fetchData();
void fetchData();

// ❌ NEVER use regular imports for types
import { MyType } from './types';  // Warning

// ✅ Use type imports
import type { MyType } from './types';

// ✅ Explicit return types (warning if missing)
function getData(): string {
  return 'data';
}

// ✅ Prefix unused params with underscore
function handler(_req: Request, res: Response): void {
  res.send('ok');
}
```

### Code Style

- **Formatting:** Prettier (auto-format on save)
- **Imports:** Use type imports for types only
- **Async:** Always handle promises properly
- **Exports:** Prefer named exports over default

---

## Python Coding Standards

### Type Hints (Required)

All Python code must have type hints. Pyright in "standard" mode.

```python
# ✅ Always type function signatures
def process_message(data: dict[str, Any], session_id: str) -> bool:
    ...

# ✅ Use Pydantic for data models
from pydantic import BaseModel

class SessionConfig(BaseModel):
    host: str
    port: int = 23
    timeout: float = 30.0

# ✅ Type class attributes
class TN3270Session:
    session_id: str
    host: Host
    _buffer: list[str]
    
    def __init__(self, session_id: str, host: Host) -> None:
        self.session_id = session_id
        self.host = host
        self._buffer = []
```

### Linting (Ruff)

```python
# Rules enforced: E, F, W, I, N, UP, ANN, B, C4, SIM

# ❌ Missing type annotations
def process(data):  # Error: ANN
    pass

# ✅ Proper annotations
def process(data: bytes) -> str:
    return data.decode()

# ❌ Unused imports
import os  # Error: F401

# ✅ Import sorting (isort style)
from collections.abc import Callable
from typing import Any

import structlog
from pydantic import BaseModel

from src.core.config import settings
```

### Code Style

- **Line length:** 100 characters
- **Formatter:** Black (via ruff)
- **Imports:** Sorted with ruff (isort rules)
- **Logging:** Use structlog, never print()

---

## Architecture Patterns

### Message Protocol

All WebSocket/Pub-Sub messages use typed envelopes:

```typescript
// packages/shared/src/messages.ts
interface MessageEnvelope {
  type: MessageType;      // Discriminated union
  sessionId: string;
  timestamp: number;
  encoding: 'utf-8' | 'base64';
  seq: number;
  payload: string;
  meta?: Record<string, unknown>;
}
```

### Channel Naming

```typescript
// Valkey pub/sub channels
const CHANNELS = {
  TN3270_INPUT: 'tn3270.input.<sessionId>',   // Browser → Gateway
  TN3270_OUTPUT: 'tn3270.output.<sessionId>', // Gateway → Browser
  TN3270_CONTROL: 'tn3270.control',
  GATEWAY_CONTROL: 'gateway.control',
};
```

### Error Handling

```typescript
// Use typed error codes
const ERROR_CODES = {
  AUTH_REQUIRED: 'AUTH_001',
  SESSION_NOT_FOUND: 'SESSION_001',
  // ...
} as const;

// Throw with context
throw new AppError(ERROR_CODES.SESSION_NOT_FOUND, { sessionId });
```

---

## Development Commands

```bash
# Start everything (recommended)
pnpm dev

# Start just the app (no infra)
pnpm app

# Individual services
pnpm dev:web          # React frontend (localhost:5173)
pnpm dev:api          # API server (localhost:3000)
pnpm dev:gateway      # Python gateway
pnpm dev:valkey       # Start Valkey + DynamoDB containers

# Quality checks
pnpm typecheck        # TypeScript type checking
pnpm lint             # ESLint
pnpm format           # Prettier

# Gateway tests
pnpm test:gateway     # Run Python tests
pnpm coverage:gateway # With coverage report
```

---

## File Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| React Components | PascalCase | `Terminal.tsx`, `TabManager.tsx` |
| Hooks | camelCase with use prefix | `useTerminal.ts`, `useAuth.ts` |
| Utilities | camelCase | `formatDate.ts`, `parseMessage.ts` |
| Types/Interfaces | PascalCase | `SessionConfig.ts`, `MessageTypes.ts` |
| Python modules | snake_case | `session_manager.py`, `valkey_client.py` |
| Python classes | PascalCase | `TN3270Manager`, `ASTExecutor` |

---

## Key Libraries

### Frontend (apps/web)

- **React 19** - UI framework
- **Vite 7** - Build tool
- **xterm.js** - Terminal emulation
- **TanStack Router** - Routing
- **Zustand** - State management
- **MSAL.js** - Azure AD auth
- **Tailwind CSS v4** - Styling

### API (apps/api)

- **Fastify 5** - HTTP server
- **ioredis** - Valkey client
- **jose** - JWT validation
- **AWS SDK v3** - DynamoDB

### Gateway (gateway)

- **asyncio** - Async runtime
- **tnz** - TN3270 emulation
- **redis-py** - Valkey client
- **Pydantic** - Data validation
- **structlog** - Structured logging
- **boto3** - AWS SDK

---

## Important Notes

1. **Never relax TypeScript strict mode** - All strict flags must remain enabled
2. **Never use `any`** - Use `unknown` and narrow types properly
3. **Always await promises** - No floating promises allowed
4. **Use pnpm for JS/TS** - Never npm or yarn
5. **Use uv for Python** - Never pip directly
6. **Type everything** - Both TypeScript and Python require full type coverage
7. **Shared types live in `packages/shared`** - Don't duplicate type definitions
8. **Gateway cannot use containers in prod** - EC2 only due to long-lived TCP connections