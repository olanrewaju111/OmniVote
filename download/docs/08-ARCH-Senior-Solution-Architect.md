# 08 — Senior Solution Architect Guide

## OmniVote Monitor v2.1 → Production-Grade Election Monitoring Platform

**Document Version:** 1.0
**Target Audience:** Senior Solution Architect
**Classification:** Internal — Engineering
**Last Updated:** 2025-07-09

---

## 1. Current Architecture Assessment

### 1.1 Architecture Type

OmniVote Monitor v2.1 is a **monolithic Next.js application**. All concerns—UI rendering, API routes, business logic, data access, authentication, and background processing—are co-located inside a single Next.js process. The sole persistence layer is a single SQLite database file on disk. There is no message queue, no cache layer, no CDN, and no separate backend service layer (the only exception being an optional Go-based WhatsApp bridge that runs on port 9090 and is currently unauthenticated).

This architecture was appropriate for rapid prototyping and proof-of-concept demonstrations. It is **not suitable** for a production election monitoring platform that must operate under the load and reliability constraints of Nigeria's national elections.

### 1.2 Technology Stack Inventory

| Layer | Technology | Version |
|---|---|---|
| Frontend Framework | Next.js | 16 |
| UI Library | React | 19 |
| Language (Frontend) | TypeScript | 5 |
| Styling | Tailwind CSS | 4 |
| Component Library | shadcn/ui | latest |
| Client State | Zustand | 5 |
| Server State | React Query (TanStack Query) | v5 |
| ORM | Prisma | 6 |
| Database | SQLite | bundled |
| Runtime | Bun | latest |
| Maps | Leaflet + CARTO tiles | latest |
| Charts | Recharts | latest |
| Reverse Proxy | Caddy | latest |
| WhatsApp Bridge | Go binary | N/A |
| Deployment | Bun standalone server | N/A |

### 1.3 Architecture Diagram (Current State)

```
[Browser]
    |
    v
[Caddy Reverse Proxy :81]
    |
    v
[Bun Runtime :3000]
    |
    v
[Next.js Monolith]
    +-- React UI (SSR + Client)
    +-- API Routes (/api/*)
    +-- Server Actions
    +-- Prisma ORM (direct DB access)
    |
    v
[SQLite Database File (single file on disk)]

[Go WhatsApp Bridge :9090] --> (optional, unauthenticated, direct browser access)
```

### 1.4 Strengths

- **Fast development iteration:** A single developer can make end-to-end changes without coordinating across services.
- **Simple deployment:** One binary (Bun), one database file, one Caddy config. Deployable on a single VPS in minutes.
- **Type safety end-to-end:** TypeScript + Prisma provides compile-time guarantees from UI to database schema. The 23 Prisma models give strong structural typing across the entire stack.
- **Rich UI component library:** shadcn/ui + Tailwind CSS 4 delivers a professional, accessible interface with minimal custom CSS.
- **Good developer experience:** Hot reload, strong IDE support, unified codebase. Zustand and React Query provide clean state management patterns.

### 1.5 Weaknesses

- **Single point of failure:** One Bun process crash takes down the entire system. One corrupted SQLite file loses all data.
- **No horizontal scaling:** Cannot add more instances because they would each need their own SQLite file or a shared filesystem (which SQLite does not support well).
- **SQLite write limitations:** SQLite allows only one writer at a time. During peak election activity with thousands of concurrent incident reports, this becomes a hard bottleneck.
- **No real-time capabilities:** No WebSocket server, no server-sent events, no push notifications. Users must poll or refresh to see updates.
- **No background job processing:** Long-running tasks (report generation, bulk WhatsApp messaging, ML inference) block the request handler or cannot run at all.
- **No caching layer:** Every dashboard load hits the database directly. No intermediate cache for frequently accessed data like KPIs, agent status, or polling unit results.
- **No API documentation:** The API routes are undocumented. No OpenAPI spec, no generated client SDKs.
- **No authentication or authorization:** The system has no auth middleware, no user accounts, no RBAC, no audit trail. Any visitor has full access.
- **No observability:** No structured logging, no distributed tracing, no metrics collection, no alerting.

