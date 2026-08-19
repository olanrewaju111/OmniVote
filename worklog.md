# OmniVote Development Work Log

---
Task ID: 10
Agent: Super Z (Main)
Task: Phase 10 — Performance Optimization

Work Log:
- Configured `next.config.ts` with `experimental.optimizePackageImports` for recharts, lucide-react, framer-motion, date-fns, @radix-ui/react-icons (reduces initial bundle by replacing barrel imports with deep imports)
- Enabled `LazyMotion` with `domAnimation` feature set in `providers.tsx` (reduces framer-motion bundle ~40%)
- Migrated all 47 files from `motion.div` to `m.div` (required by LazyMotion strict mode)
- Implemented smart polling in `page.tsx`: `refetchInterval` is disabled when WebSocket is connected, falling back to 30s polling when disconnected
- Wrapped 18 heavy tab components (800+ lines) with `React.memo`
- Wrapped `TabContent` in `tab-renderer.tsx` with `React.memo` + custom comparator that skips re-renders when only `liveIncidents` changes for non-consuming tabs
- Added hover prefetch hook in sidebar nav buttons

Stage Summary:
- Bundle size reduced via optimizePackageImports and LazyMotion
- 18 components memoized to prevent unnecessary re-renders
- Network requests reduced via WS-aware smart polling
- All 47 framer-motion files migrated to `m.` API

---
Task ID: 13
Agent: Super Z (Main)
Task: Phase 13 — Advanced Data Visualization

Work Log:
- Created `ElectionHeatmap` component: recharts ScatterChart-based heatmap with color interpolation, custom tooltip, gradient legend, hover highlighting, click callback support
- Created `RadarOverview` component: multi-series radar chart with legend toggles, normalized/absolute scale, auto-computed axis domain, responsive design
- Created `RealtimeStreamChart` component: streaming area chart with live/pause toggle, zoom in/out/reset controls, synthetic data generator, auto Y-domain, mean reference line, stats display (current/mean/trend)
- Created `SankeyFlow` component: custom SVG-based Sankey flow diagram with auto-layout engine, topological node ordering, cubic bezier link paths, hover highlighting with dimming, responsive ResizeObserver
- Enhanced `DataExplorer` tab with 6 visualization modes: Drill-Down, Heatmap, Radar, Live Stream (dual), Voter Flow (Sankey), and Time-Series Trends
- Added deterministic synthetic data generators for heatmap cells, radar series, and sankey flow from situation room data

Stage Summary:
- 4 new visualization components (ElectionHeatmap, RadarOverview, RealtimeStreamChart, SankeyFlow)
- DataExplorer tab now has 6 interactive visualization modes
- All new components use consistent design system (Card wrapper, oklch colors, backdrop-blur)
- RealtimeStreamChart includes built-in synthetic demo data for immediate visual impact
- SankeyFlow uses custom SVG layout engine (no external D3 dependency)

---
Task ID: 10-13 (continuation)
Agent: Super Z (Main)
Task: Phase 10 (Performance) + Phase 13 (Advanced Viz) — Round 2

Work Log:
- Fixed 4 pre-existing TS errors: election-heatmap (out-of-scope variables), realtime-stream-chart (onChange→onDataChange prop name), sankey-flow (Map constructor type error, wrong ref type), victory-roadmap (missing React import)
- Wrapped AppHeader with React.memo (Phase 10)
- Added useMemoizedCallback import to page.tsx and live-feed.tsx for future stable callback usage
- Enhanced next.config.ts: added compress:true, poweredByHeader:false, reactProductionProfiling:false, images.formats=[avif,webp], images.minimumCacheTTL=60, experimental.optimizeCss=true
- Enhanced DrillDownChart (Phase 13): added maxDepth prop (default 3), onBreadcrumbNavigate callback, showSummary prop with Average/Maximum/Items stat cards
- Added DashboardExport button to Data Explorer tab with container ref
- Added CSV export functionality to TimeSeriesComparison with Download button
- Added crosshair hover guides (ReferenceLine) to ElectionHeatmap on both X and Y axes
- Verified: 0 TypeScript errors, clean production build (32.9s compile, 44/44 static pages)

