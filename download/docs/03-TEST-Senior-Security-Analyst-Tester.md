# OmniVote Monitor v2.1 — Senior Security Analyst & Tester Guide

**Document ID:** 03-TEST-Security-Analyst
**Version:** 2.1.0
**Classification:** CONFIDENTIAL — Security Testing Only
**Last Updated:** 2025-07-13
**Target:** OmniVote Monitor v2.1 (Next.js 16, Prisma/SQLite, 23 models, 28 API routes, 5 RBAC roles)

---

## 1. Threat Landscape

### 1.1 Why Election Monitoring Platforms Are High-Value Targets

OmniVote Monitor v2.1 is a multi-tenant election observation platform deployed in a high-stakes democratic environment. This makes it a prime target for multiple adversarial classes, each with distinct motivations, capabilities, and attack vectors. Understanding the threat landscape is essential before designing test cases, because the *absence* of authentication and authorization means every threat model is currently exploitable.

| Adversary Class | Motivation | Capability | Primary Targets |
|---|---|---|---|
| **State Actors** (government intelligence services) | Suppress evidence of electoral fraud; maintain regime stability | Nation-state tooling, legal coercion, infrastructure control | Database exfiltration, field agent identification, platform takedown |
| **Political Parties** | Manipulate reported results; deploy counter-narratives; suppress opposition observation | Insiders, hired hackers, social engineering | PVT result manipulation, incident deletion, dashboard poisoning |
| **Hacktivists** | Ideological disruption, public embarrassment, data leaks | Opportunistic exploitation, DDoS, defacement | Public data exposure, denial of service, platform disinformation |
| **Criminal Groups** | Financial gain through data resale, ransomware | Ransomware-as-a-service, phishing campaigns | Voter PII exfiltration (phone numbers, GPS coordinates, biometric profiles) |
| **Insiders** (compromised staff) | Financial incentives, coercion, ideological alignment | Legitimate access + malicious intent | Undetectable data exfiltration, role escalation, audit log manipulation |

### 1.2 Attack Objectives

Attackers targeting OmniVote Monitor pursue one or more of the following objectives:

1. **Suppress Evidence**: Delete or alter incident reports, PVT results, and media evidence before observers can act on anomalies.
2. **Manipulate Results**: Inject false PVT results to create false confidence in election integrity, or generate spurious anomalies to discredit legitimate results.
3. **Compromise Field Agents**: Identify, locate, and intimidate field observers using GPS coordinates, phone numbers, and assignment data stored in the platform.
4. **Deploy Disinformation**: Use legitimate-looking data from the platform to fabricate narratives about electoral fraud or its absence.
5. **Exfiltrate Voter Data**: Extract personally identifiable information (PII) including phone numbers, WhatsApp numbers, biometric profiles, and geolocation data.
6. **Cross-Tenant Data Breach**: Exploit multi-tenant isolation failures to access data belonging to observer organizations that are political opponents.
7. **Platform Availability**: Deny service during critical election periods to prevent real-time monitoring.

### 1.3 Nigeria-Specific Threat Context

- **Government Surveillance**: Nigerian government agencies (including those under previous administrations) have demonstrated willingness to surveil civil society organizations. The National Intelligence Agency (NIA) and Department of State Services (DSS) have capabilities to intercept communications and compel data disclosure.
- **Political Interference**: Election periods in Nigeria see intensified efforts by political actors to compromise observation efforts. The platform's multi-tenant design means a compromise of one organization's data could affect the perceived integrity of the entire election.
- **Infrastructure Attacks**: Nigeria's internet infrastructure faces regular disruptions. During elections, coordinated ISP-level throttling or DNS manipulation is a documented risk. The platform must function under degraded network conditions.
- **Legal Environment**: Nigeria's Cybercrimes Act 2015 and the Data Protection Regulation 2019 impose obligations on data handlers. A data breach could result in legal liability for the platform operator and participating organizations.

---

## 2. Current Security Posture Assessment (CRITICAL GAPS)

### 2.1 Authentication & Authorization — [CRITICAL]

This is the single most severe category of vulnerability in the current codebase. The platform has **no real authentication or authorization whatsoever**.

**Findings:**

