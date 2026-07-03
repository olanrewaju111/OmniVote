# 11 — Microservices Architecture Guide

**Role**: Senior Microservices Designer & Architect
**Platform**: OmniVote Monitor v2.1
**Classification**: Architecture Decision Record (ADR)
**Last Updated**: 2025-07-12

---

## Overview

OmniVote Monitor v2.1 is currently a Next.js monolith backed by SQLite, serving 3 tenants, 23 Prisma data models, and 28 API routes. This document provides the definitive blueprint for decomposing the monolith into a distributed microservices architecture targeting scalability, fault isolation, independent deployability, and team autonomy.

The decomposition follows **Domain-Driven Design (DDD)** principles: each microservice owns a bounded context, its own database, and exposes a well-defined API. Communication between services is split between synchronous REST calls (for request-response patterns) and asynchronous event-driven messaging (for side effects and eventual consistency).

---

## 1. Microservice Decomposition Strategy

### 1.1 Decomposition Principles

| Principle | Description |
|---|---|
| **Business capability-driven** | Each service aligns to a single bounded context from the domain model. No service spans unrelated capabilities. |
| **Data ownership** | Each service owns its data exclusively. No shared database access between services. Cross-service data is exchanged through APIs or events. |
| **API-first** | Every service exposes a well-defined, versioned REST API. Contracts are documented with OpenAPI 3.1 specifications before implementation begins. |
| **Independent deployment** | Services are packaged as containers and deployed independently without coordinated releases. A change to the Evidence Service must never block a release of the Incident Service. |
| **Failure isolation** | One service failure must not cascade to others. Circuit breakers, bulkheads, and graceful degradation ensure the system remains partially available under partial failure. |
| **Single responsibility** | A service should be small enough for one team to own, but large enough to deliver meaningful business value on its own. |

### 1.2 Domain-Driven Design — Bounded Contexts

The 23 Prisma models are mapped to 8 bounded contexts. Each context becomes one microservice.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        OmniVote Monitor v2.1                            │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │   Identity   │  │   Election   │  │   Incident   │  │Intelligence │ │
│  │   Context    │  │   Context    │  │   Context    │  │   Context   │ │
│  │              │  │              │  │              │  │             │ │
│  │ • User       │  │ • Election   │  │ • Incident   │  │ • OsintPost │ │
│  │ • AuditLog   │  │ • PollingUnit│  │ • Alert      │  │ • Campaign- │ │
│  │ • Tenant     │  │ • Election-  │  │ • VoterSupp- │  │   Event     │ │
│  │              │  │   Result     │  │   ressReport │  │             │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │   Evidence   │  │    Field     │  │   Campaign   │  │  Security   │ │
│  │   Context    │  │  Operations  │  │   Context    │  │   Context   │ │
│  │              │  │   Context    │  │              │  │             │ │
│  │ • Evidence-  │  │ • Agent-     │  │ • Campaign   │  │ • Security- │ │
│  │   Dossier    │  │   Message    │  │ • Campaign-  │  │   Event     │ │
│  │ • StegoScan- │  │ • Agent-     │  │   Message    │  │ • Honeypot- │ │
│  │   Result     │  │   CheckIn    │  │ • Contact-   │  │   Unit      │ │
│  │ • PvtSub-    │  │ • DeadMans-  │  │   List       │  │ • Flash-    │ │
│  │   mission    │  │   Switch     │  │              │  │   point-    │ │
│  │ • Result-    │  │ • Geofence-  │  │              │  │   Forecast  │ │
│  │   Comparison │  │   Zone       │  │              │  │ • Wargame-  │ │
│  │              │  │              │  │              │  │   Scenario  │ │
│  │              │  │              │  │              │  │ • Accessi-  │ │
│  │              │  │              │  │              │  │   bility-   │ │
│  │              │  │              │  │              │  │   Report    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Service Catalog

---

#### Service 1: Identity Service — Port 8000

| Attribute | Value |
|---|---|
| **Framework** | Python 3.12 / FastAPI |
| **Database** | PostgreSQL — `identity_db` (users, tenants, audit_logs) |
| **Port** | 8000 |

**Responsibilities**: Authentication (JWT issuance & validation), authorization (RBAC/ABAC), user management (CRUD, lock/unlock, role assignment), tenant management (multi-tenancy isolation), session management, device trust & fingerprinting, password policy enforcement.

