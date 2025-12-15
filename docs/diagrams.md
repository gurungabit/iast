# IAST Architecture Diagrams

Detailed architecture diagrams for the IAST (Interactive Automated Streamlined Terminal) system.

## Table of Contents

1. [System Topology](#system-topology)
2. [Component Architecture](#component-architecture)
3. [Data Flow Diagrams](#data-flow-diagrams)
4. [Deployment Architecture](#deployment-architecture)

---

## System Topology

### High-Level Architecture

```mermaid
flowchart TB
    subgraph Internet["Internet Zone"]
        Users["👥 Users"]
    end

    subgraph AWS["AWS Cloud"]
        subgraph Public["Public Subnet"]
            ALB["⚖️ Application Load Balancer"]
        end

        subgraph Private["Private Subnet"]
            subgraph ROSACluster["ROSA Cluster"]
                API1["⚡ API Pod 1"]
                API2["⚡ API Pod 2"]
            end

            subgraph GatewayLayer["Gateway (ROSA or EC2)"]
                GW1["🐍 Gateway 1"]
                GW2["🐍 Gateway 2"]
            end
        end

        subgraph Data["Data Layer"]
            DDB["🗄️ DynamoDB"]
        end
    end

    subgraph OnPrem["On-Premises"]
        Mainframe["🖥️ IBM Mainframe"]
    end

    subgraph Auth["Identity Provider"]
        Entra["🔐 Azure Entra ID"]
    end

    Users -->|"HTTPS/WSS"| ALB
    ALB --> API1 & API2
    
    API1 -->|"WS Bridge"| GW1
    API2 -->|"WS Bridge"| GW2
    
    API1 & API2 --> DDB
    GW1 & GW2 --> DDB
    GW1 & GW2 -->|"TN3270"| Mainframe
    
    Users -.->|"OAuth 2.0"| Entra
    API1 & API2 -.->|"JWT Validation"| Entra
```

### WebSocket Bridge Pattern

```mermaid
flowchart LR
    subgraph Browser
        WS1["WebSocket Client"]
    end
    
    subgraph API["API Server"]
        Handler["WS Handler<br>/terminal/:sessionId"]
        Bridge["Bridge Module"]
        Router["Gateway Router"]
    end
    
    subgraph Gateway
        GWWS["WebSocket Server<br>port 8765"]
        TN3270["TN3270 Manager"]
    end
    
    WS1 <-->|"WSS"| Handler
    Handler --> Router
    Router -->|"Lookup"| DDB[(DynamoDB)]
    Router --> Bridge
    Handler <--> Bridge
    Bridge <-->|"WS"| GWWS
    GWWS <--> TN3270
```

**Key Points:**

- API server acts as a transparent bridge - no message transformation
- Each browser session is bound to one gateway instance (sticky session)
- Gateway mapping stored in DynamoDB for routing

---

## Component Architecture

### Frontend Components

```mermaid
flowchart TB
    subgraph React["React Application"]
        subgraph Pages
            TerminalPage["Terminal Page<br>(routes/index.tsx)"]
            HistoryPage["History Page<br>(routes/history)"]
        end
        
        subgraph Components
            Terminal["Terminal<br>(xterm.js)"]
            ASTPanel["AST Panel"]
            TabBar["Session Tabs"]
        end
        
        subgraph Stores
            SessionStore["Session Store<br>(WebSocket, Screen)"]
            ASTStore["AST Store<br>(Per-Tab State)"]
        end
        
        subgraph Hooks
            useTerminal["useTerminal"]
            useAST["useAST"]
        end
    end
    
    TerminalPage --> Terminal
    TerminalPage --> ASTPanel
    TerminalPage --> TabBar
    
    Terminal --> useTerminal
    ASTPanel --> useAST
    
    useTerminal --> SessionStore
    useAST --> ASTStore
```

### Gateway Components

```mermaid
flowchart TB
    subgraph Gateway["Python Gateway"]
        subgraph Network
            WSServer["WebSocket Server<br>(websockets)"]
        end
        
        subgraph TN3270Service["TN3270 Service"]
            Manager["Session Manager"]
            Sessions["Active Sessions"]
            Host["Host Interface<br>(tnz)"]
            Renderer["ANSI Renderer"]
        end
        
        subgraph AST["AST Framework"]
            Runner["AST Runner"]
            Executor["Executor<br>(Parallel/Sequential)"]
            Persistence["Result Persistence"]
        end
        
        subgraph Database
            DDB["DynamoDB Client"]
        end
    end
    
    WSServer --> Manager
    Manager --> Sessions
    Sessions --> Host
    Host --> Renderer
    
    Manager --> Runner
    Runner --> Executor
    Executor --> Persistence
    Persistence --> DDB
```

---

## Data Flow Diagrams

### Terminal Connection Flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant A as API Server
    participant DB as DynamoDB
    participant G as Gateway
    participant M as Mainframe

    B->>A: WS Connect /terminal/{sessionId}
    A->>DB: Get gateway mapping
    alt No mapping exists
        A->>DB: Create mapping (current gateway)
    end
    A->>G: WS Connect /{sessionId}
    G->>G: Create TN3270 session
    G->>M: TN3270 Connect
    M->>G: Initial screen
    G->>G: Render to ANSI
    G->>A: WS: {type: "tn3270.screen"}
    A->>B: Forward
```

### Keyboard Input Flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant A as API (Bridge)
    participant G as Gateway
    participant M as Mainframe

    B->>A: WS: {type: "data", payload: "HERC01"}
    A->>G: Forward (unchanged)
    G->>G: Buffer input
    
    B->>A: WS: {type: "data", payload: "\r"}  
    Note over B,A: Enter key
    A->>G: Forward
    G->>M: Send AID + Buffer
    M->>G: New 3270 screen
    G->>G: Render to ANSI
    G->>A: WS: {type: "tn3270.screen", ...}
    A->>B: Forward
```

### AST Execution Flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant A as API (Bridge)
    participant G as Gateway
    participant DB as DynamoDB
    participant M as Mainframe

    B->>A: WS: {type: "ast.run", meta: {astName: "login", params: {...}}}
    A->>G: Forward
    
    G->>DB: Create execution record
    G->>B: WS: {type: "ast.status", meta: {status: "running"}}

    loop For each policy
        G->>M: Navigate, input, submit
        M->>G: Response screens
        G->>G: Extract result
        G->>DB: Save policy result
        G->>A: WS: {type: "ast.item_result", ...}
        A->>B: Forward
        G->>A: WS: {type: "ast.progress", ...}
        A->>B: Forward
    end

    G->>DB: Update execution (completed)
    G->>A: WS: {type: "ast.status", meta: {status: "completed"}}
    A->>B: Forward
```

### Pause/Resume Flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant G as Gateway

    Note over B,G: AST is running...
    
    B->>G: WS: {type: "ast.control", meta: {action: "pause"}}
    G->>G: Set pause flag
    Note over G: Complete current item
    G->>B: WS: {type: "ast.paused", meta: {paused: true}}
    Note over B,G: User can interact with terminal
    
    B->>G: WS: {type: "ast.control", meta: {action: "resume"}}
    G->>G: Clear pause flag
    G->>B: WS: {type: "ast.paused", meta: {paused: false}}
    Note over G: Continue with next item
```

### Session Expiry Flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant A as API
    participant G as Gateway

    Note over B,G: User closes browser/tab
    B->>A: WS Close
    A->>G: WS Close
    
    Note over G: Start 60s grace period
    
    alt User reconnects within 60s
        B->>A: WS Connect
        A->>G: WS Connect
        G->>G: Cancel destruction
        G->>B: Resume session
    else 60s expires
        G->>G: Destroy TN3270 session
    end
    
    Note over B,G: Later, user tries to reconnect
    B->>A: WS Connect
    A->>G: WS Connect
    B->>G: WS: {type: "data", payload: "x"}
    G->>B: WS: {type: "error", meta: {code: "SESSION_EXPIRED"}}
    B->>B: Show "Session Expired" modal
```

### Scheduled AST Flow

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant API as API Server
    participant DB as DynamoDB
    participant EB as EventBridge Scheduler
    participant Lambda as Lambda
    participant GW as Gateway
    participant M as Mainframe

    Note over U,M: 1. User Schedules an AST
    U->>FE: Select "Schedule for Later"
    U->>FE: Pick date/time + timezone
    FE->>API: POST /schedules {astName, params, scheduledTime, timezone}
    API->>API: Encrypt credentials (AES-256-GCM)
    API->>DB: Store schedule record
    API->>EB: Create one-time schedule
    EB-->>API: Schedule created
    API->>FE: Success (scheduleId)
    FE->>U: "Scheduled for Dec 15, 9:00 AM CT"

    Note over U,M: 2. At Scheduled Time
    EB->>Lambda: Trigger (scheduleId, userId)
    Lambda->>DB: Get schedule record
    Lambda->>Lambda: Decrypt credentials
    Lambda->>GW: Execute AST (via API or direct)
    
    loop For each item
        GW->>M: TN3270 commands
        M->>GW: Response
        GW->>DB: Save result
    end
    
    GW->>Lambda: Execution complete
    Lambda->>DB: Update schedule status
    Lambda->>U: Email notification (optional)
    
    Note over EB: Schedule auto-deletes after execution
```

**Key Points:**
- Credentials are encrypted before storing in DynamoDB
- EventBridge Scheduler triggers Lambda at the scheduled time
- Lambda decrypts credentials and initiates AST execution
- Schedule auto-deletes after completion (`ActionAfterCompletion: DELETE`)

---

## Deployment Architecture

### AWS Infrastructure

```mermaid
flowchart TB
    subgraph VPC["VPC"]
        subgraph Public["Public Subnets (2 AZs)"]
            ALB["Application Load Balancer"]
        end
        
        subgraph Private["Private Subnets (2 AZs)"]
            subgraph ROSA["ROSA Cluster"]
                APIService["API Service<br>(Pods)"]
            end
            
            subgraph GatewayLayer["Gateway (ROSA or EC2)"]
                GatewayService["Gateway Service<br>(Pods or Instances)"]
            end
        end
    end
    
    subgraph AWS_Services["AWS Services"]
        DDB["DynamoDB<br>(On-Demand)"]
        ECR["ECR<br>(Container Images)"]
        Secrets["Secrets Manager"]
        CW["CloudWatch<br>(Logs & Metrics)"]
        EventBridge["EventBridge Scheduler<br>(Scheduled ASTs)"]
        Lambda["Lambda<br>(AST Scheduler)"]
    end
    
    subgraph External
        Entra["Azure Entra ID"]
        Mainframe["IBM Mainframe<br>(via Direct Connect)"]
    end
    
    Internet --> ALB
    ALB --> APIService
    APIService --> GatewayService
    
    APIService --> DDB
    GatewayService --> DDB
    GatewayService --> Mainframe
    
    ROSA --> ECR
    ROSA --> Secrets
    ROSA --> CW
    
    EventBridge --> Lambda
    Lambda --> DDB
    Lambda --> GatewayService
```

### Container Architecture

```mermaid
flowchart LR
    subgraph API_Container["API Container"]
        Node["Node.js<br>Fastify"]
    end
    
    subgraph Gateway_Container["Gateway Container"]
        Python["Python<br>asyncio"]
    end
    
    API_Container -->|"Port 3000"| Gateway_Container
    Gateway_Container -->|"Port 8765"| API_Container
```

### Service Discovery

```mermaid
flowchart TB
    subgraph Request["Incoming Request"]
        Browser["Browser"]
    end
    
    subgraph Routing["Traffic Routing"]
        ALB["ALB"]
        API["API Server"]
        DDB[(DynamoDB)]
    end
    
    subgraph Gateways["Gateway Instances"]
        GW1["Gateway 1"]
        GW2["Gateway 2"]
    end
    
    Browser --> ALB
    ALB --> API
    API -->|"1. Lookup session"| DDB
    DDB -->|"2. Return gateway IP"| API
    API -->|"3. Connect"| GW1
```

---

## DynamoDB Schema

### Entity-Relationship

```mermaid
erDiagram
    USER ||--o{ SESSION : owns
    SESSION ||--o| GATEWAY_MAPPING : has
    SESSION ||--o{ EXECUTION : contains
    EXECUTION ||--o{ POLICY_RESULT : contains
    
    USER {
        string partitionKey
        string sortKey
        string email
        string displayName
    }
    
    SESSION {
        string partitionKey
        string sortKey
        string name
        string createdAt
    }
    
    GATEWAY_MAPPING {
        string partitionKey
        string sortKey
        string instanceIp
        string status
        int ttl
    }
    
    EXECUTION {
        string partitionKey
        string sortKey
        string astName
        string status
        int totalItems
    }
    
    POLICY_RESULT {
        string partitionKey
        string sortKey
        string status
        int durationMs
    }
```

### Access Patterns

| Access Pattern | Query |
|----------------|-------|
| Get user profile | `PK = USER#{userId}, SK = PROFILE` |
| List user sessions | `PK = USER#{userId}, SK begins_with SESSION#` |
| Get gateway for session | `PK = SESSION#{sid}, SK = GATEWAY#mapping` |
| Get executions for session | `PK = SESSION#{sid}, SK begins_with EXEC#` |
| Get execution by ID | `GSI: execution_id = {id}, SK = EXEC#` |
| Get policies for execution | `PK = EXEC#{eid}, SK begins_with POLICY#` |