- **No Password Verification**: The login flow accepts an email address only. There is no password field, no credential check, no identity verification of any kind. Any person who knows (or guesses) a registered email address can "log in" as that user.
- **No JWT or Session Tokens**: There is no JSON Web Token generation, no session cookie, no server-side session store. Authentication state is maintained exclusively in the browser via Zustand (a React state management library). This means the server has zero knowledge of who is making requests.
- **No Middleware Protection**: Next.js middleware is either absent or does not perform any authentication checks. All 28 API routes are publicly accessible to any HTTP client — curl, Postman, browser, script — with no credentials required.
- **No RBAC Enforcement on Backend**: The application defines 5 RBAC roles (`SUPER_ADMIN`, `ADMIN`, `ANALYST`, `FIELD_AGENT`, `VIEWER`) and implements role-based sidebar visibility in the frontend. However, the backend performs no role checks. Any client can pass any `tenantId` and receive data for that tenant regardless of their role.
- **Impact Assessment**: An unauthenticated attacker can: read all incidents across all tenants, modify or delete any record, create fake users, escalate privileges, and access administrative functions. The entire platform is currently an open API.

### 2.2 API Security — [CRITICAL]

| Check | Status | Detail |
|---|---|---|
| Rate Limiting | **MISSING** | No rate limiting on any endpoint. An attacker can submit thousands of requests per second. |
| Input Sanitization | **PARTIAL** | Zod validation exists on some endpoints (results submission). Many endpoints accept arbitrary JSON. |
| CORS Configuration | **DEFAULT** | Next.js default CORS allows all origins. No restrictive policy configured. |
| Request Signing / HMAC | **MISSING** | No request integrity verification. Requests can be tampered with in transit (even over HTTPS, if MITM is possible). |
| Tenant ID Exposure | **VULNERABLE** | `tenantId` is passed as a query parameter. CUID format is somewhat predictable; enumeration is trivial via the unauthenticated `/api/tenants` GET endpoint. |
| API Audit Trail | **INCOMPLETE** | `AuditLog` model exists and covers some user actions, but there is no systematic API access logging. Unauthorized access attempts are not recorded. |
| Request Size Limits | **MISSING** | No maximum request body size enforcement at the API layer. |
| API Versioning | **MISSING** | All endpoints are unversioned, making future security patches harder to deploy without breaking clients. |

### 2.3 Data Security — [HIGH]

- **SQLite Database — No Encryption at Rest**: The entire database is stored in a single SQLite file with no encryption. The platform UI references "AES-256 encryption," but this claim is false — there is no encryption implementation in the codebase. Anyone with file-system access can read all data, including PII.
- **No Field-Level Encryption**: Sensitive fields are stored in plaintext:
  - Phone numbers (agent contacts, voter hotlines)
  - Email addresses
  - GPS coordinates (polling unit locations, agent real-time positions)
  - WhatsApp JIDs (used for two-factor authentication and agent communication)
  - Biometric profiles (stored as plaintext JSON objects)
- **Two-Factor Secrets in Plaintext**: The `twoFactorSecret` field in the Agent model stores TOTP secrets as plaintext strings. If the database is compromised, all agents' 2FA can be replicated by the attacker.
- **Media Handling**: Currently media is URL-only (no file upload endpoints exist yet), but URLs to external storage (e.g., S3) may be accessible without authentication.

### 2.4 Session Management — [CRITICAL]

- **No Session Tokens**: No token of any kind is issued upon "login." The client simply stores the user object in Zustand state.
- **No Server-Side Session Expiry**: Since there is no server-side session, there is no expiry mechanism. A captured Zustand state would provide indefinite access (until the next browser refresh, at which point it is lost entirely).
- **No Device Fingerprinting**: No mechanism to detect or prevent sessions from unrecognized devices.
- **No Concurrent Session Control**: A user can "log in" from unlimited devices simultaneously, with no notification or revocation capability.
- **No Logout**: There is no server-side logout because there is no server-side session. Client-side state is cleared on browser refresh.

### 2.5 Input Validation — [MEDIUM]

- **Zod Usage**: Zod schemas are used on a subset of endpoints, primarily the results submission flow. This is good practice but insufficient.
- **Unvalidated Endpoints**: Many POST/PUT/PATCH endpoints accept arbitrary JSON bodies without schema validation. This creates mass-assignment and injection risks.
- **SQL Injection**: Prisma ORM uses parameterized queries, which provides strong protection against SQL injection. However, this should still be verified through testing, particularly if any raw SQL queries are introduced in the future.
- **JSON Injection**: Since the API accepts arbitrary JSON, there is a risk of JSON injection where malicious objects in request bodies could cause unexpected behavior in downstream processing.
- **File Uploads**: No file upload endpoints currently exist (media is URL-based). When file uploads are implemented, they will require additional validation (file type, size, content scanning).

