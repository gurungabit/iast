# AWS Deployment Guide

This guide covers deploying the IAST (Interactive Automated Streamlined Terminal) application to AWS for production use.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Infrastructure Components](#infrastructure-components)
3. [Scaling Strategy](#scaling-strategy)
4. [High Availability & Failover](#high-availability--failover)
5. [Security Architecture](#security-architecture)
6. [Monitoring & Alerting](#monitoring--alerting)

---

## Architecture Overview

```mermaid
flowchart TB
    subgraph Internet["Internet"]
        Users["👥 Users"]
    end

    subgraph AWS["AWS Cloud"]
        subgraph Edge["Edge Layer"]
            Route53["Route 53 (DNS)"]
            CloudFront["CloudFront (CDN)"]
            WAF["WAF (Security)"]
        end

        subgraph VPC["VPC (10.0.0.0/16)"]
            subgraph Public["Public Subnets (Multi-AZ)"]
                ALB["Application Load Balancer"]
                NAT["NAT Gateway"]
            end

            subgraph Private["Private Subnets (Multi-AZ)"]
                ROSA["ROSA Cluster (API Servers)"]
                EC2["EC2 Auto Scaling Group (TN3270 Gateway)"]
                ElastiCache["ElastiCache (Valkey)"]
            end
        end

        DynamoDB["DynamoDB (Global Tables)"]
        S3["S3 (Static Assets)"]
        SecretsManager["Secrets Manager"]
        CloudWatch["CloudWatch"]
    end

    subgraph OnPrem["On-Premises"]
        DirectConnect["Direct Connect / VPN"]
        Mainframe["IBM Mainframe"]
    end

    subgraph Azure["Azure"]
        EntraID["Entra ID (SSO)"]
    end

    Users --> Route53 --> CloudFront --> S3
    Users --> WAF --> ALB --> ROSA
    ROSA <--> ElastiCache <--> EC2
    ROSA & EC2 --> DynamoDB
    EC2 --> NAT --> DirectConnect --> Mainframe
    ROSA -.-> EntraID
```

---

## Infrastructure Components

### Component Matrix

| Component | AWS Service | Purpose | HA Strategy |
|-----------|-------------|---------|-------------|
| **Web Frontend** | S3 + CloudFront | Static assets hosting | Global CDN replication |
| **DNS** | Route 53 | DNS + health checks | Built-in global HA |
| **Load Balancer** | ALB | HTTPS termination, WebSocket routing | Multi-AZ |
| **API Server** | ROSA (OpenShift) | REST API + WebSocket handling | Pod replicas across AZs |
| **TN3270 Gateway** | EC2 Auto Scaling | Mainframe connectivity | Multi-AZ ASG |
| **Message Broker** | ElastiCache (Redis) | Pub/Sub messaging | Multi-AZ with failover |
| **Database** | DynamoDB | User data, sessions, history | Global Tables (multi-region) |
| **Secrets** | Secrets Manager | API keys, credentials | Regional replication |
| **Mainframe Access** | Direct Connect / VPN | Private connectivity | Redundant connections |

### Why This Architecture?

**ROSA for API Servers:**

- Kubernetes-native scaling with HPA
- Rolling deployments with zero downtime
- Enterprise container platform with Red Hat support
- Integrated monitoring and logging

**EC2 for TN3270 Gateway (not containers):**

- Long-running TCP connections (hours/days)
- Direct network access to mainframes via Direct Connect
- In-memory session state that can't be easily migrated
- Predictable resource allocation for TN3270 sessions

### Network Architecture

```mermaid
flowchart TB
    subgraph VPC["VPC: 10.0.0.0/16"]
        subgraph AZ1["Availability Zone 1"]
            subgraph Pub1["Public Subnet: 10.0.1.0/24"]
                ALB1["ALB Node"]
                NAT1["NAT Gateway"]
            end
            subgraph Priv1["Private Subnet: 10.0.3.0/24"]
                ROSA1["ROSA Worker Node"]
                GW1["Gateway Instance"]
                Cache1["ElastiCache Node"]
            end
        end

        subgraph AZ2["Availability Zone 2"]
            subgraph Pub2["Public Subnet: 10.0.2.0/24"]
                ALB2["ALB Node"]
            end
            subgraph Priv2["Private Subnet: 10.0.4.0/24"]
                ROSA2["ROSA Worker Node"]
                GW2["Gateway Instance"]
                Cache2["ElastiCache Replica"]
            end
        end
    end

    Internet["Internet"] --> ALB1 & ALB2
    NAT1 --> DirectConnect["Direct Connect"]
    DirectConnect --> Mainframe["Mainframe"]
```

### Security Groups

| Security Group | Inbound | Outbound | Purpose |
|----------------|---------|----------|---------|
| `iast-alb-sg` | 443 from 0.0.0.0/0 | All | Public HTTPS access |
| `iast-rosa-sg` | 3000 from ALB-SG | All | API server traffic |
| `iast-gateway-sg` | 6379 from Cache-SG | 23 to Mainframe, 6379 to Cache | Gateway traffic |
| `iast-cache-sg` | 6379 from ROSA-SG, Gateway-SG | None | ElastiCache access |

---

## Scaling Strategy

### Horizontal Scaling Diagram

```mermaid
flowchart TB
    subgraph Scaling["Auto-Scaling Architecture"]
        subgraph API["API Tier (ROSA)"]
            direction LR
            Pod1["Pod 1"]
            Pod2["Pod 2"]
            PodN["Pod N"]
            HPA["HorizontalPodAutoscaler"]
        end

        subgraph Gateway["Gateway Tier (EC2 ASG)"]
            direction LR
            GW1["Instance 1 (Sessions A-C)"]
            GW2["Instance 2 (Sessions D-F)"]
            GWN["Instance N (Sessions G-I)"]
            ASG["Auto Scaling Group"]
        end

        subgraph Cache["Cache Tier (ElastiCache)"]
            Primary["Primary Node"]
            Replica["Read Replica"]
        end
    end

    HPA -->|"Scale pods"| Pod1 & Pod2 & PodN
    ASG -->|"Scale instances"| GW1 & GW2 & GWN
    Primary <-->|"Replication"| Replica
```

### Scaling Rules

| Component | Metric | Scale Out | Scale In | Min | Max |
|-----------|--------|-----------|----------|-----|-----|
| **API (ROSA)** | CPU > 70% | +50% pods | -25% pods | 2 | 20 |
| **API (ROSA)** | Memory > 80% | +50% pods | -25% pods | 2 | 20 |
| **Gateway (EC2)** | Active Sessions > 50/instance | +1 instance | -1 instance | 2 | 20 |
| **Gateway (EC2)** | CPU > 70% | +2 instances | -1 instance | 2 | 20 |
| **ElastiCache** | Memory > 80% | Vertical scale | - | - | - |

### Capacity Planning

| Load Level | Concurrent Users | API Pods | Gateway Instances | ElastiCache |
|------------|------------------|----------|-------------------|-------------|
| **Development** | 1-10 | 2 | 1 | cache.t3.micro |
| **Low** | 10-100 | 2-4 | 2 | cache.r6g.large |
| **Medium** | 100-500 | 4-8 | 4-6 | cache.r6g.xlarge |
| **High** | 500-1000 | 8-12 | 8-10 | cache.r6g.2xlarge |
| **Enterprise** | 1000+ | 12-20 | 10-20 | Redis Cluster |

### Session Affinity

```mermaid
flowchart LR
    subgraph Sessions["Session Distribution"]
        User1["User A"] --> GW1["Gateway 1"]
        User2["User B"] --> GW1
        User3["User C"] --> GW2["Gateway 2"]
        User4["User D"] --> GW2
    end

    subgraph Valkey["Valkey Pub/Sub"]
        Channel1["tn3270.input.session-a"]
        Channel2["tn3270.output.session-a"]
    end

    GW1 <--> Channel1 & Channel2
```

**Key Points:**

- TN3270 sessions are bound to specific Gateway instances
- Valkey pub/sub routes messages to the correct Gateway
- If a Gateway fails, sessions must be re-established (no migration)
- ALB uses sticky sessions for WebSocket connections

---

## High Availability & Failover

### Multi-AZ Architecture

```mermaid
flowchart TB
    subgraph Region["AWS Region (us-east-1)"]
        Route53["Route 53"]
        
        subgraph AZ1["Availability Zone 1"]
            ALB1["ALB"]
            ROSA1["ROSA Workers"]
            GW1["Gateway ASG"]
            Cache1["ElastiCache Primary"]
        end
        
        subgraph AZ2["Availability Zone 2"]
            ALB2["ALB"]
            ROSA2["ROSA Workers"]
            GW2["Gateway ASG"]
            Cache2["ElastiCache Replica"]
        end
    end

    Route53 --> ALB1 & ALB2
    Cache1 <-->|"Sync Replication"| Cache2
    
    style AZ1 fill:#e8f5e9
    style AZ2 fill:#e3f2fd
```

### Multi-Region Disaster Recovery

```mermaid
flowchart TB
    subgraph Primary["Primary Region (us-east-1)"]
        R53P["Route 53 (Active)"]
        ALBP["ALB"]
        ROSAP["ROSA Cluster"]
        GWP["Gateway ASG"]
        CacheP["ElastiCache"]
        DDBP["DynamoDB"]
    end

    subgraph DR["DR Region (us-west-2)"]
        R53D["Route 53 (Standby)"]
        ALBD["ALB (Warm)"]
        ROSAD["ROSA Cluster (Scaled Down)"]
        GWD["Gateway ASG (Min: 1)"]
        CacheD["ElastiCache (Warm)"]
        DDBD["DynamoDB Global Table"]
    end

    Users["Users"] --> R53P
    R53P -.->|"Failover"| R53D
    DDBP <-->|"Global Tables Replication"| DDBD

    style Primary fill:#e8f5e9
    style DR fill:#fff3e0
```

### Failover Scenarios

| Failure Type | Detection | Recovery Action | RTO | RPO |
|--------------|-----------|-----------------|-----|-----|
| **Single Gateway Instance** | ASG Health Check | Auto-replace instance | 2-5 min | 0 (sessions reconnect) |
| **Single API Pod** | K8s Liveness Probe | Auto-restart pod | 30 sec | 0 |
| **Availability Zone** | ALB Health Check | Route to healthy AZ | 1-2 min | 0 |
| **ElastiCache Primary** | ElastiCache Auto-failover | Promote replica | 1-2 min | ~1 sec |
| **Entire Region** | Route 53 Health Check | DNS failover to DR | 5-15 min | ~1 min |

### Health Check Configuration

| Component | Health Check Type | Endpoint | Interval | Threshold |
|-----------|-------------------|----------|----------|-----------|
| **ALB → API** | HTTP | `/health` | 30s | 2 failures |
| **Route 53 → ALB** | HTTPS | `/health` | 30s | 3 failures |
| **ASG → Gateway** | EC2 | Instance status | 60s | 2 failures |
| **ElastiCache** | Built-in | Automatic | - | Automatic |

### Recovery Procedures

**AZ Failure:**

1. ALB automatically routes to healthy AZ
2. ASG launches replacement instances in healthy AZ
3. ROSA scheduler places pods in healthy AZ
4. Users reconnect to new Gateway instances

**Region Failure:**

1. Route 53 detects ALB health check failures
2. DNS automatically fails over to DR region (TTL: 60s)
3. DR region ROSA scales up to handle load
4. DR Gateway ASG scales to match demand
5. DynamoDB Global Tables already in sync
6. Users reconnect (sessions lost, data preserved)

---

## Security Architecture

### Security Layers

```mermaid
flowchart TB
    subgraph External["External Traffic"]
        Users["Users"]
    end

    subgraph Edge["Edge Security"]
        WAF["AWS WAF (Rate limiting, OWASP rules)"]
        CloudFront["CloudFront (DDoS protection)"]
    end

    subgraph Network["Network Security"]
        VPC["VPC (Isolated network)"]
        SG["Security Groups (Firewall)"]
        PrivateSubnet["Private Subnets (No public IPs)"]
    end

    subgraph App["Application Security"]
        TLS["TLS 1.3 (Encryption in transit)"]
        JWT["JWT Validation (Azure Entra ID)"]
        RBAC["User-scoped access"]
    end

    subgraph Data["Data Security"]
        Encryption["Encryption at rest (KMS)"]
        Secrets["Secrets Manager"]
        IAM["IAM Roles (Least privilege)"]
    end

    Users --> WAF --> CloudFront --> VPC
    VPC --> SG --> PrivateSubnet
    PrivateSubnet --> TLS --> JWT --> RBAC
    RBAC --> Encryption & Secrets & IAM
```

### Secrets Required

| Secret | Service | Purpose |
|--------|---------|---------|
| `iast/entra` | API Server | Azure Entra ID tenant/client IDs |
| `iast/valkey` | API + Gateway | ElastiCache connection string |
| `iast/tn3270` | Gateway | Mainframe host and port |

### IAM Roles

| Role | Assigned To | Permissions |
|------|-------------|-------------|
| `iast-api-role` | ROSA Pods | DynamoDB, Secrets Manager (read) |
| `iast-gateway-role` | EC2 Instances | DynamoDB, Secrets Manager (read), CloudWatch (write), ECR (pull) |

---

## Monitoring & Alerting

### Key Metrics Dashboard

```mermaid
flowchart LR
    subgraph Metrics["CloudWatch Metrics"]
        API["API Metrics"]
        GW["Gateway Metrics"]
        Cache["Cache Metrics"]
        DB["DynamoDB Metrics"]
    end

    subgraph Alarms["CloudWatch Alarms"]
        A1["5xx Error Rate > 1%"]
        A2["Latency P99 > 2s"]
        A3["Active Sessions > 80%"]
        A4["Cache CPU > 80%"]
    end

    subgraph Actions["Alert Actions"]
        SNS["SNS Topic"]
        PD["PagerDuty / Slack"]
        ASG2["Auto Scaling"]
    end

    API --> A1 & A2
    GW --> A3
    Cache --> A4
    A1 & A2 & A3 & A4 --> SNS --> PD
    A3 --> ASG2
```

### Critical Alerts

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| **High Error Rate** | 5xx errors > 10/min | Critical | Page on-call |
| **High Latency** | P99 > 2 seconds | Warning | Investigate |
| **Gateway Capacity** | Sessions > 80% capacity | Warning | Scale out |
| **Cache Memory** | Memory > 85% | Critical | Vertical scale |
| **DynamoDB Throttling** | Throttled requests > 0 | Warning | Check capacity |
| **Gateway Unhealthy** | Unhealthy instances > 0 | Critical | Check ASG |

### Logging Strategy

| Component | Log Destination | Retention |
|-----------|-----------------|-----------|
| API Server | CloudWatch Logs `/iast/api` | 30 days |
| Gateway | CloudWatch Logs `/iast/gateway` | 30 days |
| ALB Access Logs | S3 bucket | 90 days |
| WAF Logs | CloudWatch Logs | 30 days |

---

## Quick Reference

### Resource Summary

| Resource | Name | Notes |
|----------|------|-------|
| VPC | `iast-vpc` | 10.0.0.0/16 |
| ROSA Cluster | `iast-rosa` | 2+ worker nodes |
| EC2 ASG | `iast-gateway-asg` | c5.xlarge instances |
| ElastiCache | `iast-cache` | Redis 7.0, Multi-AZ |
| DynamoDB | `iast-terminal` | On-demand, Global Tables |
| S3 | `iast-web-*` | Static assets |
| ALB | `iast-alb` | HTTPS + WebSocket |

### Architecture Decision Records

| Decision | Choice | Rationale |
|----------|--------|-----------|
| API Platform | ROSA | K8s-native scaling, enterprise support |
| Gateway Platform | EC2 | Long-lived TCP connections, Direct Connect |
| Database | DynamoDB | Serverless, Global Tables for DR |
| Cache | ElastiCache Redis | Managed, Multi-AZ, pub/sub support |
| CDN | CloudFront | Global distribution, S3 integration |
| Auth | Azure Entra ID | Enterprise SSO, existing identity |