Stage Summary:
- 4 pre-existing TS bugs fixed
- AppHeader memoized for reduced re-renders
- next.config.ts now has production-grade optimization settings (compression, image formats, CSS optimization)
- DrillDownChart enhanced with depth limiting, breadcrumb navigation callback, and aggregate summary statistics
- Data Explorer now exportable as PNG/PDF via DashboardExport component
- TimeSeriesComparison supports CSV data export
- ElectionHeatmap has interactive crosshair hover guides
- Build: 0 errors, optimizeCss active, all 44 routes compiling

---
Task ID: 12
Agent: Super Z (Main)
Task: Phase 12 — SRE: Observability, SLO Tracking & Runbooks

Work Log:
- Created `src/lib/sre/slo-tracker.ts`: In-memory SLO tracker with 7 SLO definitions (from SRE guide doc 12), error budget calculation, burn rate, deployment freeze detection, periodic JSON persistence, LRU-style record trimming
- Created `src/lib/sre/request-logger.ts`: Structured request logging with `logRequest()` and `createRequestTimer()` helpers, Prometheus-style latency histogram per route, request counter (total/4xx/5xx), active connections gauge
- Created `src/lib/sre/runbooks.ts`: 8 runbooks (RB-001 through RB-008) matching the SRE guide — process crash, DB connection exhaustion, high memory, disk full, DDoS, cert expiry, agent mass disconnect, dead-man's switch false positive
- Enhanced `/api/health`: Deep health checks (DB query + schema read), version string, WebSocket connection count, SLO deployment freeze status, returns 503 on degradation
- Created `/api/slo`: Full SLO report with all 7 SLOs, error budgets, burn rates, 1-hour recent metrics summary, election day SLO definitions
- Created `/api/metrics`: Prometheus text exposition format endpoint with process metrics, HTTP request counters, latency histograms, SLO compliance gauges, error budget gauges, burn rate gauges
- Created `/api/runbooks` (list) and `/api/runbooks/[id]` (detail) endpoints
- Enhanced `SystemHealth` component: SLO error budget progress bars with burn rate indicators, deployment freeze banner, 1h error rate KPI card, runbook browser with expand/collapse, WebSocket connection count in service grid

Stage Summary:
- 7 SLOs tracked with in-memory persistence (api_availability 99.9%, api_latency_p95 99%, api_latency_p99 95%, dashboard_load 95%, realtime_updates 99%, incident_submission 99.99%, data_integrity 100%)
- Error budget engine with burn rate calculation and deployment freeze detection
- Prometheus-compatible `/api/metrics` endpoint ready for scraping
- 8 automated runbooks accessible via API
- System Health tab now shows SLO compliance visually with budget bars
- Build: 0 TS errors, 47 routes, clean production build

---
Task ID: 14
Agent: Super Z (Main)
Task: Phase 14 — DevOps: CI/CD, Containerization, Monitoring Stack

Work Log:
- Enhanced `Dockerfile`: Added `dumb-init` as PID 1 for proper signal handling, security updates on build, non-root user from stage 3, `ca-certificates` for TLS, `HEALTHCHECK` with wget, proper `ENTRYPOINT` pattern
- Enhanced `docker-compose.yml`: Added PostgreSQL 16 (with health check, WAL-ready), Redis 7 (AOF persistence, password auth), Prometheus v2.54 (with alert rules, 30d retention), Grafana 11.3 (with auto-provisioning), resource limits (memory + CPU) for all services, structured JSON log driver, custom bridge network (172.28.0.0/16)
- Created `.github/workflows/ci.yml`: 6-job pipeline — lint, typecheck, build, docker (build+push to GHCR), deploy. Concurrency groups, branch-based triggers, manual dispatch with environment selector
- Created `nginx/conf.d/default.conf`: Rate limiting zones (10r/s API, 2r/s auth, 5r/s general), geo-blocking stub, security headers (X-Frame-Options, CSP, HSTS, Permissions-Policy), aggressive static asset caching (30d), health/metrics endpoint special handling, custom 429 JSON response
- Updated `nginx/nginx.conf`: JSON log format for Loki integration, connection tuning (keepalive 1000, timeouts), gzip level 4, epoll, multi_accept
- Created `monitoring/prometheus/prometheus.yml`: 15s scrape interval, alert rules file reference, OmniVote app target
- Created `monitoring/prometheus/alerts.yml`: 8 alert rules — service down, high error rate >5%, high p95 latency >3s, memory >85%, SLO budget exhausted, SLO budget warning <50%, zero active agents, deployment freeze
- Created `monitoring/grafana/provisioning/`: Datasource (Prometheus) and dashboard provisioning configs
- Created `monitoring/grafana/dashboards/omnivote-overview.json`: 7-panel Grafana dashboard — API availability stat, request rate, error rate, p95 latency, request rate time series, memory usage time series, SLO error budget bar gauges
- Created `scripts/sre/backup.sh`: Full backup script with PostgreSQL (pg_dump -Fc) and SQLite fallback, application data tarball, backup manifest JSON, configurable retention (30d default), dry-run mode
- Created `scripts/sre/restore.sh`: Restore script with backup validation, manifest display, confirmation prompt, PostgreSQL (pg_restore --clean) and SQLite support