---

## 2. Target Architecture (Production-Grade)

### 2.1 Architecture Diagram (Target State)

```
                    [CDN / CloudFront]
                           |
                           v
                  [Load Balancer / ALB]
                           |
          +----------------+----------------+
          |                                 |
          v                                 v
  [Next.js Frontend]              [API Gateway / Nginx]
  (SSR + Static Export)           (Rate Limiting, Routing)
  Port 3000 (x N instances)             |
          |                     +--------+--------+--------+--------+
          |                     |        |        |        |        |
          |                     v        v        v        v        v
          |               [Auth    ] [Core  ] [ML/AI ] [Real- ] [WhatsApp]
          |               [Service ] [API   ] [Servic] [Time  ] [Service ]
          |               [:8000  ] [:8001 ] [:8002 ] [Servic] [:8005  ]
          |                               e       ] [:8003 ]
          |                                       |        |
          |                                       v        |
          +-------- HTTP/REST (JWT) --------------+--------+
                                                          |
                                        +-----------------+------------------+
                                        |                 |                  |
                                        v                 v                  v
                                  [PostgreSQL]      [Redis]           [Go Bridge]
                                  [:5432]           [:6379]           [:9090]
                                  (Primary +          (Cache +          (WhatsApp
                                   2 Replicas)        Pub/Sub +          Business
                                                      Sessions)         API)
                                        |
                                        v
                                  [S3 / MinIO]
                                  (Media Storage)
```

### 2.2 Service Decomposition

#### Service 1: Auth Service (Python / FastAPI) — Port 8000

**Responsibilities:**
- JWT token issuance (access token: 15 min RS256, refresh token: 7 days)
- User authentication: email + password + optional TOTP two-factor
- Session management and device trust scoring
- Password hashing with bcrypt/argon2id
- Rate limiting for authentication endpoints (5 attempts per minute per IP)
- Token revocation and blacklist management

**Data access:** Reads/writes `User`, `Session`, `AuditLog` models only.

**Key design decisions:**
- Isolated from the Core API so that an auth service breach does not expose election data.
- Python/FastAPI chosen for rapid development and compatibility with ML ecosystem if biometric auth is added later.

#### Service 2: Core API (Next.js API Routes or Python / FastAPI) — Port 8001

**Responsibilities:**
- Full CRUD operations for all 23 Prisma models
- Business logic enforcement: incident workflow state machine, alert generation rules, PVT comparison logic
- Tenant isolation enforcement: every query filtered by `tenantId`
- RBAC enforcement: role-based access control checked on every endpoint
- Pagination, filtering, sorting standardization
- Input validation with Pydantic/Zod schemas

**Data access:** Read/write access to all models except internal service state.

**Key design decisions:**
- Can remain as Next.js API Routes during Phase 1 to reduce migration risk, then extracted to a standalone FastAPI service in later phases.
- All endpoints return consistent envelope: `{ success, data, meta, errors }`.

#### Service 3: ML/AI Service (Python / FastAPI) — Port 8002

**Responsibilities:**
- NLP classification: incident categorization, sentiment analysis, misinformation detection
- Computer vision: deepfake detection on uploaded media, steganography analysis
- Time-series forecasting: flashpoint prediction based on historical incident patterns
- Anomaly detection: PVT result deviation from expected patterns, honeypot polling unit identification
- Batch processing: classify historical incidents, retrain models on new data

**Data access:** Read access to incidents, media, PVT results. Write access to `Incident.aiClassification` and `Alert` models.

**Key design decisions:**
- Runs as a standalone service so it can be scaled independently and deployed on GPU instances.
- Falls back gracefully: if the ML service is down, the Core API uses rule-based classification as a degraded mode.
- Model versioning via MLflow or similar.

#### Service 4: Real-Time Service (Python / WebSockets) — Port 8003

**Responsibilities:**
- WebSocket connection management (thousands of concurrent connections)
- Alert broadcasting to connected dashboard users
- Dead-man's switch timer: if a field agent doesn't check in within their configured interval, generate an alert
- Live feed push: new incidents, PVT results, and status changes pushed immediately to all relevant users
- Presence tracking: which users are currently online and viewing which views

