# 10 — Senior Solution Designer Guide

## OmniVote Monitor v2.1 — Solution Design Document

**Role:** Senior Solution Designer
**Focus:** Solution patterns, integration design, and data architecture — bridging business requirements with technical implementation.
**Audience:** Solution architects, technical leads, and senior engineers implementing the OmniVote Monitor platform.
**Last Updated:** 2025

---

## 1. Solution Design Principles

Every architectural decision on OmniVote Monitor v2.1 must be evaluated against the following non-negotiable principles. These are not aspirational guidelines — they are hard constraints that shape the system's topology, technology choices, and operational runbooks.

### 1.1 Defense in Depth

No single security control is sufficient. The platform must implement multiple overlapping layers of protection so that the compromise of any one layer does not expose the system. This means:

- **Network layer:** TLS everywhere, mTLS between internal services, IP allowlisting for admin interfaces.
- **Application layer:** Input validation, output encoding, CSRF protection, rate limiting, and request signing.
- **Data layer:** Encryption at rest (AES-256-GCM), field-level encryption for PII, column-level access controls.
- **Operational layer:** Log aggregation, anomaly detection alerts, automated incident response playbooks.

Each layer must function independently. If the application firewall is bypassed, database encryption still protects data at rest. If encryption keys are compromised, network segmentation limits the blast radius.

### 1.2 Fail-Safe Defaults

The system must default to the most secure configuration at every decision point. If a setting is ambiguous, the secure option wins. Concretely:

- New users receive no permissions; access must be explicitly granted.
- API endpoints require authentication by default; anonymous access is opt-in and narrowly scoped.
- Sessions expire after a conservative timeout (15 minutes idle, 8 hours absolute); longer sessions require re-authentication.
- File uploads default to blocked; allowed file types must be explicitly whitelisted.
- All internal services default to deny-all firewall rules.

### 1.3 Least Privilege

Every role, service account, and system component receives only the minimum access required to perform its function:

- **Roles:** FIELD_AGENT can only view assigned polling units and submit incidents. OBSERVER can view more data but cannot modify it. ADMIN has full access within their tenant only.
- **Service accounts:** The OSINT ingestion service can write to the `incidents` table and read from OSINT config, but cannot access user management tables.
- **Database users:** The application read-only replica user cannot perform writes. The write user cannot perform DDL operations.
- **API tokens:** Scoped to specific endpoints and operations; a monitoring token can read health checks but cannot access user data.

### 1.4 Separation of Concerns

Clear architectural boundaries between services prevent tight coupling and enable independent deployment, scaling, and testing:

- **API Layer:** Handles HTTP concerns (routing, validation, serialization, rate limiting). Knows nothing about business logic.
- **Service Layer:** Implements business rules and orchestration. Knows nothing about HTTP or SQL.
- **Data Layer:** Handles persistence and retrieval. Exposes repositories with domain-aligned interfaces.
- **Integration Layer:** Manages external service communication (WhatsApp, OSINT APIs, ML service). Translates between internal and external data models.
- **Infrastructure Layer:** Handles deployment, monitoring, secrets management. Knows nothing about application logic.

### 1.5 Data Sovereignty

All election data — including incident reports, result submissions, agent locations, media files, and audit logs — must remain within Nigeria's jurisdiction at all times. This means:

- All production infrastructure is hosted in Nigerian data centers or cloud regions (Lagos).
- No election data is transmitted to or processed by services outside Nigeria.
- Third-party APIs (OSINT platforms, ML services) must either be hosted locally or accept that only non-sensitive metadata (public social media posts) crosses borders.
- Legal and compliance teams must approve any data flow that crosses Nigerian borders.
- Disaster recovery sites must also be within Nigeria.

### 1.6 Offline-First

Field agents operate in areas with unreliable or no connectivity. The system must be designed so that the most critical agent workflows function fully offline:

- The mobile app caches assigned polling unit data, incident forms, and check-in schedules locally.
- Incident submissions, check-ins, and result reports are queued locally and synchronized when connectivity is restored.
- Conflict resolution handles duplicate submissions (last-write-wins with server-side timestamp, or merge with admin review).
- The app must function for at least 12 hours offline with no data loss.
- Synchronization is incremental and bandwidth-efficient (delta sync, compressed payloads).

### 1.7 Audit Everything

Every state-changing action in the system must produce an immutable audit record:

- Who performed the action (user ID, role, IP address, device fingerprint).
- What changed (before/after state for updates, full payload for creates).
- When it occurred (server-side timestamp in UTC, never client-provided).
- From where (geolocation if available, user agent, session ID).
- Why (business context: incident review, policy change, user management).
- Audit records must be append-only and tamper-evident (hash chaining or write-once storage).

---

## 2. Solution Patterns

### 2.1 Multi-Tenancy Pattern

**Current State:** Shared database with a `tenantId` column on every model. Tenant isolation depends on application-level query filters.

**Pattern:** Shared-schema multi-tenancy. This is appropriate for the expected scale of fewer than 100 tenants (election observer organizations, CSOs, media houses, government agencies).