Stage Summary:
- Production-ready Dockerfile with security hardening (non-root, dumb-init, minimal image)
- Full observability stack: Prometheus + Grafana + custom alerts
- CI/CD pipeline with lint → typecheck → build → docker push → deploy stages
- Nginx with rate limiting, security headers, and JSON logging
- Backup/restore scripts for disaster recovery
- 8 Prometheus alert rules covering SRE guide requirements
- Build: 0 TS errors, 47 routes, clean production build (32.1s compile)

---
Task ID: 3a
Agent: Super Z (Sub)
Task: Add React.memo wrapping to heavy dashboard components

Work Log:
- Audited all 26 specified dashboard tab components for React.memo wrapping
- 14 components were already wrapped with React.memo (security-center, mobilization, agent-engagement, field-safety, pvt-quick-count, victory-roadmap, evidence-dossier, flashpoint-wargame, honeypot-biometrics, agent-roster, tenant-mgmt, reports-center, narrative-builder, osint-monitor)
- Wrapped remaining 12 components with React.memo using the Inner rename pattern:
  - audit-log-viewer.tsx → AuditLogViewerInner + React.memo export
  - system-health.tsx → SystemHealthInner + React.memo export (added React import)
  - situation-room.tsx → SituationRoomInner + React.memo export (added React import)
  - data-explorer.tsx → DataExplorerInner + React.memo export (added React import)
  - election-management.tsx → ElectionManagementInner + React.memo export (added React import)
  - live-feed.tsx → LiveFeedInner + React.memo export
  - alert-triage.tsx → AlertTriageInner + React.memo export
  - ai-insights.tsx → AiInsightsInner + React.memo export (added React import)
  - media-gallery.tsx → MediaGalleryInner + React.memo export (added React import)
  - field-reports.tsx → MyReportsInner + React.memo export
  - field-submit.tsx → SubmitReportInner + React.memo export (added React import)
  - overview-tab.tsx → OverviewTabInner + React.memo export (added React import)
- Pattern used: renamed main function to `ComponentNameInner`, added `export const ComponentName = React.memo(ComponentNameInner)` after it, preserving export names so lazy-components.tsx imports required zero changes
- Added `import React from 'react'` (or merged into existing react import) for 8 files that only had named imports

Stage Summary:
- All 26 heavy dashboard tab components now wrapped with React.memo
- No changes needed in lazy-components.tsx (export names preserved)
- Build: 0 errors, clean production build

---
Task ID: 5
Agent: phase-12-testing
Task: Phase 12 — Testing & QA Setup