### 2.6 Dependencies — [MEDIUM]

- **Package Count**: 40+ npm packages including many Radix UI primitives.
- **Dead Dependency — next-auth v4.24.11**: Listed in `package.json` but **not imported or used anywhere in the codebase**. This is a dead dependency that increases attack surface and may cause confusion during security audits. It should be removed or properly integrated.
- **Sharp**: Image processing library with a known CVE history. Current version should be verified against NVD.
- **No npm Audit Baseline**: No `npm audit` baseline has been established. There is no CI/CD gate blocking builds with known vulnerable dependencies.
- **No SRI (Subresource Integrity)**: CDN-hosted assets (if any) lack integrity verification.

---

## 3. Security Testing Methodology

### 3.1 Reconnaissance

The first phase maps the full attack surface. Because all APIs are unauthenticated, reconnaissance is trivially easy — which is itself a critical finding.

1. **Endpoint Enumeration**: Use automated tools and manual browsing to catalog all 28 API routes. Document HTTP methods, query parameters, and request/response schemas.
2. **Tenant CUID Mapping**: Send `GET /api/tenants` (no auth required) to obtain all tenant IDs. CUID format (`cuid2`) provides limited entropy — test whether sequential or predictable IDs can be generated.
3. **User CUID Mapping**: Send `GET /api/auth` or equivalent user listing endpoints to obtain all user CUIDs.
4. **Parameter Fuzzing**: Submit unexpected query parameters to each endpoint to discover hidden functionality or debug information leakage.
5. **Technology Fingerprinting**: Identify exact versions of Next.js, Node.js, Prisma, SQLite, and all major dependencies from HTTP headers and response patterns.

### 3.2 Authentication Testing

| Test | Method | Expected (Secure) Result | Current (Insecure) Result |
|---|---|---|---|
| Unauthenticated API access | `curl https://host/api/incidents` with no headers | 401/403 Forbidden | **200 OK — returns all incidents** |
| Cross-tenant data access | Set `tenantId=B` while logged in as tenant A user | 403 Forbidden | **200 OK — returns tenant B's data** |
| Role escalation to SUPER_ADMIN | Send request with `role=SUPER_ADMIN` in body | 403 Forbidden | **Accepted — role is client-controlled** |
| Session persistence | Login, close browser, reopen, attempt action | Session restored or re-auth required | **Session lost — no server-side persistence** |
| Concurrent sessions | Login from Browser A and Browser B simultaneously | Only one active, or both with notification | **Both work independently with no limit** |
| Brute-force login | Attempt 1000 different emails in 60 seconds | Rate-limited after N attempts | **No rate limit — all attempts succeed** |

### 3.3 Authorization Testing (RBAC Bypass)

Test each of the 5 roles (`SUPER_ADMIN`, `ADMIN`, `ANALYST`, `FIELD_AGENT`, `VIEWER`) against all 21 frontend tabs and corresponding API endpoints.

**Critical test scenarios:**

1. **FIELD_AGENT accessing admin endpoints**: `GET /api/tenants`, `POST /api/agents`, `DELETE /api/agents/{id}` — a field agent should have zero access to these. Currently, all succeed.
2. **FIELD_AGENT deleting other users**: `DELETE /api/agents/{otherAgentId}` — should be forbidden. Currently succeeds.
3. **Cross-tenant incident access**: User from Tenant A sends `GET /api/incidents?tenantId=TenantB_CUID` — should return 403. Currently returns Tenant B's incidents.
4. **Role escalation via API**: `PATCH /api/agents?id={self}&action=CHANGE_ROLE&role=SUPER_ADMIN` — should be forbidden. Currently, the role field is accepted from the client without server-side verification.
5. **VIEWER attempting write operations**: A read-only user sends `POST /api/incidents` — should return 403. Currently succeeds.
6. **ANALYST accessing biometric data**: Analyst role sends `GET /api/agents?includeBiometric=true` — should be restricted based on data sensitivity policies. Currently returns biometric profiles.

### 3.4 API Security Testing

1. **Rate Limiting Verification**:
   - Send 1,000 requests per second to `POST /api/incidents` using `ab` (Apache Bench) or custom script.
   - Send 500 concurrent requests to `GET /api/dashboard` to test server stability.
   - **Expected**: 429 Too Many Requests after threshold. **Current**: All requests processed.

