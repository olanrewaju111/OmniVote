# 12 — SRE: Senior SRE Engineer Guide

**Project:** OmniVote Monitor v2.1
**Document Owner:** Senior SRE Engineer
**Last Updated:** 2025-07-09
**Classification:** Internal — Operations & Engineering

---

## Introduction

This document is the operational bible for the Senior SRE Engineer on OmniVote Monitor v2.1, an election monitoring platform. Election day is the critical event — a 12–16 hour window of peak activity where downtime is politically unacceptable and could undermine public trust. The platform must achieve **99.9% uptime** during this window, and this guide defines the framework, processes, and tooling to achieve that.

Every section below is actionable. This is not a theoretical exercise — these are the standards you will be held to, the dashboards you will build, the alerts you will tune, and the runbooks you will execute under pressure.

---

## 1. SLO/SLI/SLA Framework

### 1.1 Service Level Objectives (SLOs)

SLOs are the contract between engineering and the business. They define what "good enough" looks like. Every reliability decision — from architecture changes to on-call staffing — traces back to these numbers.

| Service | SLI | Target SLO | Error Budget (30d) |
|---|---|---|---|
| API Availability | Successful requests / Total requests | 99.9% | 43.2 min downtime |
| API Latency (p95) | Requests < 2s / Total requests | 99% | 7.2 hours |
| API Latency (p99) | Requests < 5s / Total requests | 95% | 36 hours |
| Dashboard Load Time | Pages loading < 3s / Total | 95% | 36 hours |
| Real-Time Updates | Events delivered < 5s / Total | 99% | 7.2 hours |
| Incident Submission | Successful submissions / Total | 99.99% | 4.3 min |
| Data Integrity | Verified records / Total records | 100% | 0 |

**Key principle:** Data Integrity has a zero error budget. A single lost or corrupted incident report can have legal and political consequences. This is non-negotiable.

**Error budget policy:** When the error budget for any SLO drops below 50% for the rolling 30-day window, all feature deployments freeze. Engineering capacity pivots to reliability work until the budget recovers above 75%.

### 1.2 Election Day SLOs (Stricter)

Election day is not business as usual. These stricter SLOs activate at T-24 hours (24 hours before polls open) and remain in effect until all results are submitted and verified.

| SLI | Normal SLO | Election Day SLO |
|---|---|---|
| API Availability | 99.9% | 99.99% (max 8.6s downtime in the full window) |
| API Latency (p95) | 2s | 1s |
| Incident Submission | 99.99% | 99.999% (max 0.86s of failed submissions in the full window) |
| Real-Time Updates | 5s | 2s |

**Implication:** At 99.999% availability over 16 hours, you have **0.576 seconds** of allowable downtime. This means:
- No planned maintenance during the window.
- No deployments during the window (code freeze at T-24).
- All failover mechanisms must be automated — human reaction time is too slow.
- Pre-election load testing must prove the system can handle 3x expected peak load.

---

## 2. Reliability Engineering

### 2.1 Current Reliability Risks

The current architecture has significant reliability gaps. These are not theoretical — they are the things that will cause outages if left unaddressed:

- **Single point of failure:** One Bun process serves all traffic. If it crashes, everything is down.
- **No redundancy:** No failover, no replicas, no hot standby. Recovery is a cold start.
- **No monitoring:** No alerting, no dashboards, no observability. You are blind.
- **No automated recovery:** If the server crashes at 3 AM, it stays down until a human wakes up and restarts it.
- **Process instability:** The server has been observed dying between tool calls in the sandbox environment. This suggests memory issues, unhandled exceptions, or resource exhaustion under load.

These risks are acceptable for a prototype. They are **catastrophic** for election day.

### 2.2 Reliability Targets by Phase

Reliability is a journey, not a switch. The following phased approach aligns engineering investment with election timelines:

| Phase | Target Uptime | Recovery | Monitoring | Milestone |
|---|---|---|---|---|
| **Current (Prototype)** | 95% | Manual restart | None | Demo and stakeholder buy-in |
| **v2.2 (State Election)** | 99% | Basic monitoring, manual failover | Prometheus + Grafana, basic alerts | Prove the platform at scale |
| **v3.0 (National Election)** | 99.9% | Auto-failover, circuit breakers | Full observability stack, SLI dashboards | Production-grade reliability |

**v2.2 is the critical stepping stone.** Every hour spent on reliability for the state election pays dividends for the national election. Do not skip this phase.

### 2.3 Failure Mode Analysis (FMEA)

The following table documents every identified failure mode, its impact, current mitigation status, and the target mitigation for production:

| Failure Mode | Effect | Current Mitigation | Target Mitigation |
|---|---|---|---|
| Bun process crash | Complete outage | Manual restart | Auto-restart (systemd/supervisor) + health check + circuit breaker |
| SQLite corruption | Data loss, outage | None | Migrate to PostgreSQL with streaming replication + WAL archiving |
| Disk full | Write failures, incident loss | None | Disk monitoring (>80% alert) + automated log rotation + auto-cleanup of temp files |
| Memory leak | Degradation → crash | None | Container memory limits + periodic health checks + auto-restart on OOM |
| Network partition | No external access, agent disconnects | None | Exponential backoff retry + offline queue for incident submissions + WebSocket reconnection |
| DDoS attack | Service unavailable | None | WAF (Cloudflare/AWS Shield) + rate limiting per IP + geographic blocking for non-operational regions |
| Database lock contention | Slow writes, timeout errors | WAL mode enabled | PostgreSQL with connection pooling (PgBouncer) + read replicas for dashboard queries |
| DNS failure | Cannot reach external APIs (WhatsApp, etc.) | None | Local DNS cache + DNS-over-HTTPS fallback + secondary DNS provider |
| Certificate expiry | HTTPS fails, agents cannot connect | Auto-renew via Caddy | Proactive certificate monitoring (alert at 14 days) + Caddy auto-renew with health check |

**Priority order for mitigation** (based on likelihood × impact on election day):
1. Bun process crash (immediate — add process supervisor)
2. Database lock contention (v2.2 — migrate to PostgreSQL)
3. Memory leak (v2.2 — container limits + monitoring)
4. Disk full (v2.2 — monitoring + rotation)
5. DDoS attack (v2.2 — WAF + rate limiting)
6. Network partition (v3.0 — offline queue)
7. SQLite corruption (v3.0 — eliminated by PostgreSQL migration)
8. DNS failure (v3.0 — DNS cache)
9. Certificate expiry (current — already mitigated by Caddy)

---

## 3. Monitoring & Observability

### 3.1 Monitoring Stack (Target)

The observability stack follows the three pillars model — metrics, logs, and traces — unified under OpenTelemetry for consistent instrumentation:

| Pillar | Tool | Purpose |
|---|---|---|
| **Metrics** | Prometheus + Grafana | Time-series data, dashboards, alerting |
| **Logs** | Loki (or ELK Stack) | Structured log aggregation and search |
| **Traces** | Jaeger or Tempo (OpenTelemetry) | Distributed request tracing across services |
| **Alerts** | PagerDuty or Opsgenie | On-call routing, escalation, incident lifecycle |
| **Uptime** | UptimeRobot or custom ping | External availability monitoring from multiple regions |

**Implementation priority:** Metrics first (you cannot improve what you cannot measure), then logs (for debugging), then traces (for complex latency analysis).

### 3.2 Key Metrics to Monitor

#### Infrastructure Metrics

These are the foundation. If these are wrong, nothing above them works:

- CPU usage (per container/pod) — alert at >80% sustained for 5 min
- Memory usage + OOM kills — alert at >85% sustained for 5 min
- Disk usage + IOPS — alert at >80% disk usage
- Network I/O (bytes/sec, connections) — baseline and detect anomalies
- File descriptors — alert if approaching ulimit
- TCP connections (established, time_wait) — detect connection leaks

#### Application Metrics

These tell you what the application is doing and how well it is doing it:

- Request rate (per endpoint, per HTTP method, per status code)
- Error rate (4xx client errors, 5xx server errors) — alert at >5% 5xx for 5 min
- Response latency (p50, p75, p90, p95, p99) — alert at p95 > 3s for 5 min
- Active WebSocket connections — track real-time update delivery
- Database connection pool usage — alert at >80% pool utilization
- Redis memory usage — alert at >80%
- Celery queue depth — alert if backlog grows for >10 min

#### Business Metrics

These tell you whether the system is achieving its mission, not just whether it is technically healthy:

- Active agents (online/total) — the single most important business metric
- Incidents submitted per minute — track submission velocity
- Alerts triggered per minute — detect abnormal patterns
- PVT coverage percentage — % of polling units with at least one checked-in agent
- Check-in compliance rate — % of expected check-ins completed on time
- Dead-man's switch escalation count — critical safety metric
- WhatsApp message delivery rate — % of messages successfully delivered

#### Election Day Special Metrics

These metrics are unique to the election day operational scenario and should have dedicated dashboard panels:

- Total incident submissions (running count with rate-of-change)
- Agent coverage (% of polling units with checked-in agents, updated in real-time)
- Results submission rate (% of polling units with submitted results)
- Critical incident count (severity-filtered live counter)
- SOS triggers (immediate alert, dedicated panel)
- System response time under load (compare to election day SLO targets)

### 3.3 Alerting Rules

Every alert must have a clear severity, a defined response procedure, and a documented runbook. Alert fatigue kills on-call effectiveness — if an alert fires and no one acts on it, it should not exist.

| Alert | Condition | Severity | Channel |
|---|---|---|---|
| Service Down | No response for 60s | CRITICAL | PagerDuty + Slack |
| High Error Rate | 5xx > 5% for 5min | HIGH | Slack + Email |
| High Latency | p95 > 3s for 5min | HIGH | Slack |
| Database Slow | Query > 5s | WARNING | Slack |
| Disk > 80% | Disk usage > 80% | WARNING | Email |
| Memory > 85% | Memory > 85% | WARNING | Email |
| Certificate Expiry | < 14 days to expiry | WARNING | Email |
| Agent SOS | Any SOS trigger from field agent | CRITICAL | PagerDuty + SMS + Slack |
| Dead-Man's Level 3 | Dead-man's switch escalation reaches level 3 | CRITICAL | PagerDuty + SMS + Phone Call |
| Zero Active Agents | All field agents appear offline simultaneously | HIGH | Slack |

**Alerting philosophy:** Every CRITICAL alert must wake someone up. Every WARNING alert must be actionable within business hours. If an alert does not meet these criteria, remove it.

### 3.4 Dashboard Design

Build four Grafana dashboards, each serving a distinct audience and purpose:

1. **System Overview** — For the SRE team. Shows uptime percentage, request rate, error rate, latency heatmap, resource utilization. This is your daily operational dashboard.

2. **Election Day War Room** — For leadership and operations command. Shows live KPIs (agent coverage, incident count, submission rate), a live incident feed, agent geographic map with real-time positions, and SOS alerts in a prominent banner. This dashboard is projected on screens during election day.

3. **Database Health** — For the SRE and database team. Shows connection pool usage, query performance percentiles, replication lag (when implemented), disk usage growth trend, and slow query log.

4. **Business Metrics** — For the operations team and project management. Shows agent coverage over time, PVT progress against plan, check-in compliance rate, and incident category breakdown.

---

## 4. Incident Management

### 4.1 Incident Severity Levels

Severity determines response urgency, communication cadence, and escalation path. When in doubt, escalate up — it is always better to over-triage than to under-triage during an election.

| Level | Name | Response Time | Communication | Examples |
|---|---|---|---|---|
| SEV-1 | Critical | 5 min | Immediate: all stakeholders | Complete outage, data breach, mass agent disconnect, election data at risk |
| SEV-2 | Major | 15 min | Within 30 min: leadership | Degraded performance (>50% latency increase), partial outage (one region), critical feature down |
| SEV-3 | Minor | 1 hour | Next business update | Non-critical feature down (e.g., reporting), slow but functional performance |
| SEV-4 | Low | 4 hours | Next scheduled update | UI bug, minor inconvenience, cosmetic issue |

### 4.2 Incident Response Process

This is the standard incident lifecycle. Every incident, regardless of severity, follows this process:

1. **Detection:** Alert fires from monitoring system, or a user/agent reports an issue via the support channel.
2. **Triage:** On-call SRE assesses severity based on impact scope and user/agent count affected. Assigns severity level and creates incident record.
3. **Communicate:** Send initial status update to the incident channel (Slack). For SEV-1/SEV-2, notify leadership within the response time window. Include: what is broken, who is affected, what is being done, and estimated time to next update.
4. **Mitigate:** Implement the fastest fix or workaround to restore service. This may not be the root-cause fix — the goal is to stop the bleeding first.
5. **Resolve:** Confirm service is restored by verifying SLIs have returned to SLO-compliant levels. Send resolution communication. Close the incident record.
6. **Post-Mortem:** Conduct a blameless post-incident review within 48 hours. Document timeline, root cause, contributing factors, and action items with owners and deadlines. Share learnings with the wider engineering team.

**Election day addendum:** During the election day window, the post-mortem is deferred. Focus 100% on detection, triage, communication, mitigation, and resolution. Post-mortems happen after the election window closes.

### 4.3 Runbook Library

Every alert must have a corresponding runbook. The on-call SRE should not be figuring out what to do for the first time at 3 AM on election day. Build and test these runbooks before they are needed:

- **RB-001: Bun Process Crash** — Identify crash (check logs for OOM, unhandled exception, or signal). Restart process via systemd/supervisor. Verify health endpoint responds. Check for recurring crash pattern. If recurring, escalate to engineering.

- **RB-002: Database Connection Exhaustion** — Identify pool saturation (check connection count vs. limit). Restart application to release stale connections. If recurring, increase pool size. Investigate slow queries holding connections. Consider adding connection timeout.

- **RB-003: High Memory Usage** — Identify memory consumer (application heap, Redis cache, OS buffers). Check for memory leak pattern (growth over time vs. spike). If leak suspected, restart process and escalate for profiling. If spike, identify the workload that caused it.

- **RB-004: Disk Full** — Identify largest consumers (log files, temp files, database). Clean up rotated logs older than 7 days. Clear temp files. If database is the consumer, run VACUUM (SQLite) or consider expanding the volume. Alert on disk growth trend.

- **RB-005: DDoS Attack** — Verify attack pattern (traffic spike from distributed sources). Enable rate limiting at CDN/WAF level. Block offending IP ranges. Enable geographic blocking for non-operational regions. Contact CDN provider for additional mitigation. Escalate if attack persists > 30 min.

- **RB-006: Certificate Expired** — Force certificate renewal via Caddy (`caddy reload --config /path/to/Caddyfile`). Verify new certificate is served (`openssl s_client`). If Caddy fails, manually request certificate via Let's Encrypt and configure. Post-incident: add certificate expiry monitoring with 14-day warning.

- **RB-007: Agent Mass Disconnect** — Verify it is not a false positive (check monitoring for actual connection drops). Check server-side WebSocket infrastructure. Check network connectivity from server to the internet. If server-side issue, restart WebSocket service. If network issue, contact infrastructure provider. Send bulk WhatsApp message to affected agents to reconnect.

- **RB-008: Dead-Man's Switch False Positive** — Verify agent safety FIRST (this is a human safety concern, not just a technical issue). Contact the agent via phone. Once safety is confirmed, investigate technical cause (app crash, network issue, dead battery). Resolve the switch in the system. Document the false positive for future tuning.

---

## 5. Capacity Planning

### 5.1 Current Resource Usage (Baseline)

These numbers represent the current prototype running under minimal load:

| Resource | Current Usage | Notes |
|---|---|---|
| CPU | Single core sufficient | < 10% utilization at idle |
| Memory | ~512 MB | Next.js + SQLite in-process |
| Disk | ~100 MB | Database + application logs |
| Network | < 1 Mbps average | Minimal traffic in prototype phase |

### 5.2 Election Day Capacity Requirements

Based on projected election day activity for a state-level election:

| Parameter | Expected Load |
|---|---|
| Concurrent users | 5,000 (field agents + monitors + admins) |
| API requests | 100,000 per hour (average), 300,000 per hour (peak) |
| WebSocket connections | 3,000 sustained |
| Incident submissions | 500 per hour (average), 2,000 per hour (peak) |

**Recommended instance sizing per node:**

| Resource | Per Instance |
|---|---|
| CPU | 4 vCPU |
| Memory | 8 GB RAM |
| Disk | 50 GB SSD (IOPS-optimized) |

**Recommended cluster topology:**