Work Log:
- Installed testing dependencies: vitest, @testing-library/react, @testing-library/jest-dom, @vitejs/plugin-react, jsdom, @testing-library/user-event
- Created `vitest.config.ts`: jsdom environment, React plugin, @/ path alias, V8 coverage (src/lib, src/hooks), global setup file
- Created `src/test/setup.ts`: jest-dom matchers, next/navigation mocks (useRouter/usePathname/useSearchParams), next/dynamic mock, global fetch mock
- Added test scripts to package.json: `test` (vitest run), `test:watch` (vitest), `test:coverage` (vitest run --coverage)
- Created `src/lib/__tests__/performance.test.ts` (44 tests): shallowEqual, debounce (delay/cancel/args/reset), throttle (immediate/throttle/cancel/args), LRUCache (get/set/has/delete/clear/size/eviction/getOrCompute/maxSize=1/error), formatBytes, createPropsComparator
- Created `src/lib/__tests__/sanitize.test.ts` (24 tests): stripHtml, escapeHtml, sanitizeInput, sanitizeCsvField
- Created `src/lib/__tests__/validate.test.ts` (49 tests): sanitize.str/num/bool, validate (required/minLength/maxLength/email/slug/color/UUID/pattern/label), validateNum (required/min/max/integer), validateEnum, isValidEmail, VALIDATION_RULES
- Created `src/lib/__tests__/rate-limit.test.ts` (8 tests): burst limiting, anonymous fallback, per-user separation, per-route separation, Retry-After headers, preset category strings, withRateLimitHeaders
- Created `src/lib/__tests__/audit.test.ts` (9 tests): extractIp (x-forwarded-for/x-real-ip/priority/unknown), logAudit (correct data/metadata/defaults/error handling) with mocked db
- Created `src/components/ui/__tests__/virtualized-list.test.tsx` (4 tests): empty state, items rendering, header, className
- Mocked `../auth` in rate-limit test to avoid JWT_SECRET env var requirement
- Fixed setup.ts JSX in .ts file issue by removing JSX from next/dynamic mock
- All 138 tests passing across 6 test files

Stage Summary:
- Complete testing infrastructure with Vitest + React Testing Library + jsdom
- 138 unit and component tests covering critical utility modules
- Test scripts integrated into package.json (test, test:watch, test:coverage)
- 0 test failures, all 6 test suites green

---
Task ID: 6
Agent: phase-14-deploy
Task: Phase 14 — Deployment & DevOps

Work Log:
- Created `Dockerfile`: 3-stage multi-stage build (deps → builder → runner) based on node:20-alpine, non-root user (omnivote:nodejs), dumb-init PID 1, labels (maintainer, description, version, source), Prisma client generation in build stage, standalone output with static+public+prisma copied to runner, healthcheck via wget /api/health, exposes port 3000
- Created `docker-compose.yml`: 3 services (app on :3000, postgres:16-alpine with healthcheck/data volume, ws sidecar on :3001 using tsx ws-server.ts), .env file variable interpolation, omnivote-net bridge network, app-data/app-logs/postgres-data volumes, ws service depends on postgres health
- Created `docker-compose.prod.yml`: production overrides for all 3 services — restart: unless-stopped, resource limits (app: 1G/2CPU, postgres: 512M/1CPU, ws: 512M/1CPU), health checks (app via wget /api/health, ws via wget /health, postgres via pg_isready), json-file log driver with size limits, no source code volume mounts
- Created `.env.example`: comprehensive template with DATABASE_URL (PostgreSQL), JWT_SECRET, NEXT_PUBLIC_APP_NAME=OmniVote, NEXT_PUBLIC_WS_URL, WS_PORT=3001, IP_WHITELIST (commented), NODE_ENV, SMTP settings (commented), PostgreSQL service vars, LOG_LEVEL
- Created `.github/workflows/ci.yml`: 4-job pipeline (lint-and-typecheck, test, build, docker) — Node 20, npm caching for node_modules and .next, ESLint + tsc --noEmit in parallel, vitest with coverage upload as artifact, Next.js production build with CI env vars, Docker build+push to GHCR (main only) with GHA cache
- Created `.github/workflows/deploy.yml`: deployment pipeline with workflow_dispatch (environment: staging/production) and main push trigger, Docker Buildx + GHCR login + metadata extraction, environment-aware SSH deploy (staging vs production host/path secrets), copies compose files, pulls images, runs prisma db push, restarts with prod overrides, health check with rollback documentation in header comments
- Created `scripts/healthcheck.sh`: bash script calling /api/health, checks HTTP 200 and JSON status='ok' or 'healthy', configurable URL argument, 10s timeout, exit 0/1
- Created `.dockerignore`: excludes node_modules, .next, .git, *.md, Dockerfile, docker-compose*.yml, .env files, prisma/migrations, test files, coverage, skills/, download/, agent-ctx/, examples/, monitoring/, nginx/, .github/, IDE files, lock files
- Enhanced `src/app/api/health/route.ts`: simplified to return status:'ok' (not 'healthy'), version read from package.json via readFileSync, uptime in ms, timestamp, database connectivity check via SELECT 1, websocket status based on WS_PORT env var (ok/disabled), removed unused SLO/memory/runtime fields, returns 503 on degradation
- Created `scripts/deploy.sh`: deployment helper accepting staging/production argument, pulls images, runs prisma db push, restarts services with correct compose files, waits for health check with 30 retries × 5s interval, shows logs on failure

