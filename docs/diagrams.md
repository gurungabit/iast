# IAST Architecture Diagrams

This document contains detailed architecture diagrams for the IAST (Interactive Automated Streamlined Terminal) system.

## Table of Contents

1. [System Topology](#system-topology)
2. [Low-Level Architecture](#low-level-architecture)
3. [Component Diagrams](#component-diagrams)
4. [Data Flow Diagrams](#data-flow-diagrams)
5. [Deployment Diagrams](#deployment-diagrams)

---

## System Topology

### High-Level Network Topology

```mermaid
flowchart TB
    subgraph Internet["Internet Zone"]
        Users["👥 Users"]
        CDN["☁️ CloudFront CDN"]
    end

    subgraph DMZ["DMZ / Public Subnet"]
        ALB["⚖️ Application Load Balancer"]
    end

    subgraph Private["Private Subnet"]
        subgraph APICluster["API Cluster"]
            API1["⚡ API Server 1"]
            API2["⚡ API Server 2"]
            APIx["⚡ API Server N"]
        end

        subgraph GatewayCluster["Gateway Cluster"]
            GW1["🐍 TN3270 Gateway 1"]
            GW2["🐍 TN3270 Gateway 2"]
            GWx["🐍 TN3270 Gateway N"]
        end

        Cache["📡 ElastiCache (Valkey/Redis)"]
    end

    subgraph Data["Data Layer"]
        DDB["🗄️ DynamoDB"]
        S3["📦 S3 Bucket (Static Assets)"]
    end

    subgraph OnPrem["On-Premises / Direct Connect"]
        Mainframe["🖥️ IBM Mainframe (z/OS)"]
    end

    subgraph Auth["Identity Provider"]
        Entra["🔐 Azure Entra ID"]
    end

    Users --> CDN
    Users --> Entra
    CDN --> S3
    Users --> ALB
    ALB --> API1 & API2 & APIx
    
    API1 & API2 & APIx --> Cache
    Cache --> GW1 & GW2 & GWx
    
    API1 & API2 & APIx --> DDB
    GW1 & GW2 & GWx --> DDB
    GW1 & GW2 & GWx --> Mainframe
    
    API1 & API2 & APIx -.->|"JWT Validation"| Entra
```

### Detailed Network Flow

```mermaid
flowchart LR
    subgraph Client["Client"]
        Browser["🌐 Browser"]
    end

    subgraph LB["Load Balancer"]
        direction TB
        HTTP["HTTP/HTTPS Port 443"]
        WS["WebSocket Port 443"]
    end

    subgraph API["API Servers"]
        direction TB
        REST["REST Endpoints (/auth, /sessions, /history)"]
        WSHandler["WebSocket Handler (/terminal/:id)"]
    end

    subgraph Messaging["Message Broker"]
        direction TB
        ValkeyPub["Publisher"]
        ValkeySub["Subscriber"]
        Channels["Channels: tn3270.input.* / tn3270.output.*"]
    end

    subgraph Gateway["TN3270 Gateway"]
        direction TB
        SessionMgr["Session Manager"]
        TNZLib["tnz Library"]
        ASTEngine["AST Engine"]
    end

    subgraph Mainframe["Mainframe"]
        TN3270["TN3270 Server Port 23"]
    end

    Browser -->|"HTTPS"| HTTP
    Browser -->|"WSS"| WS
    HTTP --> REST
    WS --> WSHandler
    
    WSHandler -->|"Publish"| ValkeyPub
    ValkeyPub --> Channels
    Channels --> ValkeySub
    ValkeySub --> SessionMgr
    
    SessionMgr --> TNZLib
    SessionMgr --> ASTEngine
    TNZLib -->|"TN3270 TCP"| TN3270
```

---

## Low-Level Architecture

### Frontend Architecture

```mermaid
flowchart TB
    subgraph UI["UI Layer"]
        TerminalPage["Terminal Page"]
        HistoryPage["History Page"]
        AuthGuard["Auth Guard"]
    end

    subgraph Components["Component Layer"]
        Terminal["Terminal (xterm.js)"]
        TabManager["Tab Manager"]
        ASTPanel["AST Panel"]
        SessionList["Session List"]
    end

    subgraph Hooks["Hook Layer"]
        useTerminal["useTerminal"]
        useAuth["useAuth"]
        useAST["useAST"]
    end

    subgraph State["State Management"]
        AuthContext["Auth Context (React Context)"]
        ASTStore["AST Store (Zustand)"]
        LocalStorage["Local Storage (Session persistence)"]
    end

    subgraph Services["Service Layer"]
        WSService["WebSocket Service"]
        APIClient["REST API Client"]
        MSALService["MSAL Service"]
    end

    TerminalPage --> Terminal & TabManager & ASTPanel
    HistoryPage --> SessionList
    
    Terminal --> useTerminal
    ASTPanel --> useAST
    AuthGuard --> useAuth

    useTerminal --> WSService
    useAuth --> MSALService & AuthContext
    useAST --> ASTStore

    WSService --> LocalStorage
    APIClient --> LocalStorage
    MSALService --> LocalStorage
```

### API Server Architecture

```mermaid
flowchart TB
    subgraph HTTP["HTTP Layer"]
        Fastify["Fastify Server"]
        CORS["CORS Middleware"]
        WSPlugin["WebSocket Plugin"]
    end

    subgraph Routes["Route Layer"]
        AuthRoutes["/auth/*"]
        SessionRoutes["/sessions/*"]
        HistoryRoutes["/history/*"]
        HealthRoute["/health"]
    end

    subgraph WS["WebSocket Layer"]
        WSHandler["WebSocket Handler (/terminal/:sessionId)"]
        MessageParser["Message Parser"]
        MessageRouter["Message Router"]
    end

    subgraph Services["Service Layer"]
        AuthService["Auth Service (jose JWT)"]
        SessionService["Session Service"]
        DynamoService["DynamoDB Service"]
    end

    subgraph Valkey["Valkey Layer"]
        ValkeyClient["Valkey Client"]
        Publisher["Publisher"]
        Subscriber["Subscriber"]
    end

    Fastify --> CORS --> WSPlugin
    WSPlugin --> WSHandler
    Fastify --> AuthRoutes & SessionRoutes & HistoryRoutes & HealthRoute

    AuthRoutes --> AuthService --> DynamoService
    SessionRoutes --> SessionService --> DynamoService
    HistoryRoutes --> DynamoService
    
    WSHandler --> MessageParser --> MessageRouter
    MessageRouter --> ValkeyClient
    ValkeyClient --> Publisher & Subscriber
```

### Gateway Architecture

```mermaid
flowchart TB
    subgraph Entry["Entry Point"]
        App["app.py"]
        CLI["cli.py"]
    end

    subgraph Valkey["Valkey Client"]
        ValkeyAsync["Async Valkey Client"]
        ControlSub["Control Subscriber"]
        InputSub["Input Subscribers"]
        OutputPub["Output Publisher"]
    end

    subgraph TN3270["TN3270 Layer"]
        Manager["Session Manager"]
        Sessions["Session Pool"]
        Host["Host Abstraction"]
        Renderer["ANSI Renderer"]
    end

    subgraph TNZ["tnz Library"]
        TNZCore["tnz.Tnz"]
        ThreadPool["Thread Pool (10 workers)"]
    end

    subgraph AST["AST Framework"]
        ASTBase["AST Base Class"]
        Executor["Executor (Sequential/Parallel)"]
        Runner["AST Runner"]
        Persistence["AST Persistence"]
    end

    subgraph DB["Database"]
        DynamoDB["DynamoDB Client"]
    end

    App --> ValkeyAsync & Manager
    ValkeyAsync --> ControlSub & InputSub & OutputPub
    
    ControlSub -->|"session.create"| Manager
    InputSub -->|"data, ast.run"| Manager
    Manager --> Sessions
    Sessions --> Host --> TNZCore
    TNZCore --> ThreadPool
    Host --> Renderer --> OutputPub
    
    Manager --> Runner --> Executor --> ASTBase
    ASTBase --> Host
    Executor --> Persistence --> DynamoDB
```

### Message Flow Architecture

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant WS as WebSocket Handler
    participant V as Valkey
    participant M as TN3270 Manager
    participant T as tnz Session
    participant H as Mainframe

    Note over B,H: Input Flow (Browser → Mainframe)
    B->>WS: data message {type:data, payload:A}
    WS->>V: PUBLISH tn3270.input.{sessionId}
    V->>M: MESSAGE
    M->>T: handle_input("A")
    T->>T: translate_key()
    T->>H: TN3270 keystroke

    Note over B,H: Output Flow (Mainframe → Browser)
    H->>T: 3270 screen data
    T->>T: parse screen buffer
    M->>M: render_to_ansi()
    M->>M: extract_fields()
    M->>V: PUBLISH tn3270.output.{sessionId}
    V->>WS: MESSAGE
    WS->>B: tn3270.screen message
```

---

## Component Diagrams

### Web Frontend Components

```mermaid
flowchart TB
    subgraph App["Application Shell"]
        Router["TanStack Router"]
        AuthProvider["Auth Provider"]
        ThemeProvider["Theme Provider"]
    end

    subgraph Pages["Pages"]
        IndexRoute["/ (Terminal)"]
        HistoryRoute["/history"]
    end

    subgraph TerminalComponents["Terminal Page Components"]
        TabBar["Tab Bar"]
        TerminalContainer["Terminal Container"]
        ASTSidebar["AST Sidebar"]
    end

    subgraph SharedComponents["Shared Components"]
        NavBar["Navigation Bar"]
        UserMenu["User Menu"]
        LoadingSpinner["Loading Spinner"]
        ErrorBoundary["Error Boundary"]
    end

    subgraph ASTComponents["AST Components"]
        ASTForm["AST Form"]
        ASTProgress["Progress Display"]
        ASTResults["Results Table"]
        PolicyInput["Policy Input"]
    end

    Router --> IndexRoute & HistoryRoute
    AuthProvider --> Router
    ThemeProvider --> AuthProvider

    IndexRoute --> TabBar & TerminalContainer & ASTSidebar
    ASTSidebar --> ASTForm & ASTProgress & ASTResults
    ASTForm --> PolicyInput

    IndexRoute & HistoryRoute --> NavBar & UserMenu
```

### API Server Routes

```mermaid
flowchart LR
    subgraph Public["Public Endpoints"]
        Health["GET /health"]
    end

    subgraph Protected["Protected Endpoints (JWT Required)"]
        subgraph Auth["Auth"]
            GetMe["GET /auth/me"]
            Logout["POST /auth/logout"]
        end

        subgraph Sessions["Sessions"]
            ListSessions["GET /sessions"]
            CreateSession["POST /sessions"]
            UpdateSession["PUT /sessions/:id"]
            DeleteSession["DELETE /sessions/:id"]
        end

        subgraph History["History"]
            ListHistory["GET /history"]
            GetPolicies["GET /history/:id/policies"]
        end

        subgraph WebSocket["WebSocket"]
            Terminal["WS /terminal/:sessionId"]
        end
    end

    Health --> DynamoDB["DynamoDB Check"]
    GetMe --> EntraValidation["Entra Token Validation"]
    GetMe --> AutoProvision["Auto-Provision User"]
    
    ListSessions & CreateSession & UpdateSession & DeleteSession --> SessionService["Session Service"]
    SessionService --> DynamoDB

    ListHistory & GetPolicies --> HistoryService["History Service"]
    HistoryService --> DynamoDB

    Terminal --> JWTValidation["JWT Validation"]
    Terminal --> ValkeyPubSub["Valkey Pub/Sub"]
```

### Gateway Services

```mermaid
flowchart TB
    subgraph Core["Core Services"]
        Config["Configuration"]
        Channels["Channel Definitions"]
        Errors["Error Handling"]
    end

    subgraph TN3270Service["TN3270 Service"]
        Manager["TN3270Manager"]
        Session["TN3270Session"]
        Host["Host"]
        Renderer["TN3270Renderer"]
    end

    subgraph ASTService["AST Service"]
        BaseAST["AST Base"]
        LoginAST["LoginAST"]
        SeqExecutor["SequentialExecutor"]
        ParExecutor["ParallelExecutor"]
    end

    subgraph DataService["Data Services"]
        ValkeyClient["ValkeyClient"]
        DynamoClient["DynamoDBClient"]
    end

    Config --> Manager & ValkeyClient & DynamoClient
    Channels --> ValkeyClient
    
    Manager --> Session --> Host --> Renderer
    Manager --> BaseAST
    BaseAST --> LoginAST
    BaseAST --> SeqExecutor & ParExecutor
    
    SeqExecutor & ParExecutor --> DynamoClient
    Manager --> ValkeyClient
```

---

## Data Flow Diagrams

### Authentication Data Flow

```mermaid
flowchart LR
    subgraph Browser["Browser"]
        MSAL["MSAL.js"]
        TokenCache["Token Cache"]
    end

    subgraph EntraID["Azure Entra ID"]
        AuthEndpoint["Authorization Endpoint"]
        TokenEndpoint["Token Endpoint"]
        JWKS["JWKS Endpoint"]
    end

    subgraph API["API Server"]
        JWTValidator["JWT Validator"]
        UserService["User Service"]
    end

    subgraph DB["DynamoDB"]
        UsersTable["Users Table"]
    end

    MSAL -->|"1. Auth Request"| AuthEndpoint
    AuthEndpoint -->|"2. Auth Code"| MSAL
    MSAL -->|"3. Token Request"| TokenEndpoint
    TokenEndpoint -->|"4. Access Token"| MSAL
    MSAL --> TokenCache

    TokenCache -->|"5. API Request + Token"| JWTValidator
    JWTValidator -->|"6. Fetch JWKS"| JWKS
    JWTValidator -->|"7. Find/Create User"| UserService
    UserService --> UsersTable
```

### AST Execution Data Flow

```mermaid
flowchart TB
    subgraph Browser["Browser"]
        ASTForm["AST Form"]
        ProgressUI["Progress UI"]
        ResultsUI["Results UI"]
    end

    subgraph API["API Server"]
        WSHandler["WebSocket Handler"]
    end

    subgraph Valkey["Valkey"]
        InputChannel["tn3270.input.*"]
        OutputChannel["tn3270.output.*"]
    end

    subgraph Gateway["Gateway"]
        ASTRunner["AST Runner"]
        Executor["Executor"]
        Host["Host"]
    end

    subgraph Mainframe["Mainframe"]
        TN3270["TN3270"]
    end

    subgraph DB["DynamoDB"]
        Executions["Executions"]
        Policies["Policy Results"]
    end

    ASTForm -->|"1. ast.run"| WSHandler
    WSHandler -->|"2. Publish"| InputChannel
    InputChannel -->|"3. Subscribe"| ASTRunner
    ASTRunner -->|"4. Create Execution"| Executions
    ASTRunner --> Executor
    
    loop For Each Item
        Executor --> Host
        Host -->|"5. TN3270 Commands"| TN3270
        TN3270 -->|"6. Screen Response"| Host
        Executor -->|"7. Save Result"| Policies
        Executor -->|"8. ast.progress"| OutputChannel
        OutputChannel -->|"9. Forward"| WSHandler
        WSHandler -->|"10. Update"| ProgressUI
    end
    
    Executor -->|"11. ast.status"| OutputChannel
    OutputChannel -->|"12. Complete"| WSHandler
    WSHandler -->|"13. Show"| ResultsUI
```

---

## Deployment Diagrams

### AWS Production Deployment

```mermaid
flowchart TB
    subgraph Internet["Internet"]
        Users["👥 Users"]
    end

    subgraph AWS["AWS Cloud"]
        subgraph Edge["Edge Services"]
            CloudFront["☁️ CloudFront"]
            Route53["🌐 Route 53"]
            WAF["🛡️ WAF"]
        end

        subgraph VPC["VPC (10.0.0.0/16)"]
            subgraph PublicSubnet["Public Subnets"]
                ALB["⚖️ Application Load Balancer"]
                NAT["🔀 NAT Gateway"]
            end

            subgraph PrivateSubnet["Private Subnets"]
                subgraph ROSA["ROSA Cluster"]
                    APIService["API Service (OpenShift Pods)"]
                end

                subgraph EC2ASG["EC2 Auto Scaling Group"]
                    Gateway1["TN3270 Gateway"]
                    Gateway2["TN3270 Gateway"]
                end

                ElastiCache["📡 ElastiCache (Redis Mode)"]
            end
        end

        subgraph ManagedServices["Managed Services"]
            DynamoDB["🗄️ DynamoDB"]
            S3["📦 S3"]
            SecretsManager["🔐 Secrets Manager"]
            CloudWatch["📊 CloudWatch"]
        end
    end

    subgraph OnPrem["On-Premises"]
        DirectConnect["🔗 Direct Connect"]
        Mainframe["🖥️ Mainframe"]
    end

    subgraph Azure["Azure"]
        EntraID["🔐 Entra ID"]
    end

    Users --> Route53 --> CloudFront
    CloudFront --> S3
    Users --> WAF --> ALB
    
    ALB --> APIService
    APIService --> ElastiCache
    ElastiCache --> Gateway1 & Gateway2
    
    APIService --> DynamoDB
    Gateway1 & Gateway2 --> DynamoDB
    
    Gateway1 & Gateway2 --> NAT --> DirectConnect --> Mainframe
    
    APIService & Gateway1 & Gateway2 --> SecretsManager
    APIService & Gateway1 & Gateway2 --> CloudWatch
    
    APIService -.-> EntraID
```

### Container Architecture

```mermaid
flowchart TB
    subgraph APIContainer["API Server Container"]
        NodeJS["Node.js 22"]
        Fastify["Fastify 5"]
        IORedis["ioredis"]
        AWSSDK["AWS SDK v3"]
        Jose["jose"]
    end

    subgraph GatewayContainer["Gateway Container"]
        Python["Python 3.11"]
        Asyncio["asyncio"]
        TNZ["tnz"]
        RedisPy["redis-py"]
        Boto3["boto3"]
    end

    subgraph WebContainer["Web Container (Build Only)"]
        Node["Node.js"]
        Vite["Vite 7"]
        React["React 19"]
        XtermJS["xterm.js"]
    end

    subgraph Output["Build Output"]
        StaticFiles["Static Files (HTML, JS, CSS)"]
    end

    WebContainer -->|"npm run build"| StaticFiles
    StaticFiles -->|"Deploy"| S3["S3 Bucket"]
```

### Local Development Setup

```mermaid
flowchart TB
    subgraph LocalMachine["Local Machine"]
        subgraph Terminal1["Terminal 1"]
            DevScript["./scripts/dev.sh"]
        end

        subgraph Docker["Docker Desktop"]
            Valkey["🐳 Valkey localhost:6379"]
            DynamoDB["🐳 DynamoDB Local localhost:8042"]
        end

        subgraph Processes["Application Processes"]
            WebDev["📦 Web (Vite Dev) localhost:5173"]
            APIDev["⚡ API (tsx watch) localhost:3000"]
            GatewayDev["🐍 Gateway (Python)"]
        end

        subgraph Mainframe["Mainframe Access"]
            Hercules["💻 Hercules Emulator"]
            RealMainframe["🖥️ Real Mainframe (VPN Required)"]
        end
    end

    DevScript -->|"docker-compose up"| Valkey & DynamoDB
    DevScript -->|"pnpm dev"| WebDev & APIDev
    DevScript -->|"python -m src"| GatewayDev

    WebDev -->|"HTTP"| APIDev
    APIDev -->|"Pub/Sub"| Valkey
    Valkey -->|"Pub/Sub"| GatewayDev
    GatewayDev --> Hercules
    GatewayDev --> RealMainframe
```

---

## Scaling Diagrams

### Horizontal Scaling Strategy

```mermaid
flowchart TB
    subgraph Users["User Traffic"]
        U1["User 1"]
        U2["User 2"]
        UN["User N"]
    end

    subgraph LB["Load Balancer"]
        ALB["Application Load Balancer (Sticky Sessions for WS)"]
    end

    subgraph APITier["API Tier (ROSA - Stateless)"]
        API1["API Server 1"]
        API2["API Server 2"]
        API3["API Server 3"]
    end

    subgraph Cache["Message Broker"]
        Valkey["Valkey Cluster (Redis Cluster Mode)"]
    end

    subgraph GatewayTier["Gateway Tier (Stateful Sessions)"]
        GW1["Gateway 1 (Sessions: A, B, C)"]
        GW2["Gateway 2 (Sessions: D, E, F)"]
        GW3["Gateway 3 (Sessions: G, H, I)"]
    end

    subgraph Mainframes["Mainframe Pool"]
        MF1["Mainframe 1"]
        MF2["Mainframe 2"]
    end

    U1 & U2 & UN --> ALB
    ALB --> API1 & API2 & API3
    
    API1 & API2 & API3 <-->|"Pub/Sub"| Valkey
    Valkey <-->|"Pub/Sub"| GW1 & GW2 & GW3
    
    GW1 --> MF1
    GW2 --> MF1 & MF2
    GW3 --> MF2
```

### Auto-Scaling Rules

```mermaid
flowchart LR
    subgraph Metrics["CloudWatch Metrics"]
        CPU["CPU Utilization"]
        Memory["Memory Usage"]
        Connections["Active Connections"]
        Queue["Message Queue Depth"]
    end

    subgraph Rules["Scaling Rules"]
        CPURule["CPU > 70% → Scale Out"]
        ConnRule["Connections > 100/instance → Scale Out"]
        QueueRule["Queue Depth > 1000 → Scale Out"]
    end

    subgraph Actions["Scaling Actions"]
        APIScale["API: Scale ROSA Pods"]
        GWScale["Gateway: Add EC2 Instances"]
        CacheScale["Cache: Add Read Replicas"]
    end

    CPU --> CPURule --> APIScale & GWScale
    Connections --> ConnRule --> APIScale
    Queue --> QueueRule --> GWScale
    Memory --> CacheScale
```

---

## Security Diagram

### Security Architecture

```mermaid
flowchart TB
    subgraph Public["Public Zone"]
        Users["👥 Users"]
        WAF["🛡️ AWS WAF (Rate Limiting, SQL Injection)"]
    end

    subgraph Auth["Authentication"]
        EntraID["🔐 Azure Entra ID"]
        JWKS["📜 JWKS Endpoint"]
    end

    subgraph Transport["Transport Security"]
        TLS["🔒 TLS 1.3"]
        ALB["ALB (HTTPS Only)"]
    end

    subgraph App["Application Security"]
        JWTValidation["🎫 JWT Validation"]
        RBAC["👤 User-Scoped Access"]
        InputValidation["✅ Input Validation"]
    end

    subgraph Data["Data Security"]
        DDBEncryption["🔐 DynamoDB Encryption (At Rest)"]
        SecretsManager["🔑 AWS Secrets Manager"]
        IAMRoles["🎭 IAM Roles"]
    end

    subgraph Network["Network Security"]
        VPC["🏰 VPC Isolation"]
        SG["🚧 Security Groups"]
        PrivateSubnets["🔒 Private Subnets"]
    end

    Users --> WAF --> TLS --> ALB
    Users --> EntraID
    EntraID --> JWKS
    
    ALB --> JWTValidation
    JWTValidation --> JWKS
    JWTValidation --> RBAC --> InputValidation
    
    InputValidation --> VPC
    VPC --> SG --> PrivateSubnets
    
    PrivateSubnets --> DDBEncryption
    PrivateSubnets --> SecretsManager
    SecretsManager --> IAMRoles
```

---

## Monitoring Diagram

### Observability Stack

```mermaid
flowchart TB
    subgraph Apps["Applications"]
        API["API Server"]
        Gateway["Gateway"]
        Web["Web App"]
    end

    subgraph Logging["Logging"]
        Pino["Pino (API)"]
        Structlog["structlog (Gateway)"]
        CloudWatchLogs["CloudWatch Logs"]
    end

    subgraph Metrics["Metrics"]
        APIMetrics["API Metrics (Request Rate, Latency)"]
        GWMetrics["Gateway Metrics (Session Count, AST Duration)"]
        CloudWatchMetrics["CloudWatch Metrics"]
    end

    subgraph Tracing["Tracing"]
        XRay["AWS X-Ray"]
    end

    subgraph Alerting["Alerting"]
        CloudWatchAlarms["CloudWatch Alarms"]
        SNS["SNS Topics"]
        PagerDuty["PagerDuty/Slack"]
    end

    subgraph Dashboards["Dashboards"]
        CloudWatchDashboard["CloudWatch Dashboard"]
    end

    API --> Pino --> CloudWatchLogs
    Gateway --> Structlog --> CloudWatchLogs
    
    API --> APIMetrics --> CloudWatchMetrics
    Gateway --> GWMetrics --> CloudWatchMetrics
    
    API & Gateway --> XRay
    
    CloudWatchMetrics --> CloudWatchAlarms --> SNS --> PagerDuty
    CloudWatchLogs & CloudWatchMetrics --> CloudWatchDashboard
```