2. **SQL Injection Testing**:
   - Submit payloads like `' OR 1=1 --`, `'; DROP TABLE agents; --`, and union-based injection in all string parameters.
   - **Expected**: Prisma parameterization prevents execution. **Verify**: No errors, no data leakage, no schema changes.

3. **Mass Assignment Testing**:
   - Submit POST/PUT requests with additional fields not in the documented schema: `{"role": "SUPER_ADMIN", "tenantId": "...", "isVerified": true}`.
   - **Expected**: Extra fields are ignored. **Current**: Likely accepted and persisted.

4. **CUID Enumeration**:
   - Generate sequential/adjacent CUIDs and attempt to access resources.
   - Test: `GET /api/incidents/{adjacentCuid}`, `GET /api/agents/{adjacentCuid}`.
   - **Expected**: 404 or 403 for unauthorized access. **Current**: Returns data if CUID matches any record.

5. **Large Payload Testing**:
   - Send 10MB, 50MB, and 100MB JSON bodies to each POST endpoint.
   - Send payloads with deeply nested objects (100+ levels deep).
   - **Expected**: 413 Payload Too Large or request timeout. **Current**: No size limit — may cause OOM or server crash.

6. **HTTP Method Testing**:
   - Send OPTIONS, PUT, PATCH, DELETE to GET-only endpoints.
   - Send GET to POST-only endpoints.
   - **Expected**: 405 Method Not Allowed. **Current**: Depends on individual route implementation.

### 3.5 Data Security Testing

1. **Database File Access**:
   - Attempt to access the SQLite database file directly via web server (e.g., `/prisma/dev.db`).
   - Attempt path traversal: `/../../../prisma/dev.db`.
   - Attempt to download database backup files if backup procedures exist.

2. **PII Exposure in API Responses**:
   - Inspect all GET response bodies for: phone numbers, email addresses, GPS coordinates, WhatsApp JIDs, biometric data.
   - Test: Does `GET /api/agents` return full phone numbers or should they be masked (e.g., `+234***1234`)?
   - Test: Does `GET /api/incidents` include reporter contact details unnecessarily?

3. **Sensitive Data in Server Logs**:
   - Submit requests containing PII and check server logs (`console.log`, `console.error`, framework-level logging).
   - Verify that `console.error` statements in production code do not log request bodies or sensitive fields.

4. **Error Message Information Leakage**:
   - Submit malformed requests and analyze error responses.
   - **Expected**: Generic error messages (e.g., "Invalid request"). **Current**: May expose Prisma error details, stack traces, or database schema information.

5. **Two-Factor Secret Exposure**:
   - Check if `GET /api/agents` returns the `twoFactorSecret` field.
   - If it does, any unauthenticated user can retrieve all agents' TOTP secrets and generate valid 2FA codes.

### 3.6 Business Logic Testing

1. **PVT (Parallel Vote Tabulation) Manipulation**:
   - Submit PVT results for a polling unit with impossible values (e.g., 500% turnout, negative numbers).
   - Submit conflicting PVT results from multiple "observers" for the same polling unit.
   - **Goal**: Determine if the anomaly detection system can be poisoned with fake data.

2. **Alert Flooding**:
   - Create 1,000+ alerts via `POST /api/incidents` in rapid succession.
   - Test: Does the dashboard become unusable? Are legitimate alerts buried? Does the notification system (WhatsApp/email) get overwhelmed?

3. **Dead-Man's Switch Abuse**:
   - Trigger the dead-man's switch for all agents simultaneously.
   - Test: Does this cause a system-wide emergency response? Can it be used to create a false crisis?

4. **Evidence Integrity**:
   - Examine C2PA (Coalition for Content Provenance and Authenticity) signature validation.
   - Test: Can a forged media URL be submitted as evidence? Is the C2PA verification actually performed server-side?

5. **Honeypot Detection**:
   - Analyze API responses to determine if any fields or patterns reveal which polling units are designated as honeypots.
   - If an attacker can identify honeypots, they can avoid triggering them while manipulating real polling units.

### 3.7 WhatsApp Integration Testing

1. **WhatsApp Bridge Authentication**:
   - The WhatsApp bridge runs on port 9090.
   - Test: Is the bridge endpoint authenticated? Can any client send messages through it?
   - Test: Can an external attacker connect to port 9090 and send arbitrary WhatsApp messages?

