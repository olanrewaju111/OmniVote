# OmniVote Monitor v2.1 — Senior DevOps Engineer Guide

> **Document ID:** 14-DEVOPS
> **Version:** 1.0
> **Classification:** Internal — Engineering
> **Last Updated:** 2025-01
> **Audience:** Senior DevOps Engineer, Platform Engineering, SRE

---

## Table of Contents

1. [Current Deployment Architecture](#1-current-deployment-architecture)
2. [CI/CD Pipeline Design](#2-cicd-pipeline-design)
3. [Containerization](#3-containerization)
4. [Infrastructure as Code](#4-infrastructure-as-code)
5. [Database Migration](#5-database-migration)
6. [Secret Management](#6-secret-management)
7. [Logging](#7-logging)
8. [Deployment Strategy](#8-deployment-strategy)
9. [Monitoring Setup](#9-monitoring-setup)
10. [Disaster Recovery](#10-disaster-recovery)
11. [Cost Optimization](#11-cost-optimization)

---

## 1. Current Deployment Architecture

### 1.1 Current Setup

The OmniVote Monitor v2.1 application is currently deployed as a **single bare-metal process** with minimal infrastructure abstraction. Understanding the existing state is critical before introducing changes.

| Component | Current State | Risk Level |
|---|---|---|
| **Runtime** | Bun (not Node.js) | Medium — less ecosystem tooling than Node |
| **Server** | Bun standalone server (`.next/standalone/server.js`) | Low — standard Next.js output |
| **Reverse Proxy** | Caddy (port 81 → localhost:3000) | Low — Caddy handles auto-TLS well |
| **Database** | SQLite file (`prisma/dev.db`) | **Critical** — no concurrent write support, no replication |
| **Containerization** | None | **Critical** — no isolation, no reproducibility |
| **CI/CD Pipeline** | None | **Critical** — manual builds and deployments |
| **Environment Separation** | None (dev = prod) | **Critical** — untested code reaches production |

### 1.2 Build Process

The current build and start sequence is straightforward but fragile:

```
bun run build          → next build → .next/standalone/
                        → copy static + public directories
bun run start          → NODE_ENV=production bun .next/standalone/server.js
```

**Key observations:**
- The build output is not versioned or tagged — there is no way to reliably identify which code is running in production.
- There is no build cache strategy; every deployment rebuilds from scratch.
- The `bun run start` command sets `NODE_ENV` inline, which is acceptable but should be formalized in an environment file or orchestrator.
- No health check endpoint is configured at the infrastructure level (Caddy does not perform active health checks).

### 1.3 External Dependencies

The application has a deliberately small dependency surface:

- **Go WhatsApp Bridge** at `localhost:9090` (optional) — used for real-time incident messaging. If unavailable, the application degrades gracefully (messages are queued or logged).
- **CDN: CARTO map tiles** (external) — read-only map rendering. No API keys required. Outage impacts map visualization only.
- **No external database** — currently all data is local SQLite.
- **No external cache** — no Redis, Memcached, or CDN for application data.
- **No message queue** — no RabbitMQ, Kafka, or SQS.

This minimal dependency footprint is an advantage for initial containerization but will need to grow as the system scales (see Section 5 for database migration and Section 3.2 for Redis introduction).

---

## 2. CI/CD Pipeline Design

### 2.1 Pipeline Stages

The CI/CD pipeline must be automated end-to-end. Below is the recommended four-stage pipeline with specific tooling and commands.

#### Stage 1: Code Quality

Every push to any branch triggers these checks. They must pass before merging.

| Check | Command | Purpose |
|---|---|---|
| Lint | `bun run lint` | ESLint 9 flat config — catches code quality issues |
| Type Check | `tsc --noEmit` | Ensures TypeScript type safety across the codebase |
| Format Check | `bunx prettier --check .` | Enforces consistent code style (if Prettier is configured) |
| Security Scan | `npm audit --audit-level=high` | Identifies known vulnerable dependencies |

**Failure policy:** Any failure blocks the merge. Results are posted as PR comments.

#### Stage 2: Testing

| Test Type | Command | When |
|---|---|---|
| Unit Tests | `bun test` | Every push |
| Integration Tests | `bun test:integration` | Every push to `develop` and `main` |
| E2E Tests | `bunx playwright test` | Pre-merge to `main` only |
| Security Tests | ZAP baseline scan | Nightly and pre-release |

**Coverage gates:** Minimum 80% line coverage for unit tests. Integration tests must cover all API routes. E2E tests must cover the critical path: login → dashboard → create incident → view map.

#### Stage 3: Build

```bash
# 1. Application build
bun run build

# 2. Docker image build
docker build -t omnivote/monitor:${CI_COMMIT_SHA} .
docker tag omnivote/monitor:${CI_COMMIT_SHA} omnivote/monitor:latest

# 3. Push to container registry
docker push omnivote/monitor:${CI_COMMIT_SHA}
docker push omnivote/monitor:latest
```

The Docker image is tagged with both the commit SHA (immutable) and `latest` (mutable convenience tag). Images are pushed to a private container registry (e.g., GitHub Container Registry, AWS ECR, or Harbor).

#### Stage 4: Deploy

| Step | Action | Trigger |
|---|---|---|
| Deploy to Staging | Automatic | Merge to `develop` or `main` |
| Smoke Tests | Automated | After staging deploy |
| Production Approval | Manual gate | After successful staging validation |
| Deploy to Production | Manual click | Approval granted |
| Production Smoke Tests | Automated | After production deploy |
| Automatic Rollback | Automated | If smoke tests fail |

**Smoke test suite (minimum):**
1. `GET /api` returns 200
2. `GET /api/health` returns 200 with `{ status: "ok" }`
3. `GET /` returns HTML with status 200
4. Database connectivity check via Prisma client query
5. WhatsApp Bridge connectivity check (non-blocking — warn only)

### 2.2 Branch Strategy

```
main (protected) ──────────────────────────────────→ Production
  │
  └── develop ─────────────────────────────────────→ Staging
        │
        ├── feature/VOM-123-add-alerting
        ├── feature/VOM-456-map-filtering
        └── hotfix/VOM-789-critical-fix ←── from main
```

| Branch | Purpose | Protection Rules |
|---|---|---|
| `main` | Production-ready code | Require 2 approvals, passing CI, no force push |
| `develop` | Integration branch | Require 1 approval, passing CI |
| `feature/*` | Feature development | No protection, squash merge to develop |
| `hotfix/*` | Emergency fixes from main | Require 1 approval, fast-track CI |
| `release/*` | Release preparation (optional) | Require 2 approvals, full test suite |

### 2.3 Environment Management

| Environment | Purpose | Database | Deployment Method | URL |
|---|---|---|---|---|
| **Development** | Local developer machines | SQLite (local file) | `bun run dev` | `localhost:3000` |
| **Staging** | Pre-production validation | PostgreSQL (staging instance) | Docker Compose | `staging.omnivote.internal` |
| **Production** | Live election monitoring | PostgreSQL (production, HA) | Kubernetes / Docker Swarm | `monitor.omnivote.org` |

**Critical rule:** The production environment must be as close to staging as possible. Any infrastructure difference between staging and production is a deployment risk. Use the same Docker images, the same orchestration, the same environment variable structure.

---

## 3. Containerization

### 3.1 Dockerfile (Multi-Stage Build)

The multi-stage Dockerfile is the foundation of reproducible deployments. It produces a minimal production image containing only the runtime and application artifacts.

```dockerfile
# ── Stage 1: Dependencies ──────────────────────────
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# ── Stage 2: Build ─────────────────────────────────
FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# ── Stage 3: Production Runtime ────────────────────
FROM oven/bun:1 AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy standalone Next.js server
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma schema for runtime migrations
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost:3000/api || exit 1

CMD ["bun", "server.js"]
```

**Key design decisions:**
- **`--frozen-lockfile`**: Ensures deterministic dependency resolution. The build fails if `bun.lock` is out of sync.
- **Multi-stage build**: The final image does not include build tools, source code, or development dependencies. Expected final image size: ~150-200 MB (Bun runtime + standalone Next.js).
- **Health check**: Caddy and Kubernetes both use this to determine container readiness.
- **Prisma schema copied**: Required for runtime `prisma migrate deploy` in the entrypoint script (not shown — add a custom entrypoint.sh if needed).

### 3.2 Docker Compose (Development)

This compose file provides a complete local development environment with all external services:

```yaml
services:
  app:
    build: .
    ports: ["3000:3000"]
    environment:
      - DATABASE_URL=file:./dev.db
      - WHATSAPP_BRIDGE_URL=http://whatsapp-bridge:9090
      - REDIS_URL=redis://redis:6379
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      whatsapp-bridge:
        condition: service_started
      redis:
        condition: service_healthy

  whatsapp-bridge:
    image: omnivote/whatsapp-bridge:latest
    ports: ["9090:9090"]
    profiles:
      - with-bridge

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: omnivote
      POSTGRES_USER: omnivote
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports: ["5432:5432"]
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U omnivote"]
      interval: 10s
      timeout: 3s
      retries: 5

volumes:
  pgdata:
```

**Notes:**
- The WhatsApp Bridge uses a Docker profile (`with-bridge`) so it only starts when explicitly requested: `docker compose --profile with-bridge up`.
- Redis is included for future caching and session storage. It is not yet used by the application but should be available for development.
- PostgreSQL is included for staging-like local development. Switch `DATABASE_URL` to `postgresql://omnivote:${DB_PASSWORD}@postgres:5432/omnivote` to use it.
- The `pgdata` named volume persists PostgreSQL data across `docker compose down/up` cycles.

### 3.3 Docker Compose (Production — Staging)

The production/staging compose file extends the development version with operational concerns:

- **Redis persistence**: Append `command: redis-server --appendonly yes` and add a named volume for `/data`.
- **PostgreSQL backups**: Add a `pgbackup` service using `postgres:16-alpine` with a cron job running `pg_dump` every hour, storing dumps to a mounted volume or S3.
- **Log rotation**: Add logging configuration to limit log file sizes: `"max-size": "10m", "max-file": "3"`.
- **Resource limits**: Add `deploy.resources.limits.cpus` and `memory` to every service to prevent resource starvation.
- **Restart policies**: All services use `restart: unless-stopped`.
- **Network isolation**: Use a custom bridge network with explicit internal/external port mappings.

---

## 4. Infrastructure as Code

### 4.1 Caddy Configuration

The current Caddy setup proxies port 81 to localhost:3000. For production, a full Caddyfile is required:

```caddyfile
{
    admin off
    servers {
        protocols h1 h2c
    }
}

monitor.omnivote.org {
    # Automatic HTTPS via Let's Encrypt
    encode gzip zstd

    # Security headers
    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(), microphone=(), geolocation=()"
        Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
    }

    # Rate limiting
    rate_limit {
        zone api {
            key {remote_host}
            events 100
            window 1m
        }
    }

    # Health check endpoint (bypass rate limit)
    @health path /api/health
    handle @health {
        reverse_proxy app:3000
    }

    # API routes with rate limiting
    @api path /api/*
    handle @api {
        rate_limit {
            zone api
        }
        reverse_proxy app:3000
    }

    # Static assets and pages
    handle {
        reverse_proxy app:3000
    }

    # Logging
    log {
        output file /var/log/caddy/access.log {
            roll_size 100mb
            roll_keep 5
        }
        format json
    }
}
```

### 4.2 Kubernetes Manifests (Production)

For production-grade deployment, Kubernetes provides the required scalability and resilience. Below is the manifest structure:

**Deployment (3 replicas):**
- Pod template with resource requests (CPU: 250m, Memory: 256Mi) and limits (CPU: 500m, Memory: 512Mi).
- Liveness probe on `/api/health` (failure → restart pod).
- Readiness probe on `/api/health` (failure → remove from service).
- Startup probe with 30-second initial delay for cold starts.
- `topologySpreadConstraints` to distribute pods across availability zones.

**Service:**
- Internal `ClusterIP` service for inter-pod communication (database, cache).
- External `LoadBalancer` or `NodePort` service for ingress.

**Ingress:**
- Caddy Ingress Controller or NGINX Ingress Controller.
- TLS termination at the ingress level.
- Path-based routing: `/api/*` → app service, `/*` → app service (same backend, separate for future splitting).

**ConfigMap:**
- Non-sensitive environment variables: `NEXT_PUBLIC_*`, `NODE_ENV`, `DATABASE_URL` (host part only), `REDIS_URL` (host part only).

**Secret:**
- Sensitive values: database password, JWT secret keys, WhatsApp Bridge API tokens. Use Kubernetes native `Secret` with `type: Opaque`. Consider Sealed Secrets or External Secrets Operator for GitOps workflows.

**PersistentVolumeClaim:**
- For database storage: 20 GiB SSD, `ReadWriteOnce`, `storageClass: ssd`.
- Backup PVC: 50 GiB for periodic database dumps.

**HorizontalPodAutoscaler:**
- Minimum replicas: 2 (always at least 2 for high availability).
- Maximum replicas: 10.
- Scale-up trigger: CPU utilization > 70% for 3 consecutive minutes.
- Scale-up trigger: HTTP request latency P99 > 500ms for 5 consecutive minutes.
- Scale-down stabilization window: 10 minutes (prevent thrashing during traffic dips).

**PodDisruptionBudget:**
- `minAvailable: 1` — during node maintenance, at least one pod must remain running.

### 4.3 Helm Chart

A custom Helm chart should be created under `helm/omnivote-monitor/` with the following structure:

```
helm/omnivote-monitor/
├── Chart.yaml
├── values.yaml              # Default values
├── values-staging.yaml      # Staging overrides
├── values-production.yaml   # Production overrides
├── templates/
│   ├── _helpers.tpl
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── pvc.yaml
│   ├── hpa.yaml
│   ├── pdb.yaml
│   ├── serviceaccount.yaml
│   └── NOTES.txt
```

This enables reproducible deployments across environments with a single command: `helm upgrade --install omnivote ./helm/omnivote-monitor -f helm/omnivote-monitor/values-production.yaml`.

---

## 5. Database Migration

### 5.1 SQLite to PostgreSQL Migration

SQLite is not suitable for production. It lacks concurrent write support, replication, connection pooling, and robust backup tooling. The migration to PostgreSQL is a **prerequisite for production deployment**.

**Migration tool:** `pgloader` — purpose-built for this task, handles type mapping, data conversion, and large datasets efficiently.

**Type mapping reference:**

| SQLite Type | PostgreSQL Type | Notes |
|---|---|---|
| `INTEGER` | `INTEGER` | No change required |
| `TEXT` | `TEXT` | No change required |
| `REAL` | `REAL` | No change required |
| `TEXT` (JSON stored) | `JSONB` | Update Prisma schema to use `Json` type |
| `INTEGER` (0/1 boolean) | `BOOLEAN` | Prisma handles conversion transparently |
| `TEXT` (ISO-8601 datetime) | `TIMESTAMP` | Prisma `DateTime` maps correctly |
| `TEXT` (CUID primary key) | `TEXT` | No change required — CUIDs work as-is |

### 5.2 Migration Script

```bash
#!/bin/bash
set -euo pipefail

echo "=== OmniVote SQLite → PostgreSQL Migration ==="

# 1. Start PostgreSQL (if using Docker Compose)
docker compose up -d postgres
sleep 10  # Wait for PostgreSQL to be ready

# 2. Run pgloader migration
pgloader \
  sqlite:///$(pwd)/prisma/dev.db \
  postgresql://omnivote:${DB_PASSWORD}@localhost:5432/omnivote

# 3. Update Prisma schema
#    Change: provider = "sqlite"  →  provider = "postgresql"
#    Change: url      = "file:./dev.db"  →  url = env("DATABASE_URL")
#    (Manual step — update schema.prisma)

# 4. Generate Prisma client for PostgreSQL
bunx prisma generate

# 5. Create initial migration (baseline)
bunx prisma migrate dev --name migrate-to-postgresql

# 6. Verify data integrity
echo "Verifying row counts..."
bun -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
Promise.all([
  p.incident.count().then(n => console.log('Incidents:', n)),
  p.agent.count().then(n => console.log('Agents:', n)),
  p.pollingStation.count().then(n => console.log('Polling Stations:', n)),
]).finally(() => p.\$disconnect());
"

# 7. Open Prisma Studio for visual verification
echo "Opening Prisma Studio..."
bunx prisma studio

echo "=== Migration complete ==="
```

### 5.3 Database Backup Strategy

| Parameter | Election Day | Normal Operations |
|---|---|---|
| **Full backup** | Every 4 hours | Daily at 02:00 UTC |
| **WAL archiving** | Continuous | Continuous |
| **Retention** | 90 days | 30 days |
| **Off-site copy** | Real-time to secondary region | Daily to S3/Blob storage |
| **Restore test** | Before election day | Monthly |

**PostgreSQL backup commands:**
```bash
# Full backup
pg_dump -Fc -U omnivote omnivote > /backups/omnivote_$(date +%Y%m%d_%H%M%S).dump

# Restore from backup
pg_restore -U omnivote -d omnivote /backups/omnivote_20250101_020000.dump
```

**WAL archiving** (in `postgresql.conf`):
```
wal_level = replica
archive_mode = on
archive_command = 'aws s3 cp %p s3://omnivote-backups/wal/%f'
```

---

## 6. Secret Management

Proper secret management is non-negotiable for an election monitoring system. A leaked secret could compromise voter data or enable unauthorized access.

### 6.1 Secret Inventory

| Secret | Used By | Storage |
|---|---|---|
| `DATABASE_URL` (full with password) | Next.js app | Vault / K8s Secret |
| `JWT_SECRET` | Authentication | Vault / K8s Secret |
| `NEXTAUTH_SECRET` | NextAuth (if used) | Vault / K8s Secret |
| `WHATSAPP_BRIDGE_TOKEN` | WhatsApp Bridge | Vault / K8s Secret |
| `ENCRYPTION_KEY` | Data encryption at rest | Vault only (HSM-backed) |
| `CLOUDFLARE_API_TOKEN` | DNS / CDN management | CI/CD secret store |

### 6.2 Management by Environment

- **Development**: `.env` file (`.gitignore`d). Use `.env.example` as a template with placeholder values.
- **Staging**: Docker secrets (`docker secret create`) or HashiCorp Vault (dev mode). Never store staging secrets in the repository.
- **Production**: HashiCorp Vault (production cluster) or AWS Secrets Manager. Secrets are injected at runtime via Vault Agent sidecar or External Secrets Operator (Kubernetes).

### 6.3 Rotation Policy

- **Automated rotation**: Every 90 days for all secrets.
- **Immediate rotation**: On any suspected compromise, personnel change, or after a security incident.
- **Rotation process**: Generate new secret → update Vault → rolling restart of application pods → verify connectivity → revoke old secret.
- **Audit trail**: Every secret access is logged in Vault audit logs. Review monthly.

### 6.4 Hard Rules

1. **Never commit secrets to Git.** Use `git-secrets` or `trufflehog` as pre-commit hooks.
2. **Never log secrets.** Ensure structured logging redacts any field matching secret patterns.
3. **Never share secrets via Slack, email, or documents.** Use Vault's one-time sharing feature if needed.
4. **Use different secrets per environment.** Production secrets must never be used in staging or development.

---

## 7. Logging

### 7.1 Application Logging

**Current state:** The application uses `console.error` for error logging with no structured format. This is insufficient for production debugging and alerting.

**Target state:** Structured JSON logging with the following schema:

```json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "level": "error",
  "message": "Failed to fetch incident data",
  "traceId": "abc123def456",
  "userId": "cm2abc123",
  "tenantId": "default",
  "path": "/api/incidents",
  "method": "GET",
  "statusCode": 500,
  "duration": 1243,
  "error": {
    "name": "PrismaClientKnownRequestError",
    "code": "P1001",
    "message": "Connection refused"
  },
  "service": "omnivote-api",
  "version": "2.1.0",
  "hostname": "pod-omnivote-7d4f8b-x2k9p"
}
```

**Recommended tool:** `pino` — fast, structured JSON logger with full Node.js/Bun compatibility. It produces newline-delimited JSON, which is the standard format for all log aggregation systems.

```bash
bun add pino pino-pretty
```

**Implementation pattern:**
```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: ['req.headers.authorization', 'req.headers.cookie'],
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

// Usage
logger.info({ incidentId: 'INC-001', action: 'create' }, 'Incident created');
logger.error({ err, path: '/api/incidents' }, 'Request failed');
```

### 7.2 Log Aggregation Stack

```
Application (pino JSON) → stdout
        ↓
Fluent Bit (DaemonSet on each node)
        ↓
Loki (log storage with label indexing)
        ↓
Grafana (visualization, dashboards, alerting)
```

**Alternative (heavier):** Filebeat → Logstash → Elasticsearch → Kibana (ELK Stack). Use ELK only if full-text search across logs is a hard requirement. For most monitoring use cases, Loki + Grafana is significantly cheaper and simpler.

### 7.3 Log Retention Policy

| Log Category | Retention | Rationale |
|---|---|---|
| Application logs (INFO and above) | 30 days | Debugging recent issues |
| Access logs | 90 days | Security investigation, traffic analysis |
| Audit logs (user actions, data changes) | **730 days** (2 years) | **Legal compliance for election systems** |
| Security logs (auth failures, rate limit hits) | **730 days** (2 years) | **Incident forensics** |

---

## 8. Deployment Strategy

### 8.1 Blue-Green Deployment

Blue-green deployment provides zero-downtime releases with instant rollback capability.

**Architecture:**
- Two identical Kubernetes deployments: `omnivote-blue` and `omnivote-green`.
- A Kubernetes Service acts as the traffic router, pointing to one of the two.
- Deployment process: Build new image → deploy to inactive environment → run smoke tests → switch Service selector → verify → old environment remains for rollback.

**Traffic switching:**
```bash
# Switch from blue to green
kubectl patch service omnivote -p '{"spec":{"selector":{"deployment":"green"}}}'

# Rollback (switch back to blue)
kubectl patch service omnivote -p '{"spec":{"selector":{"deployment":"blue"}}}'
```

**Rollback time:** Less than 5 seconds (just a Service selector change).

### 8.2 Canary Deployment

For more cautious rollouts, canary deployment routes a small percentage of traffic to the new version first.

**Process:**
1. Deploy new version as `omnivote-canary` with 1 replica.
2. Configure ingress/load balancer to route 10% of traffic to canary.
3. Monitor for 15 minutes: error rate, latency, resource usage.
4. **If healthy:** Gradually increase traffic: 25% → 50% → 100%.
5. **If unhealthy:** Route 100% back to stable version. Investigate. No production impact beyond the 10% canary.

**Canary analysis criteria:**
- Error rate must not increase by more than 1%.
- P95 latency must not increase by more than 100ms.
- No pod restarts or OOM kills.
- No new error types in logs.

### 8.3 Election Day Deployment Freeze

Election monitoring systems have a unique operational constraint: **stability is paramount during active elections.**

**Rules:**
- **No deployments** starting 48 hours before election day until 24 hours after polls close.
- **Emergency hotfix process:**
  1. Hotfix branch from `main` with minimal change.
  2. Fast-track CI: lint + type check + unit tests only (no E2E).
  3. Deploy directly to production (skip staging).
  4. Post-deploy verification: Run full smoke test suite manually.
  5. 30-minute monitoring window with enhanced alerting.
  6. If issues detected, immediate rollback to previous version.
- All pre-election changes must be merged to `main` and deployed to production at least 72 hours before the freeze period.
- A designated "release captain" must approve all deployments during the week before election day.

---

## 9. Monitoring Setup

### 9.1 Monitoring Stack

```
Prometheus (metrics collection) ← scrape from all services
        ↓
Alertmanager (alert routing and deduplication)
        ↓
Grafana (dashboards and visualization)
```

### 9.2 Grafana Dashboards

Four dashboards should be created and maintained:

**Dashboard 1: System Overview**
- CPU usage per pod (current, average, peak)
- Memory usage per pod (current, average, peak)
- Network I/O (bytes sent/received per second)
- Disk usage (database volume, log volume)
- Pod restart count
- Node health status

**Dashboard 2: Application Metrics**
- Request rate (requests/second) by route
- Error rate (5xx responses/second) by route
- Latency distribution (P50, P90, P95, P99)
- Active connections (WebSocket, HTTP)
- Database query duration (average, P99)
- Prisma connection pool usage

**Dashboard 3: Business Metrics**
- Agents currently online
- Incidents created per hour (trend)
- Incidents by severity (pie chart)
- Incidents by category (bar chart)
- Geographic coverage (% of polling stations reporting)
- Average time to first response

**Dashboard 4: Election Day War Room**
- Real-time incident feed (last 50 incidents)
- Incident rate vs. baseline (anomaly detection)
- Agent availability % (target: 95%+)
- System uptime % (target: 99.9%)
- Critical alerts count (target: 0)
- Current active users

### 9.3 Alerting Rules

| Alert | Condition | Severity | Notification |
|---|---|---|---|
| HighErrorRate | 5xx rate > 5% for 3 min | Critical | PagerDuty + Slack |
| HighLatency | P99 latency > 2s for 5 min | Warning | Slack |
| PodCrashLoop | Pod restart count > 3 in 10 min | Critical | PagerDuty |
| DatabaseDown | PostgreSQL unreachable for 30s | Critical | PagerDuty + Phone |
| DiskSpaceLow | Disk usage > 85% | Warning | Slack |
| DiskSpaceCritical | Disk usage > 95% | Critical | PagerDuty |
| CertificateExpiry | TLS cert expires in < 7 days | Warning | Slack |
| AnomalousIncidentRate | Incident rate 3x above baseline | Warning | Slack + Email |

---

## 10. Disaster Recovery

### 10.1 Recovery Objectives

| Metric | Target | Rationale |
|---|---|---|
| **RTO** (Recovery Time Objective) | **15 minutes** | Maximum acceptable downtime during an election |
| **RPO** (Recovery Point Objective) | **5 minutes** | Maximum acceptable data loss |

### 10.2 Backup Strategy

- **Database**: Continuous WAL archiving to a secondary availability zone. Full base backup daily.
- **Application state**: Stateless by design. All state is in the database. No local file storage for critical data.
- **Infrastructure as Code**: All Kubernetes manifests, Helm charts, and Caddy configurations stored in Git. Infrastructure can be recreated from Git + Terraform/Ansible.
- **Configuration**: Helm values files per environment, stored in Git.

### 10.3 Restore Procedures

**Scenario A: Database failure (no hardware loss)**
1. Prometheus alert fires: `DatabaseDown`.
2. PostgreSQL auto-restarts via Kubernetes liveness probe.
3. If auto-restart fails, manually restart the pod: `kubectl delete pod -l app=postgres`.
4. PostgreSQL recovers using WAL replay. RPO: < 1 minute.

**Scenario B: Entire cluster failure**
1. Provision new Kubernetes cluster (Terraform/Ansible, ~5 minutes).
2. Deploy application: `helm upgrade --install omnivote ./helm/omnivote-monitor -f values-production.yaml` (~3 minutes).
3. Restore database from latest backup: `pg_restore` from S3 (~5 minutes).
4. Verify: Run smoke test suite.
5. Total RTO: ~15 minutes.

**Scenario C: Data corruption**
1. Stop application: `kubectl scale deployment omnivote --replicas=0`.
2. Identify last known good backup (before corruption timestamp).
3. Restore to a new database: `pg_restore` to `omnivote_recovery`.
4. Verify data integrity with comparison queries.
5. Point application to recovered database.
6. Scale application back up.

### 10.4 DR Testing

- **Monthly**: Automated restore test to a non-production environment. Verify data integrity with row counts and checksum comparisons.
- **Quarterly**: Full DR drill — simulate complete cluster failure, execute recovery procedures, measure actual RTO/RPO.
- **Pre-election**: Mandatory full DR drill 2 weeks before any election.

---

## 11. Cost Optimization

### 11.1 Right-Sizing

Use monitoring data (Grafana dashboards from Section 9) to right-size resources:

- **Application pods**: After 2 weeks of production traffic data, adjust CPU/memory requests to the 75th percentile of actual usage. Over-provisioning wastes money; under-provisioning causes latency.
- **Database**: Start with 2 vCPU / 8 GB RAM. Scale vertically based on query performance metrics.
- **Redis**: 1 vCPU / 2 GB RAM is sufficient for session caching and rate limiting counters.

### 11.2 Instance Strategy

| Workload | Instance Type | Rationale |
|---|---|---|
| Application (steady state) | Reserved instances (1-year) | Predictable baseline, 30-40% savings |
| Application (spike / election day) | On-demand or spot | Short-lived bursts, tolerate interruption |
| Database | Reserved instances | Steady-state, no interruption tolerance |
| CI/CD runners | Spot instances | Ephemeral, can restart on preemption |
| Monitoring (Prometheus/Grafana) | Reserved instances | Always-on, steady resource usage |

### 11.3 Storage Optimization

- **Database volumes**: Use SSD (`storageClass: ssd`). Cost difference is justified by query performance improvement.
- **Log storage**: Use Loki with S3 backend and lifecycle policies: transition to Glacier after 30 days, delete after 730 days.
- **Media storage**: If incident photos/media are stored, use S3 with intelligent tiering. lifecycle rule: `Standard → Infrequent Access after 30 days → Glacier after 90 days`.
- **Docker registry**: Enable garbage collection. Set image retention policy to keep last 50 tagged images per repository.

### 11.4 Cost Monitoring

- Set up a monthly cost alert in the cloud provider billing console.
- Tag all resources with `environment` (dev/staging/prod), `team` (omnivote), and `cost-center` for allocation tracking.
- Review costs monthly. Target: < $500/month for non-election periods, < $2,000/month during election periods (including temporary scaling).

---

## Appendix A: Quick-Start Checklist for New Environment

- [ ] Clone repository and switch to appropriate branch
- [ ] Copy `.env.example` to `.env` and fill in all values
- [ ] Run `docker compose up -d postgres redis`
- [ ] Run `bun install`
- [ ] Run `bunx prisma migrate deploy`
- [ ] Run `bunx prisma db seed` (if seed script exists)
- [ ] Run `bun run build`
- [ ] Run `bun run start` (or `bun run dev` for development)
- [ ] Verify: Open `http://localhost:3000/api/health` — expect `{"status":"ok"}`
- [ ] Configure Caddy reverse proxy (production only)
- [ ] Set up monitoring and alerting (production only)
- [ ] Run smoke test suite
- [ ] Document any environment-specific configuration

---

## Appendix B: Runbook Templates

### B.1 Application Not Responding

1. Check pod status: `kubectl get pods -l app=omnivote`
2. Check recent logs: `kubectl logs -l app=omnivote --tail=100`
3. Check resource usage: `kubectl top pods -l app=omnivote`
4. If OOMKilled: Increase memory limit, investigate memory leak.
5. If CrashLoopBackOff: Check logs for unhandled exceptions. Restart: `kubectl rollout restart deployment omnivote`.
6. If healthy but not responding: Check Caddy/ingress logs. Test directly: `kubectl port-forward svc/omnivote 3000:3000`.

### B.2 Database Performance Degradation

1. Check PostgreSQL connections: `SELECT count(*) FROM pg_stat_activity;`
2. Check long-running queries: `SELECT * FROM pg_stat_activity WHERE state = 'active' AND query_start < now() - interval '30 seconds';`
3. Check lock contention: `SELECT * FROM pg_locks WHERE NOT granted;`
4. If connection pool exhausted: Increase `DATABASE_URL` pool size or add PgBouncer.
5. If slow queries: Run `EXPLAIN ANALYZE` on the slowest queries. Add indexes as needed.
6. If disk I/O bottleneck: Consider upgrading to faster storage or adding read replicas.