**Infrastructure dependencies:** Redis pub/sub for multi-instance message fan-out.

**Key design decisions:**
- Python with `websockets` library or `Socket.IO` for broad client compatibility.
- Sticky sessions at the load balancer level, with Redis pub/sub as the backplane so any instance can serve any client after reconnection.

#### Service 5: WhatsApp Service (Python + Go Bridge) — Port 8005

**Responsibilities:**
- Message template rendering (Handlebars/Jinja2 templates)
- WhatsApp Business API (WABA) integration for sending alerts and reports
- Delivery tracking and status callbacks
- Media processing for images and documents sent via WhatsApp
- Inbound message parsing (when agents reply via WhatsApp)

**Infrastructure dependencies:** Go WhatsApp Bridge on port 9090 for the actual WABA API communication.

**Key design decisions:**
- The existing Go bridge is retained but wrapped behind the Python service for authentication, rate limiting, and template management.
- All WhatsApp traffic is logged for audit and compliance purposes.

#### Service 6: Worker Service (Python / Celery) — No HTTP Port

**Responsibilities:**
- Background jobs: report generation (PDF/Excel), bulk data export, bulk WhatsApp messaging campaigns
- Scheduled tasks (Celery Beat):
  - Dead-man's switch checks every 60 seconds
  - Data retention cleanup (archive records older than 90 days)
  - Cache warming (pre-compute dashboard KPIs every 30 seconds)
  - Health checks and system self-diagnostics
- Email notification delivery
- OSINT polling (periodic fetch from X/Twitter, Facebook, YouTube APIs)

**Infrastructure dependencies:** Redis as the Celery broker and result backend.

---

## 3. Database Architecture

### 3.1 Migration: SQLite → PostgreSQL

**Rationale:**
- **Concurrent writes:** PostgreSQL supports thousands of concurrent writers. SQLite allows one.
- **Connection pooling:** PgBouncer can manage hundreds of connections efficiently.
- **Replication:** Streaming replication for high availability and read scaling.
- **JSONB:** Native JSON support for flexible metadata storage on incidents and alerts.
- **Full-text search:** PostgreSQL's `tsvector` and `pg_trgm` for searching incident descriptions without an external service like Elasticsearch.
- **Partitioning:** Native table partitioning for time-based data (audit logs, security events).

**Migration Strategy:**
1. Generate a Prisma migration that targets PostgreSQL (`provider = "postgresql"`)
2. Add missing columns: `passwordHash`, `refreshToken`, `mfaSecret`, `lastLoginAt`, `deviceFingerprint` to the `User` model
3. Add new models: `Session`, `AuditLog`, `CacheEntry`, `BackgroundJob`
4. Use `pgloader` for initial data migration from SQLite, or Prisma seed scripts for a clean migration
5. Run data validation scripts to verify row counts and data integrity post-migration

**Connection Pooling:**
- PgBouncer in transaction mode
- Pool size: 100 connections (20 per service × 5 services)
- Each service connection pool: min 5, max 20

**Replication Topology:**
- 1 Primary (read + write)
- 2 Replicas:
  - Replica A: Analytics queries (heavy aggregations, dashboard KPIs)
  - Replica B: Real-time service reads (lightweight, low-latency queries)

### 3.2 Caching Strategy

**Redis as the primary cache layer** serves four distinct roles:

| Role | Key Pattern | TTL | Invalidation |
|---|---|---|---|
| Session Store | `session:{token}` | 24h | On logout / token rotation |
| Rate Limiting | `rl:{ip}:{endpoint}` | 60s | Natural expiry |
| Dashboard KPIs | `kpi:{tenantId}:{view}` | 30s | On any incident/PVT mutation |
| Agent Status | `agent:{agentId}:status` | 60s | Write-through on status change |
| Hot Data Cache | `cache:{model}:{id}` | 5min | On mutation success, delete key |

**Cache patterns:**
- **Cache-aside** for dashboard KPIs and frequently read data
- **Write-through** for agent status (always written to both cache and DB)
- **Cache invalidation** on every successful mutation via event hooks in the Core API