Stage Summary:
- Complete production Docker setup with multi-stage Dockerfile (node:20-alpine, non-root, dumb-init)
- docker-compose.yml for dev with app + postgres + ws services
- docker-compose.prod.yml with resource limits, restart policies, health checks for all services
- Comprehensive .env.example with all required and optional variables
- CI pipeline: lint+typecheck → test+coverage → build → docker push (Node 20)
- Deploy pipeline: manual staging/production dispatch, SSH deploy with health check verification
- Health check endpoint returns clean {status:'ok', version, uptime, timestamp, database, websocket} response
- .dockerignore optimized for minimal build context
- Helper scripts: healthcheck.sh (standalone) and deploy.sh (full deployment flow)

---
Task ID: 11
Agent: Super Z (Sub)
Task: Phase 11 — Advanced Security Hardening

Work Log:
- Created `src/lib/security/csrf.ts`: CSRF protection using Double-Submit Cookie pattern — `generateCsrfToken()` creates 32-byte hex token with non-httpOnly cookie (readable by JS), `validateCsrfToken()` uses constant-time comparison, `CsrfError` class
- Created `src/lib/security/brute-force.ts`: In-memory brute-force login protection with escalating lockouts (5→15min, 10→30min, 15→60min), auto-cleanup of stale entries every 10 minutes, `checkLoginAttempt()`, `recordFailedAttempt()`, `recordSuccessfulLogin()`, `isAccountLocked()`
- Created `src/lib/security/input-validator.ts`: Enhanced input validation — `validateEmail()` (RFC 5322-ish, length limits, TLD check), `validatePassword()` (min 10 chars, uppercase/lowercase/number/special, common password detection, strength scoring), `validateUrl()` (http/https only, javascript: protocol blocking, sanitization), `validateJsonDepth()` (default max 10, prevents stack overflow), `validatePhoneNumber()` (Nigerian format normalization), `validateId()` (UUID v4, CUID, NanoID), `sanitizeObject()` (key whitelist, string sanitization, max lengths)
- Created `src/lib/security/cors.ts`: CORS configuration utility — `isOriginAllowed()` checks ALLOWED_ORIGINS env var, `getCorsHeaders()` returns appropriate CORS headers for allowed/disallowed origins, preflight support
- Created `src/lib/security/security-logger.ts`: Security-specific structured JSON logging — `logSecurityEvent()` with severity-based routing (critical→console.error, warning→console.warn, info→console.info), 10 event types (LOGIN_SUCCESS, LOGIN_FAILURE, ACCOUNT_LOCKED, CSRF_FAILURE, RATE_LIMITED, SUSPICIOUS_REQUEST, PERMISSION_DENIED, TOKEN_EXPIRED, BRUTE_FORCE_DETECTED, IP_BLOCKED)
- Created `src/lib/security/request-guard.ts`: Unified API route guard — `createRouteGuard()` composes auth check, CSRF validation, rate limiting, and CORS into a single async guard function, simplifies API route security boilerplate
- Created `src/lib/security/index.ts`: Barrel export for all security modules
- Enhanced `src/app/api/auth/route.ts`: Added brute-force protection layer (in-memory, before DB rate limiter), random 500-2000ms delay on failed login to prevent timing attacks, security event logging for ACCOUNT_LOCKED and LOGIN_SUCCESS events, clear brute-force counter on successful login
- Created 5 test files (98 tests total, all passing):
  - `csrf.test.ts` (12 tests): token generation (64 hex chars, uniqueness, Secure flag), validation (match/mismatch/missing cookie/empty token/different length/multi-cookie), CsrfError class
  - `brute-force.test.ts` (14 tests): initial allowance, case-insensitivity, 5-attempt lockout, remaining attempts countdown, escalation tiers (15/30/60 min), successful login reset, unlock on success, isAccountLocked, auto-cleanup, lock expiry
  - `input-validator.test.ts` (53 tests): email (valid/invalid formats, length, TLD, dots), password (all requirements, common passwords, strength scoring), URL (http/https, javascript:/data:/ftp: blocking, sanitization), JSON depth (flat/nested/exceeding/custom), phone (Nigerian formats, normalization), ID (UUID/CUID/NanoID), sanitizeObject (strip/sanitize/maxLength)
  - `cors.test.ts` (9 tests): origin validation (configured/unconfigured/whitespace/empty entries), CORS headers (null origin, disallowed, allowed, X-CSRF-Token header)
  - `request-guard.test.ts` (10 tests): no-options passthrough, auth required (allowed/denied), CSRF (missing/valid/GET skip), CORS preflight, rate limiting (pass/limited)