**Enhancement Required — Row-Level Security (RLS) in PostgreSQL:**

Application-level tenant filtering is fragile — a single missed `WHERE tenantId = ?` clause leaks data across tenants. PostgreSQL Row-Level Security provides database-enforced isolation:

```sql
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON incidents
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Set tenant context at connection/transaction level
SET LOCAL app.current_tenant_id = 'tenant-uuid-here';
```

Every table containing tenant-scoped data must have RLS enabled. The application must set the tenant context on every database connection or transaction.

**Tenant Context Propagation Chain:**

```
JWT (contains tenantId claim)
  → API Middleware (extracts tenantId, validates against user's allowed tenants)
    → Service Layer (passes tenantId to repository methods)
      → Database (SET LOCAL app.current_tenant_id)
        → RLS Policy (enforces isolation at query level)
```

**Verification Requirement:** Every database query MUST include tenant isolation — either through the RLS policy or an explicit `WHERE` clause. Automated tests must verify that no query returns cross-tenant data. Static analysis tools should flag any query that does not reference `tenantId`.

### 2.2 Event Sourcing Pattern (for Audit Trail)

**Current State:** Simple `AuditLog` model with manually created entries. Entries are created inconsistently — some actions are logged, others are not. No temporal query capability.

**Pattern:** Event store for all state changes. Instead of (or in addition to) maintaining current state in tables, every state change is recorded as an immutable event.

**Event Types:**

| Event | Triggered When | Payload |
|---|---|---|
| `INCIDENT_CREATED` | Field agent submits incident | Full incident data, submitter, GPS, timestamp |
| `INCIDENT_UPDATED` | Any field on incident changes | Before/after delta, who changed it, why |
| `INCIDENT_REVIEWED` | Observer or admin reviews incident | Review verdict, reviewer notes, confidence score |
| `INCIDENT_ESCALATED` | Incident severity upgraded | Previous level, new level, escalation reason |
| `RESULT_SUBMITTED` | Agent submits PU result | PU code, results, photos, submitter, timestamp |
| `RESULT_VERIFIED` | Admin verifies submitted result | Verifier, verification notes, discrepancies found |
| `ALERT_TRIGGERED` | System generates alert | Alert type, severity, related entities, trigger conditions |
| `USER_CREATED` | New user account | User role, creator, tenant |
| `USER_LOCKED` | Account locked (failed auth, admin action) | Reason, lock duration, who initiated |
| `USER_ROLE_CHANGED` | User role modified | Previous role, new role, who changed it |
| `POLICY_CHANGED` | Tenant configuration modified | Before/after policy, who changed it |
| `DEAD_MAN_CHECK_IN` | Agent checks in | Agent ID, timestamp, GPS, battery level |
| `DEAD_MAN_ESCALATION` | Check-in deadline missed | Agent ID, escalation level, deadline missed |

**Benefits:**

- **Complete audit trail:** Every state change is recorded with full context. No action is lost.
- **Temporal queries:** "What was the state of this incident at 14:30 on election day?" Answerable by replaying events up to that point.
- **Replay capability:** Events can be replayed to rebuild state, useful for debugging, compliance reporting, or disaster recovery.
- **Compliance:** Immutable, append-only event log satisfies audit requirements for election observation.

**Implementation:**

```sql
CREATE TABLE domain_events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type    VARCHAR(100) NOT NULL,
    aggregate_id  UUID NOT NULL,          -- The entity ID (incident, user, etc.)
    aggregate_type VARCHAR(50) NOT NULL,  -- 'Incident', 'User', 'ElectionResult', etc.
    payload       JSONB NOT NULL,
    metadata      JSONB NOT NULL,         -- actor, IP, timestamp, tenant
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_seq     BIGINT NOT NULL         -- Monotonically increasing sequence
);

CREATE INDEX idx_events_aggregate ON domain_events (aggregate_type, aggregate_id, event_seq);
CREATE INDEX idx_events_type_time ON domain_events (event_type, created_at);
CREATE INDEX idx_events_tenant ON domain_events ((metadata->>'tenantId'));
```

Materialized views provide the current state derived from events, refreshed on demand or on a schedule for read-heavy queries.

### 2.3 CQRS Pattern (Command Query Responsibility Segregation)

**Rationale:** The OmniVote Monitor has fundamentally different read and write patterns:

- **Writes** are transactional and relatively infrequent: incident submissions, result uploads, user management actions. These require strong consistency.
- **Reads** are frequent and complex: dashboard KPIs, situation room aggregations, real-time alert feeds, historical reports. These can tolerate eventual consistency.

Conflating reads and writes in a single model leads to either slow reads (complex joins for aggregations) or risky writes (read queries locking tables during high load).

**Commands (Writes) — Synchronous, Strongly Consistent:**

- `SubmitIncidentCommand` — Agent submits a new incident.
- `UpdateIncidentCommand` — Observer reviews/updates an incident.
- `SubmitResultCommand` — Agent submits PU election results.
- `CreateAlertCommand` — System or user creates an alert.
- `ManageUserCommand` — Admin creates/updates/locks a user.
- `CheckInCommand` — Agent performs dead-man's switch check-in.
- `UpdateTenantPolicyCommand` — Admin modifies tenant configuration.