2. **QR Code Interception**:
   - When a new WhatsApp session is established via QR code, test if the QR code can be intercepted or replayed.
   - Test: Can a second device scan the same QR code to hijack the session?

3. **Message Interception**:
   - Test if agent WhatsApp messages (reports, alerts) pass through the server in plaintext.
   - Check if message content is logged anywhere accessible via the API.

4. **Template Injection**:
   - WhatsApp message templates may contain variables (e.g., agent name, polling unit code).
   - Test: Can template variables be abused to inject arbitrary content into messages sent to other agents?

---

## 4. Vulnerability Classification

### 4.1 Critical — Fix Immediately (Before Any Deployment)

| # | Vulnerability | CVSS Estimate | Business Impact |
|---|---|---|---|
| C1 | No authentication on any API endpoint | 10.0 | Complete platform compromise |
| C2 | No RBAC enforcement on backend | 9.8 | Privilege escalation, unauthorized actions |
| C3 | No multi-tenant data isolation | 9.1 | Cross-org data breach, observer safety compromise |
| C4 | No encryption at rest (despite UI claims) | 8.5 | Full database exfiltration from file access |
| C5 | Two-factor secrets stored in plaintext | 9.4 | 2FA bypass for all agents |

### 4.2 High — Fix Before Production Deployment

| # | Vulnerability | CVSS Estimate | Business Impact |
|---|---|---|---|
| H1 | No rate limiting on any endpoint | 7.5 | DoS, brute-force, data flooding |
| H2 | No session management | 7.8 | Session hijacking, no logout, no expiry |
| H3 | No audit logging for API access | 6.5 | Undetected breaches, no forensic trail |
| H4 | WhatsApp bridge unauthenticated | 8.0 | Unauthorized message sending, agent impersonation |
| H5 | Biometric data stored unencrypted | 8.7 | Biometric data exfiltration (irreversible compromise) |

### 4.3 Medium — Fix Before Scaling to Multiple Elections

| # | Vulnerability | CVSS Estimate | Business Impact |
|---|---|---|---|
| M1 | No input validation on many endpoints | 6.1 | Injection, unexpected behavior |
| M2 | Dead dependency (next-auth unused) | 3.7 | Increased attack surface, confusion |
| M3 | No Content-Security-Policy headers | 5.4 | XSS vectors |
| M4 | No HSTS headers | 4.2 | Downgrade attacks |
| M5 | No request size limits | 5.3 | DoS via large payloads |

### 4.4 Low — Fix When Possible

| # | Vulnerability | CVSS Estimate | Business Impact |
|---|---|---|---|
| L1 | `console.error` statements in production code | 2.4 | Information leakage in logs |
| L2 | No API versioning | 2.0 | Breaking change risk |
| L3 | No request ID tracking | 1.5 | Debugging difficulty |
| L4 | No health check standardization | 1.0 | Monitoring gaps |

---

## 5. Recommended Security Testing Tools

| Tool | Purpose | Usage in This Context |
|---|---|---|
| **OWASP ZAP** | Automated vulnerability scanning | Full endpoint scan against all 28 API routes |
| **Burp Suite Professional** | Manual penetration testing | Intercept and modify API requests, test RBAC bypass |
| **sqlmap** | SQL injection testing | Verify Prisma parameterization is effective |
| **nikto** | Web server misconfiguration scanning | Check headers, default configs, directory listing |
| **jwt-cracker** | JWT security testing | For when JWT authentication is implemented — verify key strength |
| **wfuzz** | API fuzzing | Brute-force CUIDs, fuzz parameters, rate limit testing |
| **nuclei** | Template-based vulnerability scanning | Run known CVE templates against the platform |
| **Postman / Newman** | API test automation | Automate the 30+ test cases in Section 6 |
| **k6 / Artillery** | Load and stress testing | Verify behavior under high request volume |
| **SQLite3 CLI** | Database security inspection | Direct database access test, verify no encryption |

---

## 6. Test Cases (Prioritized)

### Authentication & Authorization Tests