**API Endpoints**:

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/login` | Authenticate user, issue JWT (access + refresh) |
| `POST` | `/auth/logout` | Revoke session, blacklist refresh token |
| `POST` | `/auth/refresh` | Issue new access token from refresh token |
| `GET` | `/users` | List users (tenant-scoped) |
| `POST` | `/users` | Create user (admin-only) |
| `PATCH` | `/users/{id}` | Update user (profile, role, lock status) |
| `GET` | `/tenants` | List tenants |
| `POST` | `/tenants` | Create tenant |
| `DELETE` | `/tenants/{id}` | Deactivate tenant |

**Events Published**: `USER_CREATED`, `USER_LOCKED`, `ROLE_CHANGED`, `SESSION_CREATED`, `TENANT_CREATED`
**Events Consumed**: None — Identity is the root service; it does not depend on other services.

**Key Decisions**:
- JWT tokens are signed with RS256 (asymmetric). The private key stays in the Identity Service; other services validate tokens using the public key.
- Refresh tokens are stored in the database (not in-memory) to survive restarts and enable revocation.
- Tenant isolation is enforced at the middleware level: every request must include a `X-Tenant-ID` header validated against the user's authorized tenants.

---

#### Service 2: Election Service — Port 8001

| Attribute | Value |
|---|---|
| **Framework** | Python 3.12 / FastAPI |
| **Database** | PostgreSQL — `election_db` (elections, polling_units, election_results) |
| **Port** | 8001 |

**Responsibilities**: Election lifecycle management (create, open, close, archive), polling unit registry and geospatial queries, official result submission and validation, PVT (Parallel Vote Tabulation) submission, result comparison (official vs. PVT), real-time coverage tracking (% of polling units reporting).

**API Endpoints**:

| Method | Path | Description |
|---|---|---|
| `GET` | `/elections` | List elections (tenant-scoped) |
| `POST` | `/elections` | Create election |
| `GET` | `/elections/{id}` | Get election with result summary |
| `GET` | `/polling-units` | List polling units (filterable by constituency) |
| `POST` | `/results` | Submit official result |
| `POST` | `/pvt` | Submit PVT result |
| `POST` | `/pvt/compare` | Run official vs. PVT comparison, return delta |

**Events Published**: `RESULT_SUBMITTED`, `PVT_SUBMITTED`, `ANOMALY_DETECTED`, `ELECTION_CLOSED`
**Events Consumed**: `ELECTION_CREATED` (from Identity — triggers coverage dashboard init)

**Key Decisions**:
- Result comparison runs a configurable threshold engine: if the deviation between official and PVT exceeds N% (tenant-configurable), an `ANOMALY_DETECTED` event is emitted, which the Incident Service picks up to auto-create an incident.
- Polling unit geospatial data uses PostGIS extensions for efficient radius and bounding-box queries.

---

#### Service 3: Incident Service — Port 8002

| Attribute | Value |
|---|---|
| **Framework** | Python 3.12 / FastAPI |
| **Database** | PostgreSQL — `incident_db` (incidents, alerts, voter_suppression_reports) |
| **Port** | 8002 |

**Responsibilities**: Incident CRUD with full lifecycle (open → investigating → resolved → closed), alert management with severity classification (LOW, MEDIUM, HIGH, CRITICAL), escalation rules engine, voter suppression report tracking, deduplication of near-duplicate incidents, SLA timer management.

**API Endpoints**:

| Method | Path | Description |
|---|---|---|
| `GET` | `/incidents` | List incidents (filterable by status, severity, constituency) |
| `POST` | `/incidents` | Create incident |
| `PATCH` | `/incidents/{id}` | Update incident (status, assignee, severity) |
| `GET` | `/alerts` | List alerts |
| `PATCH` | `/alerts/{id}` | Mark alert as read/acknowledged |
| `POST` | `/voter-suppression` | Submit voter suppression report |
| `GET` | `/voter-suppression/stats` | Aggregated suppression statistics |

**Events Published**: `INCIDENT_CREATED`, `INCIDENT_UPDATED`, `INCIDENT_ESCALATED`, `ALERT_TRIGGERED`, `ALERT_READ`, `SUPPRESSION_REPORTED`
**Events Consumed**: Coordinate events from Field Operations Service, `ANOMALY_DETECTED` from Election Service, `HONEYPOT_DEVIATION` from Security Service.

**Key Decisions**:
- Severity classification uses a rule engine (initially regex + keyword matching; later ML-based) that auto-assigns severity on creation. Analysts can override.
- Escalation is timer-based: a CRITICAL incident unacknowledged for 15 minutes triggers an escalation event pushed to Campaign Service for emergency broadcast.

---

#### Service 4: Intelligence Service — Port 8003

| Attribute | Value |
|---|---|
| **Framework** | Python 3.12 / FastAPI |
| **Database** | PostgreSQL — `intelligence_db` (osint_posts, campaign_events) |
| **Port** | 8003 |

**Responsibilities**: OSINT (Open Source Intelligence) ingestion from social media APIs and RSS feeds, sentiment analysis per post, CIB (Coordinated Inauthentic Behavior) detection, bot account detection, campaign event tracking and timeline, voter suppression narrative analysis.

**API Endpoints**:

| Method | Path | Description |
|---|---|---|
| `GET` | `/osint` | Query OSINT posts (filterable by platform, sentiment, date range) |
| `GET` | `/osint/{id}` | Get single post with analysis |
| `GET` | `/campaign-events` | List campaign events |
| `POST` | `/campaign-events` | Create campaign event |
| `GET` | `/intelligence/summary` | Aggregated intelligence dashboard data |
| `POST` | `/intelligence/analyze` | Trigger on-demand analysis of a URL or text |

**Events Published**: `OSINT_INGESTED`, `DISINFORMATION_DETECTED`, `CIB_DETECTED`, `SENTIMENT_SHIFT`
**Events Consumed**: External scheduler triggers (cron-like ingestion jobs); `INCIDENT_CREATED` (link related OSINT posts to incident).

**Key Decisions**:
- OSINT ingestion runs as background Celery tasks inside the service. A scheduler (external cron or APScheduler) triggers ingestion at configurable intervals per tenant.
- Sentiment analysis and CIB detection are model-based. The service loads ONNX or HuggingFace models at startup. Inference runs on CPU by default; GPU is optional for high-throughput tenants.
- Posts older than the election date + 90 days are archived to cold storage.

---

#### Service 5: Evidence Service — Port 8004

| Attribute | Value |
|---|---|
| **Framework** | Python 3.12 / FastAPI |
| **Database** | PostgreSQL — `evidence_db` (evidence_dossiers, stego_scan_results) |
| **Object Storage** | S3-compatible (MinIO for dev, AWS S3 for prod) |
| **Port** | 8004 |

**Responsibilities**: Evidence dossier creation and management, media upload handling (images, video, audio), C2PA (Coalition for Content Provenance and Authenticity) signing, steganography scanning (hidden data detection in images/video), AI-powered content analysis (deepfake detection, metadata extraction), chain-of-custody tracking.

**API Endpoints**:

| Method | Path | Description |
|---|---|---|
| `GET` | `/evidence` | List evidence dossiers |
| `POST` | `/evidence` | Create dossier (metadata + file upload) |
| `GET` | `/evidence/{id}` | Get dossier with file download URL (presigned) |
| `POST` | `/evidence/scan-stego` | Trigger steganography scan on uploaded file |
| `POST` | `/evidence/c2pa-sign` | Apply C2PA provenance signature |
| `GET` | `/evidence/{id}/verify` | Verify C2PA signature integrity |
| `POST` | `/evidence/{id}/analyze` | Trigger AI content analysis |

**Events Published**: `EVIDENCE_CREATED`, `STEGO_DETECTED`, `EVIDENCE_CERTIFIED`, `DEEPFAKE_SUSPECTED`
**Events Consumed**: `INCIDENT_CREATED` (auto-creates a dossier for HIGH/CRITICAL incidents so field agents can attach evidence immediately).

**Key Decisions**:
- File uploads go directly to S3 via presigned URLs (the API never proxies file bytes). This keeps the service lightweight and allows large file uploads without request timeout issues.
- Steganography scanning is async: the scan job is queued and the client polls or receives an event when complete.
- C2PA signing requires a hardware security module (HSM) or Cloud KMS in production. In dev, a self-signed certificate is used.

---

#### Service 6: Field Operations Service — Port 8005

| Attribute | Value |
|---|---|
| **Framework** | Python 3.12 / FastAPI |
| **Database** | PostgreSQL — `field_ops_db` (agent_messages, agent_check_ins, dead_mans_switches, geofence_zones) |
| **Port** | 8005 |

**Responsibilities**: Agent messaging (encrypted two-way communication), check-in management (scheduled and on-demand), dead-man's switch (automated SOS if agent misses check-in window), geofence zone management (virtual perimeters around polling units), engagement tracking (who reported what, when).

**API Endpoints**:

| Method | Path | Description |
|---|---|---|
| `GET` | `/engagement` | List agent engagement records |
| `POST` | `/engagement` | Record engagement (agent responded to incident) |
| `POST` | `/check-in` | Agent check-in (heartbeat) |
| `GET` | `/check-in/status` | Dashboard of all agent check-in statuses |
| `GET` | `/geofence` | List geofence zones |
| `POST` | `/geofence` | Create geofence zone |
| `POST` | `/geofence/check-in` | Geofenced check-in (validates location) |
| `POST` | `/sos` | Emergency SOS — immediately escalates |

**Events Published**: `AGENT_CHECKED_IN`, `AGENT_IDLE`, `DEAD_MANS_TRIGGERED`, `SOS_ACTIVATED`, `GEOFENCE_BREACH`
**Events Consumed**: `INCIDENT_CREATED` (triggers follow-up message to the reporting agent), `CAMPAIGN_STARTED` (pushes broadcast to agents in target zone).

**Key Decisions**:
- The dead-man's switch is a background worker that runs every N minutes. If an agent has not checked in within their configured window, the worker emits `DEAD_MANS_TRIGGERED`. The Incident Service and Campaign Service subscribe to this event for automated response.
- Geofence validation uses the Haversine formula for distance calculation. For high-density areas, a spatial index (PostGIS) is used.
- Agent messages are end-to-end encrypted. The service stores only encrypted payloads; the encryption keys are managed via a separate KMS.

---

#### Service 7: Campaign Service — Port 8006

| Attribute | Value |
|---|---|
| **Framework** | Python 3.12 / FastAPI |
| **Database** | PostgreSQL — `campaign_db` (campaigns, campaign_messages, contact_lists) |
| **Port** | 8006 |

**Responsibilities**: Campaign creation and lifecycle management, contact list management (segmentation, import/export), WhatsApp Business API (WABA) message sending, delivery tracking and read receipts, template management, WABA compliance (opt-in, opt-out), analytics (delivery rate, open rate, response rate).

**API Endpoints**:

| Method | Path | Description |
|---|---|---|
| `GET` | `/campaigns` | List campaigns |
| `POST` | `/campaigns` | Create campaign |
| `GET` | `/campaigns/{id}` | Campaign detail with stats |
| `GET` | `/campaigns/{id}/stats` | Campaign analytics (delivery, read, response rates) |
| `POST` | `/campaigns/{id}/send` | Trigger campaign send |
| `GET` | `/contacts` | List contacts (searchable, filterable) |
| `POST` | `/contacts` | Add contact |
| `POST` | `/contacts/import` | Bulk import contacts (CSV) |
| `GET` | `/contacts/segments` | List contact segments |
| `POST` | `/contacts/segments` | Create segment |

**Events Published**: `CAMPAIGN_STARTED`, `MESSAGE_SENT`, `DELIVERY_CONFIRMED`, `MESSAGE_FAILED`
**Events Consumed**: `USER_CREATED` (auto-add to configured contact segment), `SOS_ACTIVATED` (emergency broadcast), `DEAD_MANS_TRIGGERED` (alert broadcast).

**Key Decisions**:
- WABA integration uses the official Meta Cloud API. Rate limits are managed with a token bucket algorithm per phone number ID.
- Contact segments are dynamically evaluated (not materialized). A segment is defined by a query (e.g., "all agents in Constituency X who checked in today"), and membership is computed at send time.
- Delivery receipts arrive as webhooks from Meta. The service exposes a webhook endpoint that is registered with the Meta Developer Dashboard.

---

#### Service 8: Security Service — Port 8007

| Attribute | Value |
|---|---|
| **Framework** | Python 3.12 / FastAPI |
| **Database** | PostgreSQL — `security_db` (security_events, honeypot_units, flashpoint_forecasts, wargame_scenarios, accessibility_reports) |
| **Port** | 8007 |

**Responsibilities**: Security event logging and SIEM integration, honeypot unit management (decoy polling units to detect tampering attempts), flashpoint forecasting (predictive model for violence hotspots), wargame scenario management (what-if simulations), biometric analysis for agent verification, accessibility compliance reporting, full audit trail across all services.

**API Endpoints**:

| Method | Path | Description |
|---|---|---|
| `GET` | `/security/events` | List security events |
| `POST` | `/security/events` | Log security event (internal use) |
| `POST` | `/honeypot` | Create honeypot unit |
| `GET` | `/honeypot/status` | All honeypot statuses |
| `GET` | `/flashpoint` | List flashpoint forecasts |
| `POST` | `/flashpoint` | Generate new forecast (trigger ML pipeline) |
| `POST` | `/wargame` | Run wargame simulation |
| `GET` | `/wargame/{id}/results` | Get simulation results |
| `GET` | `/accessibility/reports` | List accessibility audit reports |

**Events Published**: `SECURITY_EVENT`, `HONEYPOT_DEVIATION`, `FLASHPOINT_ALERT`, `WARGAME_COMPLETED`
**Events Consumed**: **ALL events** from all services (for comprehensive audit trail). Subscribes to the global event topic with a wildcard.

**Key Decisions**:
- The Security Service consumes all events to build a unified audit trail. This is implemented by subscribing to a wildcard topic on the message broker (e.g., `omnivote.*` in RabbitMQ).
- Flashpoint forecasting uses a time-series model (Prophet or N-BEATS) trained on historical incident data. The model is retrained weekly.
- Wargame simulations are computationally expensive and run as background Celery tasks with a dedicated worker pool. Results are stored and retrievable.

---

## 2. Inter-Service Communication

### 2.1 Synchronous Communication (REST)

Synchronous HTTP calls are used when the caller **needs an immediate response** before proceeding (e.g., validating a user exists before creating an incident).

| Parameter | Value |
|---|---|
| **Protocol** | HTTP/1.1 (upgrade to HTTP/2 where supported) |
| **Authentication** | Service-to-service JWT (signed by Identity Service) |
| **Timeout (default)** | 5 seconds connect + read |
| **Timeout (ML ops)** | 30 seconds (stego scan, deepfake analysis, wargame) |
| **Retry** | 3 attempts, exponential backoff (1s, 2s, 4s) |
| **Jitter** | ±20% random jitter on each backoff interval |
| **Circuit breaker** | Opens after 5 consecutive failures; half-open after 30s |

**Service-to-service authentication flow**:
1. Each service stores the Identity Service's public key (JWKS endpoint).
2. When Service A calls Service B, it includes the original user's JWT in the `Authorization` header plus a `X-Service-Token` header with its own service credentials.
3. Service B validates both tokens: the user token (for authorization) and the service token (for trust).

### 2.2 Asynchronous Communication (Event-Driven)

Asynchronous messaging is used for **side effects**, **notifications**, and **eventual consistency** (e.g., after an incident is created, multiple services react independently).

| Parameter | Value |
|---|---|
| **Message broker** | RabbitMQ 3.13 (production), Redis Streams (development) |
| **Event format** | CloudEvents v1.0 specification (JSON envelope) |
| **Delivery guarantee** | At-least-once (consumer must be idempotent) |
| **Dead letter queue** | `omnivote.dlq` — events that fail after 5 processing attempts |
| **Schema registry** | Apicurio Registry with JSON Schema (evolvable, backward-compatible) |
| **Event retention** | 7 days in broker; archive to S3 after that |

**CloudEvents envelope example**:

```json
{
  "specversion": "1.0",
  "type": "com.omnivote.incident.created",
  "source": "/services/incident",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "time": "2025-07-12T14:30:00Z",
  "datacontenttype": "application/json",
  "data": {
    "incidentId": "inc_abc123",
    "severity": "HIGH",
    "tenantId": "tenant_001",
    "constituency": "Lagos Island",
    "description": "Ballot box snatching reported at PU 003"
  }
}
```

**Event topic naming convention**: `omnivote.<service>.<event>`
- `omnivote.identity.user_created`
- `omnivote.incident.incident_created`
- `omnivote.election.result_submitted`
- `omnivote.field_ops.sos_activated`

### 2.3 API Gateway

The API Gateway is the **single entry point** for all client-facing traffic. It never handles inter-service traffic (services call each other directly).

| Responsibility | Implementation |
|---|---|
| **Routing** | Path-based routing to backend services |
| **Authentication** | JWT validation (delegates to Identity Service JWKS) |
| **Rate limiting** | Per-tenant, per-user, per-IP (token bucket) |
| **Request logging** | Access logs with traceId for correlation |
| **CORS** | Configured per-environment (strict in prod, permissive in dev) |
| **Request/response transformation** | Strip internal headers, add tenant context |
| **Implementation** | Kong 3.x (production) or Traefik 3.x (staging) |

**Gateway route table**:

| Route Prefix | Target Service |
|---|---|
| `/api/v1/auth/*`, `/api/v1/users/*`, `/api/v1/tenants/*` | Identity Service (8000) |
| `/api/v1/elections/*`, `/api/v1/polling-units/*`, `/api/v1/results/*` | Election Service (8001) |
| `/api/v1/incidents/*`, `/api/v1/alerts/*`, `/api/v1/voter-suppression/*` | Incident Service (8002) |
| `/api/v1/osint/*`, `/api/v1/campaign-events/*`, `/api/v1/intelligence/*` | Intelligence Service (8003) |
| `/api/v1/evidence/*` | Evidence Service (8004) |
| `/api/v1/engagement/*`, `/api/v1/check-in/*`, `/api/v1/geofence/*`, `/api/v1/sos` | Field Operations Service (8005) |
| `/api/v1/campaigns/*`, `/api/v1/contacts/*` | Campaign Service (8006) |
| `/api/v1/security/*`, `/api/v1/honeypot/*`, `/api/v1/flashpoint/*`, `/api/v1/wargame/*` | Security Service (8007) |

---

## 3. Data Architecture

### 3.1 Database-per-Service Pattern

Each service owns and operates its own PostgreSQL database instance (or dedicated schema within a shared cluster in early stages).

| Service | Database Name | Tables |
|---|---|---|
| Identity | `identity_db` | `users`, `tenants`, `audit_logs` |
| Election | `election_db` | `elections`, `polling_units`, `election_results` |
| Incident | `incident_db` | `incidents`, `alerts`, `voter_suppression_reports` |
| Intelligence | `intelligence_db` | `osint_posts`, `campaign_events` |
| Evidence | `evidence_db` | `evidence_dossiers`, `stego_scan_results` |
| Field Ops | `field_ops_db` | `agent_messages`, `agent_check_ins`, `dead_mans_switches`, `geofence_zones` |
| Campaign | `campaign_db` | `campaigns`, `campaign_messages`, `contact_lists` |
| Security | `security_db` | `security_events`, `honeypot_units`, `flashpoint_forecasts`, `wargame_scenarios`, `accessibility_reports` |

**Rules**:
- No cross-service database queries. Period.
- Each service's migration scripts are co-located with its codebase.
- Schema changes in one service never require a coordinated deployment with another.

### 3.2 Shared Data (Cross-Service References)

When services need to reference data owned by another service, they store the **reference as a string** (UUID or business key), never as a foreign key.

| Reference | Stored As | Used By |
|---|---|---|
| `userId` | `VARCHAR(36)` (UUID string) | All services |
| `tenantId` | `VARCHAR(36)` (UUID string) | All services |
| `electionId` | `VARCHAR(36)` (UUID string) | Incident, Evidence, Field Ops |
| `pollingUnitId` | `VARCHAR(36)` (UUID string) | Incident, Evidence, Field Ops |
| `incidentId` | `VARCHAR(36)` (UUID string) | Evidence, Field Ops, Campaign |
| `agentId` | `VARCHAR(36)` (UUID string) | Field Ops, Campaign |

**Integrity enforcement**: Referential integrity across services is maintained at the **application level**, not the database level. When a user is deleted from Identity Service, an event is published, and consuming services handle cleanup in their own data (soft-delete or cascade via compensating transaction).

### 3.3 Data Consistency

| Pattern | When to Use | Example |
|---|---|---|
| **Eventual consistency** | Default for all cross-service operations | Incident created → dossier auto-created in Evidence Service |
| **Saga (orchestration)** | Multi-step workflows requiring rollback | Agent submits incident + alert triggered + message sent to field coordinator |
| **Saga (choreography)** | When no single coordinator exists | Election result submitted → anomaly detected → incident auto-created |
| **Compensating transaction** | Saga rollback steps | If campaign creation fails after contacts were segmented, de-segment the contacts |
| **Strong consistency** | Only for auth, legal, and financial operations | User login (must be atomic), payment processing |

**Saga example — Incident Submission Flow**:

```
Agent submits incident
    │
    ├─► [1] Incident Service creates incident record
    │       │
    │       ├─ success ─► [2] Publish INCIDENT_CREATED event
    │       │
    │       └─ failure ─► Return error to agent (no compensation needed)
    │
    ├─► [2] Evidence Service receives INCIDENT_CREATED
    │       └─► Creates empty dossier (failure → log warning, don't block)
    │
    ├─► [3] Field Operations Service receives INCIDENT_CREATED
    │       └─► Sends follow-up message to reporting agent
    │           └─ failure ─► Compensate: mark message as "pending retry"
    │
    └─► [4] Campaign Service receives INCIDENT_CREATED (if HIGH/CRITICAL)
            └─► Queues emergency broadcast
                └─ failure ─► Compensate: create retry job
```

---

## 4. Service Deployment

### 4.1 Container Strategy

Every service is packaged as a Docker container using a **multi-stage build**:

```
Stage 1 (builder):  Install dependencies, compile
Stage 2 (runtime):  Copy artifacts, run with non-root user
```

| Component | Base Image |
|---|---|
| Python services | `python:3.12-slim` |
| Next.js frontend (remaining) | `node:20-alpine` |
| Nginx (static assets) | `nginx:alpine` |

**Dockerfile conventions**:
- Multi-stage build (builder → runtime)
- Non-root user (`appuser`, UID 1000)
- Health check: `HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:800X/health || exit 1`
- Readiness check: `curl -f http://localhost:800X/ready` (validates DB connectivity)
- `.dockerignore` excludes tests, docs, `.git`, `__pycache__`

### 4.2 Orchestration

| Environment | Strategy |
|---|---|
| **Local Development** | Docker Compose with hot-reload volumes |
| **CI/CD Testing** | Docker Compose with ephemeral containers |
| **Staging** | Docker Compose or single Kubernetes namespace (1 replica per service) |
| **Production** | Kubernetes (Helm charts) with horizontal pod autoscaling (HPA) |

**Kubernetes resource template per service**:
- `Deployment`: 2–10 replicas (HPA based on CPU 70% / memory 80%)
- `Service`: ClusterIP per service (internal communication)
- `Ingress`: Via API Gateway (no direct external access to services)
- `ConfigMap`: Environment-specific configuration
- `Secret`: Credentials, API keys, DB passwords (sealed or external vault)
- `CronJob`: For scheduled tasks (OSINT ingestion, model retraining, dead-man's switch)

**Service Mesh** (production only):
- Istio or Linkerd for mTLS between all pods
- Automatic mutual TLS — no service-to-service traffic is unencrypted
- Traffic splitting for canary deployments
- Retry, timeout, and circuit breaker policies enforced at the mesh level

---

## 5. Observability

### 5.1 Distributed Tracing

| Component | Tool |
|---|---|
| **SDK** | OpenTelemetry Python SDK (`opentelemetry-api`, `opentelemetry-sdk`) |
| **Propagation** | W3C Trace Context headers (`traceparent`, `tracestate`) |
| **Backend** | Jaeger (self-hosted) or Grafana Tempo (cloud-native) |
| **Sampling** | 100% for errors, 10% for success (configurable) |

Every inter-service call must propagate the trace context. The API Gateway injects the root trace ID; all downstream services propagate it.

**Instrumentation targets**:
- HTTP client calls (outgoing requests to other services)
- HTTP server handlers (incoming requests)
- Database queries (via SQLAlchemy or asyncpg instrumentor)
- Message broker publish/consume (via RabbitMQ or Redis instrumentor)
- Celery task execution

### 5.2 Centralized Logging

| Component | Tool |
|---|---|
| **Library** | `structlog` (Python) — structured JSON logging |
| **Collection** | Promtail (scrapes container stdout) |
| **Backend** | Loki (log aggregation) |
| **Query** | LogQL in Grafana |
| **Retention** | 30 days hot, 1 year cold (S3) |

**Log entry format** (every log must include):

```json
{
  "timestamp": "2025-07-12T14:30:00.123Z",
  "level": "INFO",
  "service": "incident-service",
  "traceId": "abc123def456",
  "spanId": "789ghi",
  "tenantId": "tenant_001",
  "userId": "user_42",
  "message": "Incident created",
  "incidentId": "inc_abc123",
  "severity": "HIGH"
}
```

**Log levels**:
- `DEBUG`: Detailed diagnostic info (development only)
- `INFO`: Normal operations (startups, successful requests)
- `WARNING`: Degraded but recoverable (retry, fallback)
- `ERROR`: Request failure (unhandled exception, 5xx)
- `CRITICAL`: System-level failure (cannot serve requests)

### 5.3 Metrics

| Component | Tool |
|---|---|
| **Library** | `prometheus-fastapi-instrumentator` |
| **Collection** | Prometheus (scrape every 15s) |
| **Visualization** | Grafana dashboards |
| **Alerting** | Alertmanager → PagerDuty/Slack |

**Standard metrics (auto-instrumented)**:
- `http_requests_total` (counter, labeled by method, path, status_code)
- `http_request_duration_seconds` (histogram)
- `http_requests_in_progress` (gauge)

**Custom business metrics**:
- `omnivote_incidents_created_total` (counter, by severity, tenant)
- `omnivote_agents_active` (gauge)
- `omnivote_election_coverage_percent` (gauge, by election)
- `omnivote_message_queue_depth` (gauge, by queue)
- `omnivote_dead_mans_pending` (gauge)

**Dashboard views**:
- **Global**: System health overview (all services green/yellow/red)
- **Per-service**: Detailed metrics for each service
- **Business**: Election coverage, incident response times, agent activity
- **SLA**: Uptime, error budget, latency SLOs

---

## 6. Resilience Patterns

### 6.1 Circuit Breaker

Each service maintains a dedicated circuit breaker for every downstream service it calls.

| State | Behavior |
|---|---|
| **CLOSED** | Requests pass through normally. Failure counter resets after a successful request. |
| **OPEN** | All requests fail fast (return cached response or fallback). Timer starts (30s). |
| **HALF-OPEN** | Allow 1 probe request. If it succeeds → CLOSED. If it fails → OPEN (reset timer). |

Configuration (per service pair):
```yaml
circuit_breaker:
  failure_threshold: 5
  recovery_timeout: 30s
  half_open_max_calls: 1
```

**Implementation**: `circuitbreaker` Python library or resilience4j patterns applied at the HTTP client level.

### 6.2 Bulkhead

Thread pool isolation ensures that a slow or failing downstream service cannot exhaust the caller's resources.

```python
# Pseudocode — each downstream gets its own thread pool
http_client = {
    "identity":  ThreadPoolExecutor(max_workers=20),
    "election":   ThreadPoolExecutor(max_workers=10),
    "incident":   ThreadPoolExecutor(max_workers=15),
    # ...
}
```

When the thread pool for a specific downstream is exhausted, new requests to that downstream are rejected immediately (fail fast) while requests to other downstreams continue normally.

### 6.3 Retry with Exponential Backoff

| Parameter | Value |
|---|---|
| **Max retries** | 3 |
| **Backoff** | 1s → 2s → 4s (exponential) |
| **Jitter** | ±20% random (prevents thundering herd) |
| **Retryable status codes** | 408, 429, 500, 502, 503, 504 |
| **Non-retryable** | 400, 401, 403, 404, 409, 422 |

### 6.4 Timeout Budget

| Timeout Type | Default | ML Operations |
|---|---|---|
| **Connect** | 5 seconds | 5 seconds |
| **Read** | 10 seconds | 30 seconds |
| **Total** | 30 seconds | 60 seconds |

Timeouts are enforced at the HTTP client level. If a downstream exceeds its timeout budget, the circuit breaker records a failure.

---

## 7. Migration Strategy — Monolith to Microservices

### Phase 1: Strangler Fig Pattern (Weeks 1–2)

The existing Next.js monolith continues to serve all traffic. An API Gateway is deployed in front of it.

1. Deploy Kong (or Traefik) as a reverse proxy in front of the monolith.
2. All existing routes are proxied to the monolith. No behavior changes.
3. Verify gateway logs, metrics, and authentication pass-through.
4. **Do not extract any service yet.** This phase is purely about establishing the gateway.

### Phase 2: Incremental Service Extraction (Weeks 3–12)

Services are extracted one at a time, in the order below. Each extraction follows the same pattern:

1. **Build** the new service with its own database.
2. **Configure** the gateway to route the new service's paths to the new service (everything else still goes to monolith).
3. **Dual-write**: During the transition, the monolith also writes to the new service's database (or both are updated via events).
4. **Verify** data consistency between monolith and new service.
5. **Cut over**: Remove the route from the monolith. The new service is now the source of truth.
6. **Clean up**: Remove the dual-write logic from the monolith.

**Extraction order** (ordered by dependency and risk):

| Order | Service | Rationale |
|---|---|---|
| 1 | **Identity Service** | Foundation for auth. All other services depend on it. Extract first so other services can authenticate against it. |
| 2 | **Incident Service** | Core business domain. Highest traffic, most complex logic. Extracting it early unblocks the rest. |
| 3 | **Field Operations Service** | Real-time requirements (check-ins, SOS). Needs to be independent for reliability. |
| 4 | **Evidence Service** | Media processing (stego, C2PA) is CPU-intensive. Isolating it prevents it from affecting other services. |
| 5 | **Intelligence Service** | OSINT ingestion is I/O-heavy and runs on background workers. Naturally separable. |
| 6 | **Election Service** | Results and PVT have strict consistency requirements. Extract later when the patterns are well-established. |
| 7 | **Campaign Service** | WABA integration is an external dependency. Separate it to isolate third-party API rate limits. |
| 8 | **Security Service** | Consumes all events. Extract last so it can subscribe to the full event catalog from day one. |

### Phase 3: Monolith Decommission (Week 13+)

1. After all 8 services are extracted and verified, the Next.js API routes are removed.
2. The Next.js application is retained as a **frontend-only** application (or migrated to a separate SPA).
3. The SQLite database is archived and the PostgreSQL databases become the permanent source of truth.
4. The API Gateway is the sole entry point for all traffic.

---

## 8. Testing Strategy

### 8.1 Contract Testing (Pact)

Every service pair that communicates via REST must have a **Pact contract test**.

- The **consumer** (calling service) writes a contract specifying the expected response shape.
- The **provider** (called service) verifies it can fulfill the contract.
- Contracts are published to a Pact Broker and verified in CI/CD.

**Example**: The Incident Service (consumer) expects the Identity Service (provider) to return a user object with `{ id, email, role, tenantId }`. This contract is versioned and tested on every PR.

### 8.2 Integration Testing

A Docker Compose environment spins up all services (with test databases) and runs end-to-end integration tests.

```bash
# Run integration test suite
docker compose -f docker-compose.test.yml up --abort-on-container-exit
```

- Each service has a `tests/integration/` directory.
- Tests use `httpx.AsyncClient` to call service APIs.
- Test data is seeded per-test and cleaned up after.

### 8.3 Chaos Testing

To verify resilience patterns, chaos tests are run in staging:

| Test | Tool | What It Does |
|---|---|---|
| **Service kill** | Chaos Monkey (Litmus) | Randomly kills a service pod; verifies circuit breaker and graceful degradation |
| **Network partition** | Chaos Mesh | Simulates network partition between two services; verifies retry and fallback |
| **Latency injection** | Toxiproxy | Adds 5s latency to a downstream; verifies timeout enforcement |
| **CPU stress** | stress-ng | Spikes CPU on Evidence Service; verifies bulkhead isolation |

### 8.4 End-to-End Testing

Full-flow tests that exercise the entire system across all services:

- **Happy path**: Agent submits incident → dossier created → alert triggered → field coordinator messaged → campaign broadcast sent.
- **Failure path**: Identity Service down → all services return 503 (degraded mode) → cached auth tokens still work for read operations.
- **SOS path**: Agent triggers SOS → dead-man's switch fires → emergency broadcast sent → incident auto-created → dashboard updates in real-time.

---

## Appendix A: Port Allocation

| Service | Internal Port | Description |
|---|---|---|
| Identity Service | 8000 | User & tenant management |
| Election Service | 8001 | Elections, results, PVT |
| Incident Service | 8002 | Incidents, alerts, suppression |
| Intelligence Service | 8003 | OSINT, CIB detection |
| Evidence Service | 8004 | Evidence, stego, C2PA |
| Field Ops Service | 8005 | Agents, check-ins, geofence |
| Campaign Service | 8006 | Campaigns, contacts, WABA |
| Security Service | 8007 | Security events, honeypot, wargame |
| API Gateway | 8080 | Kong / Traefik |
| RabbitMQ | 5672 (AMQP), 15672 (Management) | Message broker |
| PostgreSQL | 5432 | Per-service databases |
| Redis | 6379 | Caching, session store |
| MinIO | 9000 | Object storage (dev) |
| Jaeger | 16686 (UI), 4317 (OTLP) | Distributed tracing |
| Prometheus | 9090 | Metrics collection |
| Grafana | 3000 | Dashboards & alerting |
| Loki | 3100 | Log aggregation |

---

## Appendix B: Technology Stack Summary

| Layer | Technology |
|---|---|
| **API Framework** | Python 3.12 + FastAPI 0.115+ |
| **Database** | PostgreSQL 16 (per-service) |
| **Object Storage** | MinIO (dev) / AWS S3 (prod) |
| **Message Broker** | RabbitMQ 3.13 (prod) / Redis Streams (dev) |
| **Caching** | Redis 7 (sessions, rate limits, query cache) |
| **Task Queue** | Celery 5 + Redis broker |
| **API Gateway** | Kong 3.x (prod) / Traefik 3.x (staging) |
| **Container Runtime** | Docker 27+ |
| **Orchestration** | Kubernetes 1.30+ with Helm |
| **Service Mesh** | Istio 1.22+ or Linkerd 2.15+ |
| **Tracing** | OpenTelemetry SDK → Jaeger / Grafana Tempo |
| **Logging** | structlog → Loki → Grafana |
| **Metrics** | prometheus-fastapi-instrumentator → Prometheus → Grafana |
| **CI/CD** | GitHub Actions (lint, test, build, deploy) |
| **Contract Testing** | Pact Python |
| **Chaos Testing** | Litmus / Chaos Mesh |
| **ML Inference** | ONNX Runtime / HuggingFace Transformers |
| **C2PA** | c2pa-python SDK |
| **Geospatial** | PostGIS 3.4 |

---

*This document is a living architecture guide. As services are extracted and patterns are validated, update this document to reflect the actual implementation decisions and lessons learned.*