Each command is validated, executed within a database transaction, and produces a domain event.

**Queries (Reads) — Eventually Consistent, Optimized for Performance:**

- `GetDashboardKPIsQuery` — Total incidents, by type/severity/status, trend over time.
- `GetSituationRoomFeedQuery` — Real-time incident feed with geospatial data.
- `GetAgentStatusQuery` — All agents, their check-in status, battery level, last GPS.
- `GetIncidentTimelineQuery` — Full event history for a specific incident.
- `GetOSINTFeedQuery` — Curated social media posts related to monitored areas.
- `GetElectionResultsQuery` — Aggregated results by PU, ward, LGA, state.

**Implementation — Separate Read Models:**

Expensive aggregation queries are pre-computed into materialized views or dedicated read tables, refreshed on a schedule or triggered by domain events:

```sql
-- Example: Materialized view for dashboard KPIs
CREATE MATERIALIZED VIEW mv_dashboard_kpis AS
SELECT
    tenant_id,
    DATE_TRUNC('hour', created_at) AS hour_bucket,
    type,
    severity,
    COUNT(*) AS incident_count
FROM incidents
GROUP BY tenant_id, DATE_TRUNC('hour', created_at), type, severity
WITH DATA;

-- Refresh strategy: every 30 seconds during active monitoring, every 5 minutes otherwise
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_kpis;
```

### 2.4 Circuit Breaker Pattern

**Problem:** OmniVote Monitor depends on external services that can fail — WhatsApp Business API, OSINT platform APIs, and the ML classification service. A failure in any external service must not cascade into system-wide degradation.

**Pattern:** Every external service call is wrapped in a circuit breaker with three states:

1. **CLOSED (Normal):** Requests pass through. The breaker tracks failure count.
2. **OPEN (Failing):** The breaker has detected sustained failures. All requests are immediately rejected (fast-fail) without calling the external service.
3. **HALF-OPEN (Testing Recovery):** After a cooldown period, the breaker allows a limited number of test requests. If they succeed, the breaker closes. If they fail, it re-opens.

**Configuration per Service:**

| Service | Failure Threshold | Cooldown | Test Requests | Fallback |
|---|---|---|---|---|
| WhatsApp Business API | 5 failures in 60s | 30 seconds | 3 | Queue messages in Redis, deliver when circuit closes |
| ML Classification Service | 10 failures in 120s | 60 seconds | 5 | Use rule-based classification (keyword matching, severity heuristics) |
| OSINT — X/Twitter API | 15 failures in 300s | 120 seconds | 3 | Return cached results, log gap for later backfill |
| OSINT — Facebook Graph API | 15 failures in 300s | 120 seconds | 3 | Return cached results, log gap for later backfill |
| Nominatim Geocoding | 10 failures in 60s | 60 seconds | 2 | Return "Geocoding unavailable" placeholder |

**Implementation Approach:**

```python
# Pseudocode for circuit breaker wrapper
class CircuitBreaker:
    def __init__(self, service_name, failure_threshold, cooldown, test_requests, fallback_fn):
        self.service_name = service_name
        self.failure_threshold = failure_threshold
        self.cooldown = cooldown
        self.test_requests = test_requests
        self.fallback_fn = fallback_fn
        self.state = "CLOSED"
        self.failure_count = 0
        self.last_failure_time = None
        self.half_open_successes = 0

    def call(self, fn, *args, **kwargs):
        if self.state == "OPEN":
            if time.time() - self.last_failure_time > self.cooldown:
                self.state = "HALF_OPEN"
                self.half_open_successes = 0
            else:
                return self.fallback_fn(*args, **kwargs)

        try:
            result = fn(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            return self.fallback_fn(*args, **kwargs)
```

### 2.5 Dead-Man's Switch Pattern

**Current State:** Database-based timer with escalation levels 0–3. Agents must check in at configurable intervals. If they miss a deadline, the system escalates.

**Pattern:** A timer service continuously monitors all active dead-man's switches and escalates when deadlines are missed.

**Escalation Levels:**

| Level | Name | Condition | Action |
|---|---|---|---|
| 0 | None | Agent has checked in within their interval | No action |
| 1 | Alert | Agent has missed their check-in by 1× their interval | Alert created, assigned to supervisor, WhatsApp notification sent |
| 2 | Supervisor Escalation | Agent has missed their check-in by 2× their interval | Escalated to senior supervisor, situation room alert, phone call attempted |
| 3 | Emergency SOS | Agent has missed their check-in by 3× their interval | Emergency protocol activated, all supervisors notified, GPS last-known-location flagged, security contacts notified |

**Implementation:**

A Celery beat task runs every 60 seconds, querying all agents with active monitoring and comparing their last check-in time against their configured interval:

```python
@celery.task
def check_dead_man_switches():
    now = timezone.now()
    active_agents = Agent.objects.filter(is_active=True, monitoring_enabled=True)

    for agent in active_agents:
        time_since_checkin = now - agent.last_check_in_at
        intervals_missed = time_since_checkin.total_seconds() / agent.check_in_interval_seconds

        if intervals_missed >= 3 and agent.escalation_level < 3:
            escalate_to_level_3(agent)
        elif intervals_missed >= 2 and agent.escalation_level < 2:
            escalate_to_level_2(agent)
        elif intervals_missed >= 1 and agent.escalation_level < 1:
            escalate_to_level_1(agent)
        elif intervals_missed < 1 and agent.escalation_level > 0:
            reset_escalation(agent)
```

### 2.6 Honeypot Pattern

**Current State:** Decoy polling units exist in the system. The platform detects when official election results entered for these phantom units deviate from expected values (which should be zero or a planted baseline).

**Pattern:** Canary resources designed to detect unauthorized access, data manipulation, or insider threats. Honeypots are indistinguishable from real polling units to anyone without knowledge of the trap list.

**Trap Types:**

1. **Ghost Unit (Non-Existent PU):** A polling unit that does not exist in reality. It has a valid-looking code, a plausible geographic location, and is assigned to an agent who is actually a system account. Any results submitted for this unit indicate fabrication — someone is submitting fake results.

2. **Tamper Trap (Real PU with Hidden Sensor):** A real polling unit where the system has planted a specific expected result pattern (e.g., total registered voters = specific number, results must match planted values within tolerance). If the stored results are modified without following proper procedures, the deviation is detected.