| ID | Category | Description | Steps | Expected Result | Current Result | Severity |
|---|---|---|---|---|---|---|
| SEC-001 | Auth | Unauthenticated API access | `curl -X GET /api/incidents` with no headers | 401 Unauthorized | 200 OK with all data | Critical |
| SEC-002 | Auth | Unauthenticated write | `curl -X POST /api/incidents -d '{"title":"test"}'` | 401 Unauthorized | 201 Created | Critical |
| SEC-003 | Auth | Email-only login | Enter any registered email, no password | Should require password | Login succeeds | Critical |
| SEC-004 | Auth | Unregistered email login | Enter non-existent email | Should reject | Creates user or returns error with user list | Critical |
| SEC-005 | Auth | Session after refresh | Login, close all tabs, reopen, navigate | Session restored | Session lost (Zustand cleared) | Critical |
| SEC-006 | Auth | Concurrent sessions | Login from Firefox and Chrome simultaneously | Limit or notify | Both sessions active independently | High |
| SEC-007 | RBAC | FIELD_AGENT lists tenants | Login as FIELD_AGENT, `GET /api/tenants` | 403 Forbidden | 200 OK with all tenants | Critical |
| SEC-008 | RBAC | FIELD_AGENT creates admin | Login as FIELD_AGENT, `POST /api/agents` with admin role | 403 Forbidden | Agent created with ADMIN role | Critical |
| SEC-009 | RBAC | FIELD_AGENT deletes user | Login as FIELD_AGENT, `DELETE /api/agents/{adminId}` | 403 Forbidden | User deleted | Critical |
| SEC-010 | RBAC | Cross-tenant incident read | Tenant A user, `GET /api/incidents?tenantId=TenantB` | 403 Forbidden | Returns Tenant B incidents | Critical |
| SEC-011 | RBAC | Cross-tenant incident write | Tenant A user, `POST /api/incidents` with tenantId=TenantB | 403 Forbidden | Incident created in Tenant B | Critical |
| SEC-012 | RBAC | Role self-escalation | `PATCH /api/agents?id={self}&action=CHANGE_ROLE&role=SUPER_ADMIN` | 403 Forbidden | Role changed to SUPER_ADMIN | Critical |
| SEC-013 | RBAC | VIEWER write attempt | Login as VIEWER, `POST /api/incidents` | 403 Forbidden | Incident created | Critical |

### API Security Tests

| ID | Category | Description | Steps | Expected Result | Current Result | Severity |
|---|---|---|---|---|---|---|
| SEC-014 | API | Rate limit — incidents | 1000 POST /api/incidents in 10 seconds | 429 after N requests | All processed | High |
| SEC-015 | API | Rate limit — auth | 100 login attempts in 60 seconds | 429 after 5-10 attempts | All processed | High |
| SEC-016 | API | SQL injection — search | `GET /api/incidents?search=' OR 1=1 --` | No data leakage, no error | Prisma blocks (verify) | Medium |
| SEC-017 | API | SQL injection — id param | `GET /api/incidents/cuid' DROP TABLE agents --` | 404 or 400, no schema change | Prisma blocks (verify) | Medium |
| SEC-018 | API | Mass assignment | POST /api/agents with extra field `{"isAdmin": true, "tenantOwner": true}` | Extra fields ignored | Extra fields persisted | High |
| SEC-019 | API | Large payload | POST /api/incidents with 50MB JSON body | 413 Payload Too Large | Accepted or server crash | Medium |
| SEC-020 | API | Deep nesting | POST with 200-level nested JSON object | 400 Bad Request or truncated | Accepted, potential stack overflow | Medium |
| SEC-021 | API | CUID enumeration | GET /api/agents/{cuid-1}, /{cuid-2}... adjacent IDs | 404 for non-existent | 404 (acceptable if no info leak) | Low |
| SEC-022 | API | Wrong HTTP method | PUT to GET-only /api/dashboard | 405 Method Not Allowed | Depends on route | Low |
| SEC-023 | API | CORS origin check | Fetch from `http://evil.com` to API | Blocked by CORS | Allowed (Next.js default) | Medium |

### Data Security Tests