| Instance Type | Count | Purpose |
|---|---|---|
| Next.js Application | 3 | Web application + API (behind load balancer) |
| Worker | 2 | Background jobs (WhatsApp dispatch, notifications, dead-man's checks) |
| Database | 1 (primary) + 1 (replica) | PostgreSQL with streaming replication |

### 5.3 Scaling Strategy

Election day does not allow for reactive scaling. You must be ready before polls open:

- **Pre-scale (T-24h):** Scale all instances to peak capacity 24 hours before election day. Run load tests at this capacity to verify. Do not wait for auto-scaling to kick in.
- **Auto-scale (during election):** Configure auto-scaling as a safety net. Trigger: CPU > 70% sustained for 5 minutes → add 1 instance. Maximum: 5 application instances.
- **Scale-down (T+48h):** After election day, gradually reduce to baseline over 48 hours. Do not scale down immediately — results verification and post-election analysis may generate load.
- **Load testing:** Run a full load test at 3x expected peak load at least 2 weeks before election day. Any bottlenecks found must be fixed and re-tested.

---

## 6. Disaster Recovery

### 6.1 Backup Strategy

Backups are the last line of defense. If everything else fails, backups are what stand between you and data loss:

| Data Type | Backup Method | Frequency | Retention |
|---|---|---|---|
| Database | Continuous WAL archiving + daily full backup | Continuous + daily | 30 days (daily), 7 days (WAL) |
| Media files (photos, audio) | S3 with versioning + cross-region replication | Continuous | 90 days |
| Configuration | Git-managed infrastructure as code | On every change | Indefinite (Git history) |
| Application logs | Loki/log aggregation | Continuous | 30 days |

**Backup testing:** Run a monthly restore drill. Restore the most recent backup to a staging environment, verify data integrity, and measure recovery time. Document results. If you have not tested a restore, you do not have a backup — you have a hope.

### 6.2 Recovery Objectives

| Objective | Target | Rationale |
|---|---|---|
| RPO (Recovery Point Objective) | < 1 minute | Election data arrives continuously; losing >1 minute means losing incident reports |
| RTO (Recovery Time Objective) | < 5 minutes | Automated failover must restore service before users notice |

### 6.3 Disaster Scenarios

| Scenario | RPO | RTO | Procedure |
|---|---|---|---|
| Single server failure | 0 (no data loss) | 30s | Automated failover to hot standby; load balancer routes traffic to healthy instances |
| Database corruption | < 1 min | 5 min | Promote streaming replica; use Point-in-Time Recovery (PITR) from WAL to replay up to corruption point |
| Data center failure | < 1 min | 15 min | Failover to DR region; DNS update routes traffic to secondary; verify all services healthy |
| Ransomware attack | < 1 hour | 1 hour | Restore from immutable (write-once) backups; isolate affected systems; engage security team |
| DNS failure | 0 | 0 | Local DNS cache serves recent records; secondary DNS provider takes over; zero user-visible impact |

---

## 7. On-Call Rotation

### 7.1 Normal Operations

During non-election periods, the on-call rotation is designed for sustainability:

| Role | Count | Shift | Responsibilities |
|---|---|---|---|
| Primary On-Call | 1 | 1 week rotation | First responder to all alerts, execute runbooks, escalate as needed |
| Backup On-Call | 1 | 1 week rotation (offset) | Takes over if primary does not respond within 15 minutes |

**Escalation path:** Primary On-Call → Backup On-Call → Engineering Lead → CTO

### 7.2 Election Day Operations

Election day is treated as a war room scenario. The standard rotation is suspended and replaced with dedicated shifts:

| Role | Count | Shift Duration | Responsibilities |
|---|---|---|---|
| SRE On-Site/On-Call | 3 | 8-hour shifts (covering full 24h window) | Active monitoring, immediate incident response, war room coordination |
| Engineering Lead | 1 | On-call for full window | Final escalation point, stakeholder communication, go/no-go decisions |
| Operations Commander | 1 | Full window | Non-technical coordination, field agent communication, external stakeholder updates |

**Election day rules:**
- All three SREs are simultaneously reachable during shift handoffs (30-minute overlap).
- The war room Slack channel is the single source of truth for all status updates.
- No code changes during the election window. The only acceptable action is a runbook execution or a configuration rollback.
- Every 30 minutes, the on-duty SRE posts a status summary to the war room channel: current SLI status, any active incidents, any upcoming concerns.

---

## Appendix: Quick Reference — SRE Checklist

### Pre-Election (T-2 weeks)
- [ ] All runbooks written and reviewed
- [ ] Load test completed at 3x peak capacity
- [ ] All monitoring dashboards built and validated
- [ ] All alerting rules tuned (zero false positives in 48h test)
- [ ] Backup restore drill completed successfully
- [ ] Certificate expiry confirmed > 30 days out
- [ ] On-call rotation published and confirmed

### Pre-Election (T-24h)
- [ ] Code freeze in effect
- [ ] All instances pre-scaled to peak capacity
- [ ] War room channel created and all team members joined
- [ ] PagerDuty/Opsgenie schedules updated for election rotation
- [ ] External stakeholder communication plan confirmed
- [ ] Last backup verified before window opens

### During Election
- [ ] Status updates every 30 minutes to war room
- [ ] Error budget monitored continuously
- [ ] SEV-1 incidents require immediate war room notification
- [ ] No deployments, no configuration changes (except runbook-approved actions)

### Post-Election (T+48h)
- [ ] Scale-down to baseline capacity
- [ ] Post-mortems scheduled for all SEV-1 and SEV-2 incidents
- [ ] Error budget report generated
- [ ] Runbooks updated with lessons learned
- [ ] Reliability retrospective with full engineering team

---

*This document is a living artifact. Update it as the system evolves, as new failure modes are discovered, and as operational learnings accumulate. The goal is not perfection on day one — the goal is continuous improvement toward the reliability standards that election monitoring demands.*