3. **Replay Detector (Previous Election's Results):** The system stores results from a previous election cycle for a real polling unit. If the current election results for that unit exactly match the previous cycle's results, it suggests someone copied old data rather than collecting new data.

**Alert Trigger Logic:**

```python
def check_honeypot_deviation(pu_code, submitted_results):
    honeypot = Honeypot.objects.filter(pu_code=pu_code).first()
    if not honeypot:
        return None  # Not a honeypot, no check needed

    deviation = calculate_deviation(submitted_results, honeypot.expected_results)

    if honeypot.trap_type == "GHOST" and deviation < -0.01:
        # Results submitted for a non-existent PU
        trigger_alert(
            alert_type="HONEYPOT_TRIGGERED",
            severity="CRITICAL",
            message=f"Results submitted for ghost polling unit {pu_code}",
            metadata={"trap_type": "GHOST", "deviation": deviation}
        )
    elif honeypot.trap_type == "REPLAY" and deviation == 0:
        # Exact match with previous election — suspicious
        trigger_alert(
            alert_type="HONEYPOT_TRIGGERED",
            severity="HIGH",
            message=f"Results for {pu_code} exactly match previous election — possible replay",
            metadata={"trap_type": "REPLAY"}
        )
```

**Access Control:** The list of honeypot polling units is accessible only to SYSTEM_ADMIN role. Regular admins, observers, and agents must not be able to query which PUs are honeypots.

---

## 3. Integration Design

### 3.1 WhatsApp Business API Integration

**Direction:** Bidirectional — OmniVote sends outbound messages to agents and stakeholders; WhatsApp sends delivery receipts and message read status back to OmniVote.

**Authentication:** Bearer token obtained from Meta's OAuth flow. Token must be stored in the secrets manager, rotated every 90 days, and scoped to the minimum required permissions (send messages, receive webhook events).

**Rate Limits:**

- 1,000 messages per minute per WhatsApp Business Account (WABA).
- The system must implement a client-side rate limiter that tracks outgoing messages and queues excess messages for delivery in the next window.
- During election day peak, message volume could exceed the limit. Priority queuing ensures critical alerts (escalation notifications, emergency SOS) are sent before informational messages (daily summaries, system notifications).

**Template Messages:**

All outbound messages must use pre-approved message templates. Templates must be submitted to Meta for approval at least 4 weeks before election day. Required templates include:

| Template Name | Purpose | Variables |
|---|---|---|
| `escalation_alert` | Notify supervisor of missed check-in | Agent name, PU code, escalation level, last check-in time |
| `emergency_sos` | Emergency notification for level 3 escalation | Agent name, PU code, last GPS, time since last contact |
| `incident_assigned` | Notify observer of new incident | Incident ID, type, severity, PU name |
| `daily_summary` | End-of-day report for stakeholders | Total incidents, results submitted, agents active, key alerts |

**Media Messages:**

Media (photos, PDFs) must be uploaded to WhatsApp's media server first, then referenced by media ID in the message payload. This is a two-step process:

1. `POST /v21.0/{phone-number-id}/media` — Upload media, receive `media_id`.
2. `POST /v21.0/{phone-number-id}/messages` — Send message with `media_id` reference.

**Webhooks:**

WhatsApp delivery status updates and message read receipts are received via webhook. The webhook endpoint must:

- Verify the webhook challenge (HMAC verification using the app secret).
- Process `message_status` events (sent, delivered, read, failed).
- Update the internal message tracking table with delivery status.
- Trigger retry logic for failed messages (with exponential backoff, max 3 retries).

### 3.2 OSINT Platform Integrations

The OSINT ingestion service monitors social media and news sources for content related to monitored polling units, election violence, and manipulation. Each platform has different API capabilities, rate limits, and data formats.

**X/Twitter API v2:**
- **Capabilities:** Search recent tweets (7-day window), user profile lookups, engagement metrics (likes, retweets, replies).
- **Authentication:** Bearer token (app-only) or OAuth 2.0 (user context for advanced features).
- **Rate Limits:** 300 requests/15 minutes (search), 900 requests/15 minutes (lookup).
- **Data Extracted:** Tweet text, author, timestamp, location (geotagged or profile-based), engagement metrics, media URLs, quoted tweets.
- **Polling Strategy:** Every 2 minutes during active monitoring, filtered by keywords and monitored geographies.

**Facebook Graph API:**
- **Capabilities:** Public page posts, group posts (if accessible), comments, reactions.
- **Authentication:** Page access token or user access token.
- **Rate Limits:** 200 calls per user per hour.
- **Data Extracted:** Post text, author, timestamp, reactions count, top comments, media URLs.
- **Limitation:** Access to public content is increasingly restricted. May require authenticated user tokens for comprehensive monitoring.

**YouTube Data API v3:**
- **Capabilities:** Video metadata, comment threads, channel information, search.
- **Authentication:** API key (quota-based) or OAuth 2.0.
- **Rate Limits:** 10,000 quota units per day (search costs 100 units, comment threads cost 1 unit per comment).
- **Data Extracted:** Video title, description, upload time, view count, top comments, geolocation (if available).
- **Polling Strategy:** Every 15 minutes, search by election-related keywords.

**TikTok API:**
- **Capabilities:** Video metadata (limited official API access).
- **Authentication:** API key.
- **Rate Limits:** Varies; generally more restricted than other platforms.
- **Data Extracted:** Video metadata, description, engagement metrics.
- **Note:** TikTok's official API is limited. May require supplementary scraping (within legal bounds) or reliance on third-party OSINT tools.

**Instagram Basic Display:**
- **Capabilities:** Public posts from business and creator accounts.
- **Authentication:** Access token.
- **Rate Limits:** 200 calls per user per hour.
- **Data Extracted:** Post caption, media URL, timestamp, like count.

**News/RSS Feeds:**
- **Capabilities:** RSS feed parsing from Nigerian news outlets (Punch, Vanguard, Premium Times, Channels TV, etc.).
- **Authentication:** None required (public RSS).
- **Rate Limits:** Respect each outlet's crawl rate (typically 1 request per minute).
- **Data Extracted:** Headline, summary, publication time, source URL, author.

**WhatsApp Channels:**
- **Capabilities:** Monitor public WhatsApp channels for election-related content.
- **Authentication:** Requires a registered phone number with channel access.
- **Limitation:** WhatsApp channel monitoring is technically complex and may require specific tooling.

**Cross-Platform Considerations:**

- **Backoff Strategy:** Implement per-platform exponential backoff. If a platform returns 429 (Too Many Requests), back off by `2^retry * base_delay` seconds, with jitter.
- **Deduplication:** The same content may appear across multiple platforms. Use content hashing (text similarity + timestamp proximity) to deduplicate.
- **Language Detection:** All ingested content must be classified by language (English, Pidgin, Hausa, Yoruba, Igbo) to route to the appropriate ML classification pipeline.
- **Geocoding:** Extract location references from text (polling unit codes, LGA names, landmark mentions) and geocode to coordinates for map overlay.

### 3.3 Map Integration

**Current State:** CARTO dark basemap tiles (free tier, no API key required). Sufficient for basic visualization.

**Enhancements Required:**

1. **Custom Tile Layers:** Add satellite imagery and terrain layers for field agent deployment planning. Options:
   - **MapTiler:** Free tier (100,000 requests/month), satellite and terrain layers.
   - **ESRI World Imagery:** Free for non-commercial use.
   - **Custom tiles from OSM:** Self-hosted tile server for full control and no external dependency.

2. **Geocoding Service:**
   - **Primary:** Nominatim (OpenStreetMap) for address-to-coordinate and coordinate-to-address lookups.
   - **Rate Limit:** 1 request per second (free tier). Implement client-side throttling and caching.
   - **Caching:** Geocode results are highly cacheable. Store in Redis with 30-day TTL. Nigeria has a finite set of polling unit locations — once geocoded, results rarely change.

3. **Routing Service (Agent Deployment):**
   - **OSRM (Open Source Routing Machine):** Self-hosted instance with Nigerian road network data.
   - **Use Case:** Calculate optimal routes for agent deployment, estimate travel times between polling units, and identify areas with poor road access.
   - **Deployment:** Self-hosted to maintain data sovereignty and avoid external dependencies during election day.

---

## 4. Data Architecture

### 4.1 Data Flow Architecture

```
Field Agents (Mobile App, Offline-Capable)
    │
    ├── [Sync Queue] ──→ API Gateway (Rate Limiting, Auth, Validation)
    │                          │
    │                          ├──→ Core Service (Business Logic)
    │                          │       │
    │                          │       ├──→ PostgreSQL (Primary Database)
    │                          │       │       │
    │                          │       │       ├──→ Domain Events Table (Append-Only)
    │                          │       │       └──→ S3/MinIO (Media Storage)
    │                          │       │
    │                          │       └──→ Redis Cache (Session, KPI Cache)
    │                          │
    │                          └──→ Real-Time Service (WebSocket)
    │                                  │
    │                                  └──→ Dashboard (Browser, Map View)
    │
OSINT Platforms (X, Facebook, YouTube, TikTok, News RSS)
    │
    ├──→ Ingestion Service (Rate Limiting, Dedup, Language Detection)
    │       │
    │       ├──→ ML Service (Classification, Sentiment, Geolocation)
    │       │       │
    │       │       └──→ PostgreSQL (Classified Incidents / OSINT Records)
    │       │
    │       └──→ Redis Pub/Sub → Real-Time Service → Dashboard (OSINT Feed)
    │
Background Workers (Celery)
    │
    ├──→ Dead-Man's Switch Checker (every 60s)
    ├──→ Alert Escalation Service
    ├──→ Materialized View Refresher (every 30s during active monitoring)
    ├──→ Report Generation (scheduled, on-demand)
    └──→ Backup/Archive Jobs (hourly during election, daily otherwise)
```

### 4.2 Data Classification

All data in the system is classified into four tiers. Classification determines storage location, encryption requirements, access controls, and retention periods.

| Classification | Examples | Storage | Encryption | Retention | Access |
|---|---|---|---|---|---|
| **Public** | Election information, polling unit locations, public statistics, help documentation | PostgreSQL (standard tables) | Standard TLS + disk encryption | Indefinite | All authenticated users |
| **Internal** | Incident reports, OSINT ingested data, agent status, alert history, aggregated KPIs | PostgreSQL (standard tables) | Field-level encryption for sensitive fields (GPS coordinates, agent names) | Election date + 90 days | Users within the same tenant |
| **Confidential** | User PII (name, email, phone), GPS coordinates of agents, WhatsApp message logs, audit records | PostgreSQL (encrypted tables) + Redis (encrypted) | AES-256-GCM field-level encryption; keys in HSM or managed key service | Election date + 365 days | Role-restricted (ADMIN, SYSTEM_ADMIN only for PII) |
| **Restricted** | Biometric data (if applicable), 2FA secret keys, HSM key material, honeypot configurations, encryption keys | PostgreSQL (HSM-backed encryption) + Hardware Security Module | HSM-backed encryption; keys never exist in software-accessible memory | Election date + 730 days | SYSTEM_ADMIN only, with MFA + audit |

### 4.3 Data Retention Policy

Retention is configurable per tenant via the `TenantPolicy` model, with the following defaults:

| Data Type | Default Retention | Configurable Via | Deletion Method |
|---|---|---|---|
| Election data (incidents, results, alerts) | 365 days after election date | `dataRetentionDays` | Soft delete (30-day grace) then hard delete |
| Audit logs (domain events, access logs) | 730 days after event creation | `auditLogRetentionDays` | Hard delete after retention period |
| Media files (photos, documents) | 365 days after upload | `mediaRetentionDays` | Move to cold storage (S3 Glacier equivalent) after 90 days, delete after 365 |
| Security events (failed logins, permission changes) | 730 days after event | Hard-coded (not tenant-configurable) | Hard delete |
| Session data | 24 hours after last activity | Hard-coded | Automatic expiry (Redis TTL) |
| Cache data (KPIs, geocoding results) | 30 seconds (KPIs) to 1 hour (geocoding) | Hard-coded | Automatic expiry (Redis TTL) |
| OSINT raw data | 90 days after ingestion | `osintRetentionDays` | Hard delete (raw data); classified results follow election data retention |

**Retention Enforcement:** A nightly Celery task scans for data past its retention period and executes the configured deletion method. Deletions are themselves recorded as domain events (with the data type and count, but not the deleted data itself).

### 4.4 Data Export & Backup

**Backup Strategy:**

| Backup Type | Frequency | Scope | Storage | Encryption | Retention |
|---|---|---|---|---|---|
| Full backup | Daily at 02:00 UTC | Entire PostgreSQL database | Off-site, Nigerian data center | AES-256, key in HSM | 30 days |
| Incremental backup | Hourly during election day; every 6 hours otherwise | WAL segments | Same as full backup | Same as full backup | 7 days |
| Point-in-time recovery | Continuous | WAL archiving in PostgreSQL | Same as full backup | Same as full backup | 7 days |

**Point-in-Time Recovery (PITR):** PostgreSQL WAL (Write-Ahead Log) archiving enables recovery to any specific moment in time. This is critical during election day — if data is corrupted or accidentally deleted, the database can be restored to the state it was in at any second within the retention window.

**Data Export for Stakeholders:**

- **CSV Export:** Incident reports, election results, agent deployment data. Available via admin dashboard.
- **JSON Export:** Full data export for a tenant (for regulatory compliance or data portability requests).
- **PDF Reports:** Automated and on-demand report generation (situation room summaries, post-election analysis, audit reports).
- **Export Access:** Only ADMIN and SYSTEM_ADMIN roles can initiate data exports. All exports are logged as audit events.

---

## 5. API Design Standards

### 5.1 REST API Conventions

All public and internal APIs follow consistent conventions:

**URL Structure:**

```
/api/{version}/{resource}          # Collection
/api/{version}/{resource}/{id}     # Single resource
/api/{version}/{resource}/{id}/{sub-resource}  # Nested resource
```

Examples:
- `GET /api/v1/incidents` — List all incidents (filtered by tenant, paginated).
- `POST /api/v1/incidents` — Create a new incident.
- `GET /api/v1/incidents/123e4567-e89b-12d3-a456-426614174000` — Get specific incident.
- `PATCH /api/v1/incidents/123e4567-e89b-12d3-a456-426614174000` — Update incident (partial).
- `GET /api/v1/incidents/123e4567-e89b-12d3-a456-426614174000/events` — Get event history for incident.
- `GET /api/v1/agents` — List all agents.
- `POST /api/v1/agents/check-in` — Agent check-in (action endpoint).

**HTTP Methods:**

| Method | Purpose | Idempotent | Request Body | Response on Success |
|---|---|---|---|---|
| `GET` | Read resource(s) | Yes | No | 200 OK + data |
| `POST` | Create resource or trigger action | No | Yes | 201 Created (create) or 200 OK (action) |
| `PATCH` | Partial update | Yes | Yes (partial fields) | 200 OK + updated data |
| `PUT` | Full replacement | Yes | Yes (complete resource) | 200 OK + updated data |
| `DELETE` | Remove resource | Yes | No | 204 No Content |

**Filtering:** Query parameters for collection endpoints.

```
GET /api/v1/incidents?type=VIOLENCE&severity=HIGH&status=OPEN
```

Multiple values for the same parameter use comma separation: `?type=VIOLENCE,INTIMIDATION`.

**Pagination:** Offset-based pagination for all collection endpoints.

```
GET /api/v1/incidents?page=1&limit=20
```

Default limit: 20. Maximum limit: 100. Total count always included in response metadata.

**Sorting:** Query parameter with field name, prefix `-` for descending.

```
GET /api/v1/incidents?sort=-createdAt,severity
```

**Tenant Isolation (Current State):** Tenant ID is passed as a query parameter or header. This is a transitional state.

**Tenant Isolation (Target State):** Tenant ID is extracted from the JWT token by middleware. No tenant parameter is accepted or needed in the request.

### 5.2 Response Format

All successful responses follow a consistent envelope:

```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "type": "VIOLENCE",
    "severity": "HIGH",
    "description": "Ballot box snatching reported at PU...",
    "status": "OPEN",
    "createdAt": "2025-02-25T14:30:00Z",
    "updatedAt": "2025-02-25T14:30:00Z"
  },
  "meta": {
    "total": 347,
    "page": 1,
    "limit": 20,
    "totalPages": 18
  },
  "error": null
}
```

For collection responses, `data` is an array. For single resource responses, `data` is an object. For action endpoints (check-in, escalation), `data` contains the action result.

### 5.3 Error Format

All error responses follow a consistent structure:

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Incident type is required",
    "details": [
      {
        "field": "type",
        "message": "Expected one of: OBSERVATION, VIOLENCE, INTIMIDATION, BALLOT_STUFFING, VOTER_SUPPRESSION, OTHER",
        "code": "ENUM_INVALID"
      }
    ]
  }
}
```

**Standard Error Codes:**

| Code | HTTP Status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Request body or parameters failed validation |
| `AUTHENTICATION_REQUIRED` | 401 | Missing or invalid authentication token |
| `AUTHORIZATION_DENIED` | 403 | Authenticated user lacks permission for this action |
| `RESOURCE_NOT_FOUND` | 404 | Requested resource does not exist |
| `CONFLICT` | 409 | Request conflicts with current state (duplicate, stale data) |
| `RATE_LIMITED` | 429 | Too many requests, retry after specified duration |
| `INTERNAL_ERROR` | 500 | Unexpected server error (details logged, not exposed to client) |
| `SERVICE_UNAVAILABLE` | 503 | External dependency unavailable, try again later |

---

## 6. Solution Decision Records (ADRs)

### ADR-001: SQLite vs PostgreSQL

- **Status:** Decided
- **Decision:** Start development with SQLite for rapid prototyping and developer onboarding. Migrate to PostgreSQL before any production deployment.
- **Rationale:** SQLite requires no external database server, enabling developers to clone the repo and run immediately. However, SQLite lacks RLS, concurrent write support, advanced indexing, and the tooling ecosystem needed for production. The migration must be completed before any multi-user testing or production deployment.
- **Migration Path:** Use SQLAlchemy's dialect abstraction. Write all migrations with Alembic. Test against PostgreSQL in CI/CD from day one.
- **Consequences:** All SQL must be standard SQL or use the SQLAlchemy ORM (no SQLite-specific syntax). Features that depend on PostgreSQL-specific capabilities (RLS, `JSONB`, `gen_random_uuid()`) must be conditionally implemented or stubbed during SQLite phase.

### ADR-002: Monolith vs Microservices

- **Status:** Decided
- **Decision:** Start with a monolithic architecture. Extract services incrementally when scale, team size, or operational requirements demand it.
- **Rationale:** A monolith is faster to develop, test, and deploy for a small team. The codebase should be organized with clear module boundaries (API layer, service layer, data layer, integration layer) so that extraction is straightforward when needed. Premature microservice adoption introduces operational complexity (service discovery, inter-service communication, distributed tracing) that the team is not yet sized to manage.
- **Extraction Criteria:** Extract a service when:
  - It has distinct scaling requirements (e.g., OSINT ingestion needs independent scaling).
  - It has a different deployment cadence (e.g., ML model updates are independent of core releases).
  - Team size grows large enough for service ownership.
  - The module boundary is stable and well-defined.

### ADR-003: Polling vs WebSocket

- **Status:** Decided
- **Decision:** Start with HTTP polling (30-second interval) for dashboard updates. Add WebSocket support for real-time features (situation room live feed, alert notifications) as a Phase 2 enhancement.
- **Rationale:** Polling is simpler to implement, debug, and scale. The dashboard can provide a good user experience with 30-second refreshes. WebSocket adds complexity (connection management, reconnection logic, server-side state for connections). Introduce WebSocket when the user experience demands sub-30-second updates (situation room during active incident response).
- **Implementation Note:** Design the API to support both patterns from the start. Polling endpoints (`GET /api/v1/incidents?since=2025-02-25T14:30:00Z`) can be used for both polling and as the initial data load for a WebSocket connection.

### ADR-004: Client-Side vs Server-Side Authentication

- **Status:** Decided
- **Decision:** Implement server-side JWT-based authentication. Remove all client-side-only authentication logic.
- **Rationale:** The current client-side authentication (storing auth state, role checks, and permission logic entirely in the browser) is a critical security vulnerability. An attacker can modify client-side code to grant themselves any role or bypass access controls. Authentication and authorization must be enforced on the server for every request. JWTs issued by the server carry signed claims (user ID, roles, tenant ID) that the server validates on every request.
- **Consequences:** The API must validate JWTs on every request. Role checks and permission evaluations must happen in the service layer, never in the frontend. The frontend may use JWT claims for UI rendering (showing/hiding elements) but must never rely on them for security decisions.

### ADR-005: Shared vs Separate Databases per Tenant

- **Status:** Decided
- **Decision:** Shared database with row-level isolation (via `tenantId` column + PostgreSQL RLS).
- **Rationale:** With fewer than 100 tenants, separate databases per tenant would add significant operational overhead (connection pooling, schema migrations across N databases, cross-tenant reporting) without proportional security benefit. PostgreSQL RLS provides database-enforced isolation within a shared schema. Row-level security ensures that even if application code has a bug, cross-tenant data leaks are prevented at the database level.
- **Consequences:** Every table containing tenant-scoped data must include `tenantId`. Every query must either go through RLS or explicitly filter by `tenantId`. Schema migrations must be applied once and apply to all tenants. Cross-tenant reporting requires explicit privileges.
- **Future Consideration:** If a tenant requires complete data isolation (e.g., a government agency with strict regulatory requirements), the architecture should support migrating that tenant to a dedicated database schema or instance without code changes (abstract the data access layer).

---

## Appendix: Cross-Cutting Concerns

### Observability

- **Logging:** Structured JSON logs (timestamp, level, service, trace_id, tenant_id, message, context). All logs flow to a centralized log aggregation service.
- **Metrics:** Prometheus-compatible metrics exposed on `/metrics`. Key metrics: request latency (p50, p95, p99), error rate by endpoint, active WebSocket connections, queue depth for external service calls, circuit breaker state per service.
- **Tracing:** Distributed tracing with OpenTelemetry. Every request gets a `trace_id` propagated across service boundaries. Essential for debugging cross-service workflows (e.g., "why did this alert not trigger?").

### Configuration Management

- All configuration is externalized (environment variables or config service).
- Secrets (API keys, encryption keys, database passwords) are stored in a secrets manager, never in code or environment files committed to version control.
- Tenant-specific configuration (check-in intervals, retention periods, feature flags) is stored in the `TenantPolicy` database table and cached in Redis.

### Deployment

- **Blue-Green Deployment:** Zero-downtime deployments using blue-green strategy. Traffic switched via load balancer.
- **Database Migrations:** Forward-only, reversible with down migrations. Tested against production-like data volumes before deployment. Migrations that lock tables must be scheduled during low-traffic windows.
- **Feature Flags:** New features can be deployed behind flags, enabled per tenant or globally. Essential for gradual rollouts during election monitoring periods.

---

*This document is a living reference. Update it as architectural decisions evolve, new patterns are adopted, or integration requirements change. All changes to this document should be reviewed by the solution design team and recorded as new ADRs.*