### 3.3 Data Partitioning

- **Tenant isolation:** All tenant-scoped queries filtered by `tenantId`. Enforced at the ORM level via Prisma middleware or at the database level via Row-Level Security (RLS).
- **Time partitioning:** `AuditLog` and `SecurityEvent` tables partitioned by month using PostgreSQL native declarative partitioning.
- **Hot/cold separation:** Current election cycle data resides on fast SSD storage. Data older than 90 days is archived to S3/MinIO in Parquet format and can be restored on demand.

---

## 4. Integration Architecture

### 4.1 Inter-Service Communication

| Pattern | Technology | Use Case |
|---|---|---|
| Synchronous | HTTP/REST + JWT Bearer | API Gateway → Backend services |
| Asynchronous | Redis pub/sub | Real-time service → WebSocket clients |
| Background Tasks | Celery + Redis broker | Report generation, bulk messaging, scheduled jobs |
| Direct | gRPC (future) | High-throughput internal service-to-service calls |

**Service discovery:** Docker Compose service names in development. Kubernetes DNS in production.

**API contract:** OpenAPI 3.1 specification generated from FastAPI annotations. Shared via a central API registry or Git repository.

### 4.2 External Integrations

| Integration | Protocol | Purpose | SLA Requirement |
|---|---|---|---|
| WhatsApp Business API | HTTPS REST | Alert delivery to field agents | 99.9% |
| X/Twitter API v2 | OAuth 2.0 + REST | OSINT incident detection | Best-effort |
| Facebook Graph API | OAuth 2.0 + REST | OSINT incident detection | Best-effort |
| YouTube Data API v3 | API Key + REST | OSINT video monitoring | Best-effort |
| CARTO Map Tiles | HTTPS | Basemap rendering | 99.9% |
| OpenStreetMap | HTTPS | Fallback basemap tiles | 99.9% |
| AI/ML Model Server | gRPC/REST | Inference requests | 99.5% |
| SMS Gateway (Twilio/Africa's Talking) | HTTPS REST | Non-WhatsApp alert delivery | 99.9% |
| Email Service (AWS SES / SendGrid) | SMTP / HTTPS | Report delivery, notifications | 99.9% |

**Circuit breakers** are implemented for all external integrations using the circuit-breaker pattern (half-open, open, closed states) with configurable thresholds and timeouts.

---

## 5. Scalability Strategy

### 5.1 Horizontal Scaling

- **Next.js Frontend:** Fully stateless. Scale by adding instances behind the ALB. Session state stored in Redis.
- **API Services (Auth, Core, ML/AI):** Stateless. Scale independently based on load metrics.
- **Real-Time Service:** Stateful (WebSocket connections). Use sticky sessions at the load balancer with Redis pub/sub as the backplane for cross-instance message fan-out.
- **Worker Service:** Scale Celery worker count based on queue depth.
- **Database:** Read replicas absorb read-heavy dashboard queries. Primary handles all writes.

### 5.2 Scaling Targets

| Metric | Current (Prototype) | Target (State Election) | Target (Presidential) |
|---|---|---|---|
| Concurrent Users | ~10 | 500 | 5,000 |
| Polling Units Monitored | ~400 | 5,000 | 120,000+ |
| Incidents per Day | ~50 | 2,000 | 50,000 |
| API Requests per Minute | ~50 | 5,000 | 100,000 |
| Database Size | ~50 MB | 2 GB | 50 GB |
| WhatsApp Messages per Hour | ~20 | 500 | 20,000 |
| WebSocket Connections | 0 | 200 | 3,000 |
| Uptime SLA | None | 99.5% | 99.9% |

### 5.3 Auto-Scaling Rules

| Component | Metric | Threshold | Action |
|---|---|---|---|
| Next.js Frontend | CPU utilization | > 70% for 5 min | Scale up (add 1 instance, max 10) |
| Core API Service | Request queue depth | > 100 pending | Scale up (add 1 instance, max 8) |
| ML/AI Service | GPU utilization | > 80% for 3 min | Scale up (add 1 GPU instance, max 4) |
| Celery Workers | Queue depth | > 500 tasks | Scale up (add 2 workers, max 16) |
| Real-Time Service | WebSocket connections per instance | > 500 | Scale up (add 1 instance, max 8) |
| Database (PostgreSQL) | Connection pool usage | > 80% | Add read replica |
| Redis | Memory usage | > 75% | Scale vertically or add Redis Cluster shard |

---

## 6. Security Architecture

### 6.1 Authentication & Authorization

- **Zero-trust model:** Every inter-service call must present a valid JWT. No service-to-service trust based on network position alone.
- **JWT specification:** RS256 signed (asymmetric), 15-minute access token, 7-day refresh token with rotation. Token payload includes: `sub` (user ID), `tenantId`, `roles[]`, `permissions[]`, `iat`, `exp`.
- **Multi-factor authentication:** TOTP-based MFA for admin and elevated-privilege accounts.
- **RBAC enforcement:** Roles defined as `SUPER_ADMIN`, `TENANT_ADMIN`, `ANALYST`, `FIELD_AGENT`, `VIEWER`. Permissions checked at the API route level via middleware.

### 6.2 Network Security

- **mTLS:** Mutual TLS between all internal services. Each service presents a client certificate signed by an internal CA.
- **VPC isolation:** All services deployed within a private VPC subnet. Only the ALB and API Gateway have public IPs.
- **Security groups:** Strict ingress/egress rules. Services can only communicate on their designated ports.
- **WAF:** Cloudflare or AWS WAF in front of the ALB. Rules for SQL injection, XSS, rate limiting, and bot detection.

### 6.3 Data Security

- **Encryption at rest:** AES-256 for database storage, S3 buckets, and Redis (if persistent).
- **Encryption in transit:** TLS 1.3 for all external connections. mTLS for all internal connections.
- **Secrets management:** HashiCorp Vault or AWS Secrets Manager. No secrets in environment variables or code.
- **Audit logging:** All data mutations logged to `AuditLog` table with: actor ID, action, resource type, resource ID, timestamp, IP address, user agent, diff snapshot.

### 6.4 DDoS Protection

- Cloudflare DDoS protection (L3/L4/L7).
- Rate limiting at WAF, API Gateway, and application level (three layers).
- Geographic restrictions: restrict admin access to known IP ranges during election day.

---

## 7. Reliability Architecture

### 7.1 Uptime Target

| Event Type | Uptime SLA | Maximum Allowed Downtime |
|---|---|---|
| Normal Operations | 99.9% | 8.6 minutes / day |
| Election Day | 99.99% | 52.6 seconds / day |
| Post-Election Analysis | 99.5% | 43.2 minutes / day |

### 7.2 High Availability

- **Multi-AZ deployment:** All services deployed across at least 2 availability zones.
- **Automated failover:** PostgreSQL automatic failover with repmgr or Patroni. If the primary goes down, a replica is promoted within 30 seconds.
- **Health checks:** Every service exposes a `/health` endpoint. The load balancer removes unhealthy instances from the rotation.
- **Graceful degradation:**
  - ML/AI service down → fall back to rule-based classification
  - WhatsApp service down → queue messages for retry; switch to SMS
  - Real-time service down → users poll via REST API (degraded experience, not a hard failure)
  - Replica database down → route reads to primary (slower but functional)

### 7.3 Disaster Recovery

- **RPO (Recovery Point Objective):** 5 minutes (PostgreSQL WAL shipping to S3 every 5 minutes)
- **RTO (Recovery Time Objective):** 30 minutes (automated infrastructure provisioning via Terraform)
- **Backups:** Daily full backups to S3, retained for 1 year. Point-in-time recovery enabled.
- **Runbook:** Documented procedures for common failure scenarios. Drills conducted quarterly.

### 7.4 Circuit Breakers

All external service calls (WhatsApp API, OSINT APIs, Email service, ML inference) are wrapped in circuit breakers with:
- **Closed state:** Normal operation. Failure count tracked in a sliding window.
- **Open state:** After N consecutive failures (default: 5), the circuit opens. All calls return a fallback immediately (no waiting).
- **Half-open state:** After a cooldown period (default: 30 seconds), allow one test request. If it succeeds, close the circuit. If it fails, keep it open.

---

## 8. Technology Decision Rationale

| Decision | Option A | Option B | Decision | Rationale |
|---|---|---|---|---|
| Primary Database | PostgreSQL | MySQL | **PostgreSQL** | Superior JSONB, full-text search, partitioning, and extension ecosystem (PostGIS for geospatial queries if needed) |
| Backend Language | Python / FastAPI | Go / Gin | **Python / FastAPI** | Faster development, direct integration with ML ecosystem (PyTorch, Hugging Face), larger talent pool for African dev teams |
| Cache / Message Broker | Redis | RabbitMQ | **Redis** | Dual role as cache + pub/sub + Celery broker. Simpler operational footprint. RabbitMQ adds unnecessary complexity for our message patterns |
| Task Queue | Celery | RQ / Dramatiq | **Celery** | Most mature Python task queue. Celery Beat for scheduled tasks. Large community and monitoring tooling (Flower) |
| Container Orchestration | Kubernetes | Docker Compose (production) | **Phase-dependent** | Docker Compose for Phase 1-3. Kubernetes for Phase 4-5 when scaling demands justify the operational complexity |
| WebSocket Framework | Socket.IO | Raw WebSockets (websockets lib) | **Socket.IO** | Built-in reconnection, fallback to long-polling, room-based broadcasting, broad client library support (React, mobile) |
| API Documentation | OpenAPI / FastAPI auto-gen | Swagger handwritten | **OpenAPI / FastAPI auto-gen** | FastAPI generates OpenAPI specs from type annotations. Zero maintenance overhead |
| Secrets Management | AWS Secrets Manager | HashiCorp Vault | **AWS Secrets Manager** | Simpler integration if deploying on AWS. Vault is superior but adds significant operational overhead |
| CDN | CloudFront | Cloudflare | **Cloudflare** | DDoS protection included, WAF included, simpler DNS management, free tier sufficient for development |
| Monitoring | Prometheus + Grafana | Datadog | **Prometheus + Grafana** | Open-source, no per-host licensing costs, deep Kubernetes integration. Datadog considered if budget allows for reduced operational overhead |

---

## 9. Migration Roadmap

### Phase 1 — Foundation (v2.2) — 4 Weeks

**Goal:** Add authentication, migrate to PostgreSQL, introduce Redis caching.

| Task | Owner | Duration | Dependencies |
|---|---|---|---|
| Add Prisma PostgreSQL adapter and migrate schema | Backend Dev | 1 week | None |
| Deploy PostgreSQL + PgBouncer | DevOps | 3 days | None |
| Implement Auth Service (FastAPI) | Backend Dev | 2 weeks | PostgreSQL |
| Add JWT middleware to all API routes | Backend Dev | 1 week | Auth Service |
| Deploy Redis | DevOps | 2 days | None |
| Implement dashboard KPI caching | Backend Dev | 1 week | Redis |
| Add rate limiting to API Gateway | Backend Dev | 3 days | Redis |
| Data migration (SQLite → PostgreSQL) | Backend Dev | 2 days | PostgreSQL |

**Deliverable:** Authenticated, PostgreSQL-backed platform with caching. Still monolithic but production-ready for small deployments.

### Phase 2 — Service Extraction (v2.3) — 4 Weeks

**Goal:** Extract ML/AI service and WhatsApp service as independent microservices.

| Task | Owner | Duration | Dependencies |
|---|---|---|---|
| Build ML/AI service scaffolding (FastAPI) | ML Engineer | 1 week | Phase 1 |
| Implement NLP incident classification | ML Engineer | 2 weeks | ML/AI Service |
| Extract WhatsApp service | Backend Dev | 1 week | Phase 1 |
| Secure Go WhatsApp Bridge (add auth) | Backend Dev | 3 days | WhatsApp Service |
| Implement circuit breakers for external calls | Backend Dev | 1 week | Phase 1 |
| Set up API Gateway (Nginx / Traefik) | DevOps | 3 days | All services |

**Deliverable:** Three-service architecture (Core API + ML/AI + WhatsApp) behind an API Gateway.

### Phase 3 — Real-Time and Background Processing (v3.0) — 4 Weeks

**Goal:** Add WebSocket real-time updates and Celery background workers.

| Task | Owner | Duration | Dependencies |
|---|---|---|---|
| Build Real-Time Service (WebSocket + Redis pub/sub) | Backend Dev | 2 weeks | Phase 2 |
| Integrate real-time alerts in frontend | Frontend Dev | 1 week | Real-Time Service |
| Set up Celery workers and task queue | Backend Dev | 1 week | Phase 2, Redis |
| Implement dead-man's switch (Celery Beat) | Backend Dev | 3 days | Celery |
| Implement background report generation | Backend Dev | 1 week | Celery |
| Add audit logging middleware | Backend Dev | 3 days | Phase 1 |

**Deliverable:** Six-service architecture with real-time capabilities and background job processing.

### Phase 4 — Mobile and Offline Support (v3.1) — 6 Weeks

**Goal:** Mobile applications for field agents with offline-first capabilities.

| Task | Owner | Duration | Dependencies |
|---|---|---|---|
| Build React Native mobile app (iOS + Android) | Mobile Dev | 3 weeks | Phase 3 Core API |
| Implement offline data sync (CRDTs or conflict resolution) | Mobile Dev | 2 weeks | Mobile App |
| Implement push notifications (FCM/APNs) | Mobile Dev | 1 week | Mobile App |
| Field agent onboarding flow | Frontend Dev | 1 week | Phase 3 Auth Service |
| Stress test at state-election scale | QA / DevOps | 1 week | All services |

**Deliverable:** Mobile-first field agent experience with offline support. Validated at state-election scale.

### Phase 5 — Full Production (v4.0) — 8 Weeks

**Goal:** Kubernetes deployment, full observability, validated at presidential-election scale.

| Task | Owner | Duration | Dependencies |
|---|---|---|---|
| Containerize all services (Docker) | DevOps | 1 week | Phase 4 |
| Kubernetes manifests (Helm charts) | DevOps | 2 weeks | Docker images |
| Set up Prometheus + Grafana monitoring | DevOps | 1 week | Kubernetes |
| Set up structured logging (ELK / Loki) | DevOps | 1 week | Kubernetes |
| Implement automated CI/CD pipeline | DevOps | 1 week | All services |
| Load testing at presidential-election scale | QA | 2 weeks | All infrastructure |
| Security audit and penetration testing | Security | 1 week | All services |
| Disaster recovery drill | DevOps + All | 2 days | All infrastructure |
| Documentation and runbooks | All | Ongoing | All phases |

**Deliverable:** Production-grade, Kubernetes-deployed platform validated at presidential-election scale with full observability and security.

---

## 10. Cost Estimation

### 10.1 Development Costs

| Role | Count | Duration | Monthly Rate (USD) | Total (USD) |
|---|---|---|---|---|
| Senior Backend Developer (Python/Node) | 2 | 6 months | $6,000 | $72,000 |
| Senior Frontend Developer (React/Next.js) | 1 | 6 months | $5,500 | $33,000 |
| ML Engineer | 1 | 4 months | $7,000 | $28,000 |
| Mobile Developer (React Native) | 1 | 3 months | $5,000 | $15,000 |
| DevOps Engineer | 1 | 4 months | $6,500 | $26,000 |
| Security Specialist (part-time) | 1 | 2 months | $7,000 | $14,000 |
| QA Engineer | 1 | 3 months | $4,000 | $12,000 |
| **Total Development** | | | | **$200,000** |

### 10.2 Infrastructure Costs (AWS)

| Resource | Specification | Monthly Cost (USD) | Notes |
|---|---|---|---|
| EKS Cluster (management) | 1 cluster, 2 AZs | $73 | Control plane |
| EC2 Worker Nodes (normal) | 5× m6i.xlarge | $700 | Core services |
| EC2 Worker Nodes (GPU) | 1× g4dn.xlarge | $580 | ML inference |
| RDS PostgreSQL | db.r6g.xlarge (multi-AZ) | $620 | Primary + 2 read replicas |
| ElastiCache Redis | cache.r6g.large (cluster) | $250 | Cache + pub/sub |
| S3 Storage | 100 GB | $2.50 | Media + backups |
| CloudFront CDN | ~500 GB/month | $45 | Static assets + map tiles |
| Application Load Balancer | 2 ALBs | $40 | Public + internal |
| Secrets Manager | N/A | $10 | |
| CloudWatch | Logs + metrics | $50 | |
| SES (Email) | ~10,000 emails/month | $10 | |
| **Monthly Total (Normal Operations)** | | **$2,380** | |

**Election Day Spike (3 days):**

| Resource | Additional Cost (USD) | Notes |
|---|---|---|
| Additional EC2 nodes (auto-scaled) | $800 | Peak for 72 hours |
| Additional RDS IOPS | $200 | Write-heavy period |
| Additional CloudFront transfer | $150 | Heavy dashboard usage |
| **Election Day Total (3 days)** | **$1,150** | |

**Annual Infrastructure Estimate:** ~$30,000 (including election day spikes and 30-day pre/post election elevated capacity).

### 10.3 Third-Party Service Costs

| Service | Usage | Monthly Cost (USD) |
|---|---|---|
| WhatsApp Business API (Meta) | 20,000 messages/month | $1,000 (conversation-based pricing) |
| X/Twitter API (Basic) | OSINT monitoring | $100 |
| Facebook Graph API | OSINT monitoring | $0 (free tier) |
| YouTube Data API | OSINT monitoring | $0 (free tier) |
| SMS Gateway (Africa's Talking) | 5,000 messages/month | $200 |
| Cloudflare (Pro Plan) | WAF + DDoS | $20 |
| **Monthly Third-Party Total** | | **$1,320** |

### 10.4 Total Cost Summary

| Category | One-Time | Monthly | Annual |
|---|---|---|---|
| Development | $200,000 | — | — |
| Infrastructure | — | $2,380 | $28,560 |
| Third-Party Services | — | $1,320 | $15,840 |
| Contingency (20%) | — | $740 | $8,880 |
| **Grand Total (Year 1)** | **$200,000** | **$4,440** | **$53,280** |

**Year 1 Total Investment: ~$253,280**

**Ongoing Annual Cost (post-development): ~$53,280**

---

## Appendix A: Key Architecture Principles

1. **Tenant isolation is non-negotiable.** Every data access path must filter by `tenantId`. No exceptions, not even in admin tools.
2. **Graceful degradation over hard failure.** If any service is unavailable, the system should degrade gracefully rather than return errors to users.
3. **Audit everything.** Every state change, every API call, every login attempt is logged. This is an election monitoring system — auditability is a legal requirement.
4. **Offline-first for field agents.** Field agents operate in areas with poor connectivity. The mobile app must function fully offline and sync when connectivity is restored.
5. **Security by default.** Every new endpoint is authenticated by default. Every new service has mTLS enabled by default. Every external call goes through a circuit breaker.
6. **Measure everything.** If you can't measure it, you can't improve it. Every service exposes metrics. Every external call is traced. Every failure is alerted.

## Appendix B: Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Database migration data loss | Low | Critical | Full backup before migration. pgloader with validation. Rollback plan. |
| ML model accuracy insufficient | Medium | Medium | Rule-based fallback always available. Incremental model improvement. |
| WhatsApp API rate limits exceeded | Medium | High | Implement backoff and queuing. Pre-register message templates. |
| Election-day traffic exceeds estimates | Medium | High | Auto-scaling with generous headroom. Load test at 2× expected peak. |
| Single cloud provider outage | Low | Critical | Multi-AZ deployment. Terraform IaC for rapid re-deployment. Consider multi-cloud for Phase 5+. |
| Developer attrition during migration | Medium | Medium | Comprehensive documentation. Standardized tech stack (Python/FastAPI). Knowledge sharing sessions. |

---

*This document is a living reference. Update it as architecture decisions are made, revised, or validated through load testing and production experience.*