Stage Summary:
- 7 new security modules in src/lib/security/ with barrel export
- Defense-in-depth login protection: in-memory brute-force (escalating) + DB-backed rate limiting + random timing delay
- CSRF double-submit cookie pattern ready for integration
- Enhanced input validation covering emails, passwords, URLs, JSON depth, phone numbers, IDs
- CORS configuration from ALLOWED_ORIGINS env var
- Structured security event logging with severity levels
- Unified route guard reduces API security boilerplate
- 98 tests across 5 test files, all passing
- Build: 0 errors, clean production build

---
Task ID: 13
Agent: Super Z (Sub)
Task: Phase 13 — Monitoring & Observability

Work Log:
- Created `src/lib/monitoring/correlation.ts`: Request correlation ID management — `generateCorrelationId()` (ov-prefixed UUID), `getCorrelationIdFromRequest()` (reads X-Correlation-ID / X-Request-ID), `withCorrelationId()` (returns headers object)
- Created `src/lib/monitoring/error-tracker.ts`: In-memory error tracker (Sentry-swappable design) — `ErrorEvent` interface with id/message/stack/severity/context/tags/fingerprint, `ErrorTracker` class with `capture()`, `getRecent()`, `getByRoute()`, `getStats()` (total/bySeverity/byRoute/topRoutes/lastHour/last24h), `clear()`, auto-trim at 10,000 entries, singleton `errorTracker` export
- Created `src/lib/monitoring/alerting.ts`: Alerting rules engine — `AlertRule` interface with condition function and cooldown, `Alert` interface with acknowledgement/resolution state, `AlertManager` class with `addRule()`, `evaluate()` (cooldown-respecting), `getActiveAlerts()`, `acknowledgeAlert()`, `resolveAlert()`, `getAlertHistory()`, 5 built-in rules registered by default (high 5xx rate, high p95 latency, SLO budget < 30%, DB connection issues, WebSocket disconnect spike), singleton `alertManager` export
- Created `src/lib/monitoring/performance-monitor.ts`: Client-side performance monitoring — `usePerformanceMetrics()` React hook measuring render time via useRef, FCP/LCP/CLS via PerformanceObserver, fire-and-forget POST to /api/metrics, `reportWebVitals()` with cleanup function, `createPerformanceMarker()` for arbitrary code section timing with performance.mark/measure
- Created `src/lib/monitoring/log-aggregator.ts`: Structured JSON logging — `LogEntry` interface, `StructuredLogger` class with info/warn/error/debug methods, `setCorrelationId()` for propagation, `withContext()` for child loggers with bound context fields, metadata merging, singleton `logger` export
- Created `src/lib/monitoring/index.ts`: Barrel export for all monitoring modules
- Enhanced `src/app/api/metrics/route.ts`: Added error tracker stats (total/by severity/by route/last hour/last 24h), alert manager active alerts (total + by severity), external memory gauge in Prometheus text format
- Created `src/app/api/monitoring/alerts/route.ts`: GET endpoint returning active alerts, alert history (last 50), and error stats, requires authentication via getAuthUser
- Created 4 test files (39 tests total, all passing):
  - `correlation.test.ts` (7 tests): generate ID (ov- prefix, uniqueness), get from request (X-Correlation-ID/X-Request-ID/priority/null fallback), withCorrelationId
  - `error-tracker.test.ts` (12 tests): capture string/Error, default/custom severity, context fields, getRecent ordering/limit, getByRoute filter, getStats aggregation, topRoutes sorting, auto-trim, clear
  - `alerting.test.ts` (11 tests): condition false/true, cooldown respected, re-trigger after cooldown, disabled rules, getActiveAlerts, acknowledgeAlert, resolveAlert, history with resolved, multiple independent rules
  - `log-aggregator.test.ts` (9 tests): info/warn/error/debug routing, metadata inclusion, correlationId propagation, withContext binding, child metadata merging

