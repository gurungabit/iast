
Below is a **Claude-optimized version** of your MASTER PROMPT TEMPLATE.
The content is the same in intent — but rewritten specifically for how **Claude prefers instruction structure**, clarity, hierarchy, and directive style.

This version removes ambiguity, uses strict imperatives, avoids verbosity, and phrases constraints in the way Claude responds best to for multi-file full-project generation.

---

# ✅ **CLAUDE-OPTIMIZED MASTER PROMPT TEMPLATE**

### (Use this as the top-level directive before Claude generates any code)

---

# **PROJECT BUILD DIRECTIVE — FOLLOW EXACTLY**

Build a complete, end-to-end full-stack application with the following structure and rules.

Claude must obey every instruction exactly as written.
Claude must generate **complete code files with no omissions** once asked.

---

# **1. MONOREPO STRUCTURE (MANDATORY)**

The workspace must follow this exact layout:

```
apps/
  web/        → React + Vite + TypeScript
  api/        → Fastify + TypeScript
packages/
  shared/     → Shared TS types and utilities
gateway/
  python/     → Python PTY gateway (Pydantic + UV)
infra/
  docker-compose.dev.yml
```

The workspace root must contain:

* `pnpm-workspace.yaml`
* `package.json` (workspace-level)
* root configs: `.editorconfig`, `.prettierrc`, `.eslintrc`, `.gitignore`, etc.

---

# **2. REQUIRED SCAFFOLDING STEPS (MANDATORY)**

Claude must scaffold the project using CLI commands, not manually:

### **Frontend scaffold**

```
pnpm create vite apps/web --template react-ts
```

### **Backend scaffold**

```
pnpm dlx @fastify/cli generate apps/api
```

### **Python gateway**

* Placed in: `gateway/python`
* Environment created and executed using **UV (Astral)**
* Gateway run command:

```
uv run gateway/python:app --reload
```

### **Workspace**

* Managed with **pnpm**
* All packages are part of the monorepo

---

# **3. SYSTEM COMPONENTS AND RESPONSIBILITIES**

## **3.1 Frontend (`apps/web`)**

* React + Vite + TypeScript
* Uses xterm.js for interactive terminal
* Implements:

  * WebSocket client (strongly typed)
  * Hooks for input/resize/output
  * Terminal component
  * UI must import message types from `packages/shared`
* No inline WebSocket logic in JSX
* No `any` anywhere

Required folder layout:

```
src/components/
src/hooks/
src/services/
src/types/
src/utils/
src/config/
```

---

## **3.2 Backend (`apps/api`)**

* Fastify + TypeScript
* Provides WebSocket endpoint
* Publishes UI keystrokes → Valkey
* Subscribes to Valkey PTY output → UI
* Must import shared message types
* Strict discriminated unions everywhere
* No `any`

Required folder layout:

```
src/server/
src/ws/
src/valkey/
src/services/
src/models/
src/config/
src/utils/
```

---

## **3.3 Shared types (`packages/shared`)**

This package is the **single source of truth** for:

* Channel names
* Message envelope definition
* All message type discriminators
* Input/output message schemas
* Shared utilities

Both frontend and backend must import types from here.

No `any`.

---

## **3.4 Python Gateway (`gateway/python`)**

* Must run under **UV**
* Must use **Pydantic v2** for all message models
* Responsibilities:

  * Subscribe: `pty.input.<sessionId>`
  * Publish: `pty.output.<sessionId>`
  * Manage PTYs (spawn, resize, close)
  * Validate all messages with Pydantic
  * Async pub/sub Valkey client

Required folder layout:

```
gateway/python/
  domain/
  services/
  transport/
  models/
  config/
  utils/
  app.py
```

All message structures must match shared TS types exactly.

---

# **4. VALKEY PUB/SUB MODEL**

Channel naming (fixed):

```
pty.input.<sessionId>
pty.output.<sessionId>
pty.control.<sessionId>
sessions.events
```

Message envelope (mandatory fields):

* `type`
* `sessionId`
* `payload`
* `timestamp`
* `encoding`
* `seq`
* `meta`

Shared types in `packages/shared` define these.

---

# **5. CODING STANDARDS**

## **TypeScript rules**

* `"strict": true`
* `"noImplicitAny": true`
* No `any` anywhere
* Use discriminated unions for all message schemas
* No logic duplication
* All WS and Valkey logic must be modular, not inline

## **Python rules**

* Must use **Pydantic v2**
* All gateway configuration must use `BaseSettings`
* All messages parsed/validated by Pydantic
* No raw dict handling
* PTY logic isolated in a dedicated service class

## **Architectural rules**

* Clear separation: transport / domain / services / models / config
* No hardcoded strings
* All constants/config extracted
* Shared code centralized in `packages/shared`

---

# **6. CLAUDE MUST FOLLOW THESE BUILD STEPS IN ORDER**

### **Step 1 — Generate monorepo root**

* Workspace config
* root package.json
* linting & formatting configs
* docker-compose.dev.yml

### **Step 2 — Scaffold frontend and backend using CLI commands**

Claude must reflect the results of these scaffolds inside the generated code.

### **Step 3 — Implement `packages/shared`**

* All types
* Channel constants
* Message envelopes
* Utility helpers

### **Step 4 — Implement Python gateway**

* Pydantic models
* Valkey pub/sub client
* PTY manager
* Input → PTY → Output pipeline
* App entrypoint running via UV

### **Step 5 — Implement backend**

* Fastify server
* WebSocket handler
* Valkey client
* Session manager
* Message routing
* Strict typing

### **Step 6 — Implement frontend**

* WebSocket client service
* xterm.js integration
* Hooks
* Terminal component
* Resize + input sync
* Typed streaming output

### **Step 7 — Integration validation**

Ensure round-trip message flow works:

```
web → api → valkey → gateway → pty
pty → gateway → valkey → api → web
```

### **Step 8 — Hardening**

* Reconnect logic
* Heartbeats
* Structured errors
* Logging
* Cleanup logic
* Input/output buffering

---