| ID | Category | Description | Steps | Expected Result | Current Result | Severity |
|---|---|---|---|---|---|---|
| SEC-024 | Data | PII in agent list | `GET /api/agents`, inspect response | Phones/emails masked | Full PII in plaintext | High |
| SEC-025 | Data | PII in incident list | `GET /api/incidents`, check reporter fields | Contact info masked or omitted | Full contact details visible | High |
| SEC-026 | Data | 2FA secret exposure | `GET /api/agents`, check for twoFactorSecret | Field omitted or encrypted | Plaintext TOTP secret | Critical |
| SEC-027 | Data | Biometric data exposure | `GET /api/agents?includeBiometric=true` | Restricted to authorized roles only | Full biometric JSON returned | High |
| SEC-028 | Data | Database file access | `curl http://host/prisma/dev.db` | 403 or 404 | May be downloadable (test) | Critical |
| SEC-029 | Data | GPS coordinate exposure | `GET /api/polling-units`, check coordinates | Coordinates restricted/perturbed | Exact lat/long in plaintext | High |
| SEC-030 | Data | Error information leakage | Send malformed JSON to POST /api/incidents | Generic error message | May include Prisma/stack details | Medium |

### Business Logic Tests

| ID | Category | Description | Steps | Expected Result | Current Result | Severity |
|---|---|---|---|---|---|---|
| SEC-031 | Logic | PVT result poisoning | Submit 50 fake PVT results for one PU | Anomaly flagged, fake data isolated | Results accepted and aggregated | High |
| SEC-032 | Logic | Alert flood | Create 1000 incidents via API in 1 minute | Rate-limited, bulk creation blocked | All created, dashboard overwhelmed | High |
| SEC-033 | Logic | Dead-man's switch spam | Trigger dead-man's switch for all agents | Cooldown, verification required | All triggers processed simultaneously | High |
| SEC-034 | Logic | Evidence URL forgery | Submit incident with `evidence: "https://evil.com/fake.jpg"` | URL validated against allowed domains | Any URL accepted | Medium |
| SEC-035 | Logic | Honeypot identification | Compare API responses for known vs unknown PUs | No distinguishable difference | May have identifiable patterns (test) | Medium |

---

## 7. Remediation Priority Matrix

The following matrix maps each vulnerability to effort, impact, and recommended priority order. Remediation should follow this sequence to maximize security improvement per unit of engineering effort.

| Priority | Vulnerability | Effort | Impact | Rationale |
|---|---|---|---|---|
| **1** | C1: Implement authentication (JWT + password) | High | Critical | Foundation for all other security controls. Without this, nothing else matters. |
| **2** | C2: Backend RBAC enforcement | Medium | Critical | Requires authentication (Priority 1). Add middleware that validates JWT and checks role against route requirements. |
| **3** | C3: Multi-tenant isolation | Medium | Critical | Add tenant_id validation in middleware. Ensure every query filters by authenticated user's tenant. |
| **4** | H2: Session management | Medium | High | Implement server-side sessions with expiry, device tracking, and revocation. Pair with JWT refresh tokens. |
| **5** | H1: Rate limiting | Low | High | Add rate limiting middleware (e.g., `@upstash/ratelimit` or custom). Quick win with significant impact. |
| **6** | C5: Encrypt 2FA secrets | Low | Critical | Use AES-256-GCM to encrypt `twoFactorSecret` at rest. Decrypt only when generating TOTP codes. |
| **7** | C4: Encryption at rest | High | Critical | Migrate from SQLite to PostgreSQL with TDE, or implement application-layer encryption for sensitive fields. |
| **8** | H5: Encrypt biometric data | Medium | High | Same approach as 2FA secrets. Biometric data is irreversible — compromise is permanent. |
| **9** | H4: WhatsApp bridge auth | Low | High | Add API key or JWT validation to the port 9090 bridge. Simple middleware addition. |
| **10** | H3: API audit logging | Medium | High | Implement middleware that logs all API access (user, endpoint, timestamp, IP). Store in separate audit table. |
| **11** | M1: Input validation (all endpoints) | Medium | Medium | Extend Zod schemas to all endpoints. Add a validation middleware layer. |
| **12** | M3: CSP headers | Low | Medium | Add `Content-Security-Policy` header in `next.config.js`. Quick configuration change. |
| **13** | M4: HSTS headers | Low | Medium | Add `Strict-Transport-Security` header. One-line config change. |
| **14** | M5: Request size limits | Low | Medium | Configure `bodyParser.sizeLimit` in Next.js API routes. |
| **15** | SEC-018: Mass assignment protection | Low | High | Use Prisma's `select`/`omit` or a DTO layer to whitelist fields on write operations. |
| **16** | M2: Remove dead dependency (next-auth) | Low | Low | `npm uninstall next-auth` and verify no imports break. |
| **17** | SEC-024/025: PII masking in API responses | Medium | High | Implement field-level masking for phone numbers and emails in GET responses. |
| **18** | L1: Remove console.error from production | Low | Low | Replace with proper logging library (e.g., pino) configured for production. |
| **19** | L2: API versioning | Medium | Low | Add `/api/v1/` prefix to all routes. Implement version routing. |
| **20** | L3/L4: Request ID and health checks | Low | Low | Add `x-request-id` header generation. Standardize `/api/health` endpoint. |