Stage Summary:
- 5 new monitoring modules in src/lib/monitoring/ with barrel export
- Request correlation ID management for distributed tracing
- In-memory error tracker with aggregation stats (Sentry-compatible interface)
- Alerting rules engine with 5 built-in rules, cooldown, acknowledgement, resolution
- Client-side performance monitoring hook and Web Vitals reporting
- Structured JSON logger with child context binding and correlation ID propagation
- Enhanced Prometheus /api/metrics endpoint with error tracker and alert metrics
- New authenticated /api/monitoring/alerts endpoint
- 39 tests across 4 test files, all passing
- Build: 0 errors, clean production build

---
Task ID: 15
Agent: Super Z (Main)
Task: Phase 15 — Integration & Cross-Cutting Wiring

Work Log:
- Created `src/lib/api-handler.ts`: Unified `withApiHandler()` wrapper integrating correlation ID (Phase 13), SRE request logging + SLO tracking (Phase 12), error tracking (Phase 13), structured logging (Phase 13), and active connections gauge. Returns `ApiContext` with correlationId and user to handler.
- Created `src/lib/client-error-reporter.ts`: Fire-and-forget client-to-server error reporting bridge. `reportClientError()` POSTs to /api/metrics. `reportBoundaryError()` extracts error info from React ErrorBoundary.
- Enhanced `src/components/error-boundary.tsx`: Added `name` prop, wired `componentDidCatch` to `reportBoundaryError()` for automatic error tracker integration.
- Enhanced `src/middleware.ts`: Imported correlation ID module, injects `X-Correlation-ID` header on all authenticated API responses.
- Created `src/components/performance-observer.tsx`: Renderless component that mounts PerformanceObservers for navigation/paint/layout-shift timings and reports to /api/metrics.
- Enhanced `src/app/layout.tsx`: Added PerformanceObserver component for automatic Web Vitals collection.
- Enhanced `src/app/api/metrics/route.ts`: Added POST handler accepting `client-error` and `web-vital` payloads from client-side code. Client errors forwarded to error tracker.
- Integrated `withApiHandler` into `src/app/api/agents/route.ts` (GET) and `src/app/api/dashboard/route.ts` (GET) as exemplars.
- Created 2 test files (16 tests, all passing):
  - `api-handler.test.ts` (10 tests): correlation ID propagation, error capture, active connections, SLO recording, production error hiding
  - `client-error-reporter.test.ts` (6 tests): POST payload shape, fetch error handling, boundary error extraction

Stage Summary:
- All Phase 10-14 modules now cross-wired: security, monitoring, SRE, and performance modules work together
- ErrorBoundary automatically reports to error tracker via client bridge
- Middleware injects correlation IDs for distributed tracing
- PerformanceObserver collects Web Vitals at root layout level
- `withApiHandler` provides drop-in observability wrapper for any API route
- /api/metrics accepts client-side error and vital reports
- Build: 0 TS errors, 291/291 tests passing across 17 test suites