---

## 8. Test Execution Guidelines

### 8.1 Environment Requirements

- **Test Environment**: Dedicated staging environment that mirrors production architecture.
- **Database**: Copy of production schema with anonymized test data (never use production data for testing).
- **Tools**: All tools listed in Section 5 installed and configured.
- **Network**: Isolated test network to prevent accidental impact on production systems.

### 8.2 Pre-Test Checklist

- [ ] Backup current database state
- [ ] Confirm test environment is isolated from production
- [ ] Configure test tooling (ZAP, Burp Suite, etc.)
- [ ] Prepare test data (multiple tenants, multiple roles, sample incidents)
- [ ] Enable verbose server logging to capture all requests
- [ ] Set up traffic interception (Burp Suite proxy)

### 8.3 Reporting Format

Each test case result must include:
1. **Test ID** (from Section 6)
2. **Execution timestamp**
3. **Actual result** (pass/fail/partial)
4. **Evidence** (screenshot, curl output, log excerpt)
5. **Reproducibility** (consistent/intermittent)
6. **Severity confirmation** (maintain or adjust from initial classification)
7. **Recommended fix** (specific code changes)

### 8.4 Post-Test Actions

- Compile all findings into a vulnerability report
- Classify findings by severity using the matrix in Section 4
- Create Jira/ticket entries for each finding with reproduction steps
- Prioritize remediation using the matrix in Section 7
- Schedule re-test after each critical/high fix is deployed
- Update this document with new findings and test results

---

## 9. Compliance Considerations

### 9.1 Nigeria Data Protection Regulation (NDPR) 2019

- **Consent**: The platform must obtain and record explicit consent for processing personal data.
- **Data Minimization**: API responses should return only the minimum data required for each function.
- **Breach Notification**: Under NDPR, data breaches must be reported within 72 hours. The current lack of audit logging makes breach detection nearly impossible.

### 9.2 NITDA Guidelines

- The National Information Technology Development Agency (NITDA) requires data controllers to implement "appropriate technical and organizational measures" to protect personal data. The current posture (no authentication, no encryption) falls far short of this requirement.

### 9.3 International Standards

- **OWASP Top 10 (2021)**: The platform currently fails at minimum A01 (Broken Access Control), A02 (Cryptographic Failures), A04 (Insecure Design), A05 (Security Misconfiguration), A07 (Identification and Authentication Failures).
- **ISO 27001**: Multiple controls are not met, particularly access control (A.9), cryptography (A.10), and communications security (A.13).

---

## Appendix A: Quick-Start Exploit Demonstration

**WARNING**: The following demonstrates how trivially the current platform can be compromised. Use ONLY in isolated test environments.

```bash
# Step 1: Enumerate all tenants (no auth required)
curl -s https://omnivote.example.com/api/tenants | jq '.[].id'

# Step 2: Enumerate all agents (no auth required)
curl -s https://omnivote.example.com/api/agents | jq '.[].twoFactorSecret'

# Step 3: Read all incidents from a target tenant
curl -s "https://omnivote.example.com/api/incidents?tenantId=TENANT_CUID_HERE"

# Step 4: Delete an incident
curl -X DELETE "https://omnivote.example.com/api/incidents/INCIDENT_CUID_HERE"

# Step 5: Create a fake admin user
curl -X POST https://omnivote.example.com/api/agents \
  -H "Content-Type: application/json" \
  -d '{"email":"attacker@evil.com","role":"SUPER_ADMIN","tenantId":"TARGET_TENANT"}'

# Step 6: Flood the system with fake incidents
for i in $(seq 1 1000); do
  curl -s -X POST https://omnivote.example.com/api/incidents \
    -H "Content-Type: application/json" \
    -d "{\"title\":\"Fake incident $i\",\"tenantId\":\"TARGET_TENANT\"}" &
done
```

**Total time to full platform compromise: under 60 seconds.**

---

*This document is a living artifact. Update test results, new findings, and remediation progress as the security posture evolves. All testing must comply with applicable laws and organizational policies. Unauthorized testing against production systems is strictly prohibited.*