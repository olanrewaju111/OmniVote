# 04 — Security Specialist Guide

## OmniVote Monitor v2.1 — Security Architecture & Implementation

**Version:** 2.1
**Classification:** Internal — Security Team
**Last Updated:** 2025-07-13
**Owner:** Security Specialist

---

## Executive Summary

OmniVote Monitor v2.1 is a multi-tenant election monitoring platform. The current codebase presents a **critical security posture gap**: the UI advertises "Zero-Trust Architecture" and "AES-256 Encryption," yet **none of these controls are implemented**. Authentication is email-only with no password verification. Authorization is performed exclusively on the client side. Sensitive PII (phone numbers, WhatsApp JIDs, biometric profiles) is stored in plaintext in an unencrypted SQLite database. This document defines the target security architecture, a phased implementation plan, and all technical specifications required to bring the platform from its current cosmetic-only security posture to a production-grade, audit-ready state.

---

## 1. Security Architecture Design (Target State)

### 1.1 Zero-Trust Architecture

The platform must adopt a true zero-trust model. The core principle — **never trust, always verify** — applies to every single request, regardless of network origin or prior authentication state.

| Principle | Implementation |
|---|---|
| **Per-request identity verification** | Every API request must carry a valid JWT. Middleware validates the token, checks expiry, verifies the signature against the RSA-2048 public key, and confirms the `jti` (token ID) has not been revoked. No request is served without a verified identity. |
| **Device trust scoring** | The existing `deviceFingerprint` field in the Session model is currently stored but never enforced. The target state computes a composite trust score based on device fingerprint consistency, geographic anomaly detection, and session age. Low-trust sessions trigger step-up authentication (re-enter password or TOTP) before sensitive operations. |
| **Continuous verification** | Sensitive operations (data export, user management, evidence deletion, PVT result submission) require re-authentication even within an active session. A 15-minute access token expiry forces regular token refresh, which itself validates that the session and device are still authorized. |
| **Least privilege** | Each of the five roles (SUPER_ADMIN, TRUST_SAFETY, CAMPAIGN_ADMIN, FIELD_OBSERVER, SYSTEM) can access only the resources explicitly mapped to its permission set. There are no wildcard permissions. Every API route has an explicit allow-list of roles. |

### 1.2 Authentication System Design

The current login flow accepts an email address and immediately grants access — there is no password check, no token issuance, and no session management. The replacement system is designed as follows:

**Credential Providers:**
- **Primary:** Email + password (bcrypt-hashed with cost factor 12 + server-side pepper).
- **Optional second factor:** TOTP (Time-based One-Time Password) via the `twoFactorSecret` field already modeled on User.
- **Future:** WebAuthn/passkey support (out of scope for Phase 1–3 but architecturally anticipated).

**NextAuth.js v5 Integration:**
- NextAuth.js is already listed in `package.json` but completely unused. It will be configured with a custom Credentials provider that validates against the User table.
- JWT access tokens with **15-minute expiry** are issued on successful authentication and stored in HTTP-only, Secure, SameSite=Strict cookies — never in localStorage.
- Refresh tokens with **7-day expiry** are stored server-side (database) and issued as a separate HTTP-only cookie. Refresh token rotation occurs on every use; old refresh tokens are immediately invalidated.
- The `deviceFingerprint` is captured on login via a client-side hash of `navigator.userAgent + screen resolution + timezone + canvas fingerprint` and bound to the session. If the fingerprint differs from the session record, the user is prompted for re-authentication.
- The existing `isLocked` field on User is enforced: after **5 consecutive failed login attempts**, the account is locked for 30 minutes. An exponential backoff increases the lockout duration for repeated lockouts (30min → 1hr → 4hr → 24hr → permanent until admin unlock).
- **Concurrent session control**: A maximum of 3 active sessions per user. On the 4th login, the oldest session is revoked. Users can view and manually revoke sessions from a "Security" settings page.

### 1.3 Authorization Architecture

**Backend RBAC Middleware (`middleware.ts`):**
A Next.js middleware layer intercepts every request to `/api/*` and `/dashboard/*`. It performs the following checks in order:

1. **Token presence** — Reject requests without a valid session cookie (401).
2. **Token validity** — Verify JWT signature, expiry, and revocation status (401).
3. **Route-role mapping** — Look up the requested route in the permission matrix. If the user's role is not in the allow-list, reject (403).
4. **Tenant isolation** — Extract `tenantId` from the JWT payload. For any request that includes a tenant-scoped resource (e.g., `/api/elections/:electionId` where the election belongs to a tenant), verify the JWT `tenantId` matches the resource's tenant. A SUPER_ADMIN may bypass tenant isolation; all other roles are strictly confined (403 on mismatch).
5. **Field-level permissions** — Certain API responses are filtered before being sent. For example, the `biometricProfile` and `twoFactorSecret` fields are stripped from all responses unless the requester has the TRUST_SAFETY role. The `phone` and `whatsappJid` fields are visible only to the data owner and TRUST_SAFETY/SUPER_ADMIN roles.

**Permission Matrix:**

The full matrix covers 28 API endpoints across 5 roles, producing 140 individual permission rules. Below is a representative sample; the full matrix is maintained in `src/config/permissions.ts`.

| Endpoint | SUPER_ADMIN | TRUST_SAFETY | CAMPAIGN_ADMIN | FIELD_OBSERVER | SYSTEM |
|---|:---:|:---:|:---:|:---:|:---:|
| `POST /api/auth/login` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /api/users` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `GET /api/users/[id]` | ✅ | ✅ | ❌ | Own only | ❌ |
| `POST /api/elections` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `DELETE /api/evidence/[id]` | ✅ | ✅ | Own tenant | ❌ | ❌ |
| `POST /api/pvt/submit` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `GET /api/audit/logs` | ✅ | ✅ | ❌ | ❌ | ❌ |

### 1.4 Data Encryption

**Encryption at Rest:**
The current SQLite database stores all data unencrypted on the filesystem. The migration plan (Phase 3) moves to PostgreSQL. In the interim, filesystem-level encryption via LUKS (Linux Unified Key Setup) is applied to the data volume. Post-migration, PostgreSQL Transparent Data Encryption (TDE) or filesystem-level encryption continues to protect data at rest. Encryption keys are managed externally via HashiCorp Vault or AWS KMS — never stored in application code, environment files, or the database itself.

**Encryption in Transit:**
- HTTPS is enforced on all endpoints. HTTP requests are redirected with a 301 to the HTTPS equivalent.
- `Strict-Transport-Security` header with `max-age=31536000; includeSubDomains; preload` is set on every response.
- TLS 1.2 minimum; TLS 1.3 preferred. Weak cipher suites are disabled.

**Field-Level Encryption:**
The following fields are encrypted at the application layer before being written to the database:

| Field | Rationale |
|---|---|
| `phone` | Personally Identifiable Information (PII) |
| `email` | PII |
| `whatsappJid` | PII + messaging identifier |
| `biometricProfile` | Highly sensitive biometric data |
| `twoFactorSecret` | TOTP secret — direct access enables account takeover |

Algorithm: **AES-256-GCM**. Key derivation uses **HKDF-SHA256** with a tenant-specific salt, ensuring that each tenant's data is encrypted with a unique derived key. Each encrypted record uses a unique 12-byte IV (initialization vector) stored alongside the ciphertext. Key rotation is supported: when a tenant's master key is rotated, a background job re-encrypts all records for that tenant using the new key while maintaining availability.

### 1.5 Audit & Compliance

**Audit Logging:**
Every API call is logged with the following fields: timestamp, requester userId, requester role, tenantId, HTTP method, path, request body hash, response status code, and execution duration. Additionally, every data access event (read, write, delete) is logged at the record level, including the resource type, resource ID, and the fields accessed.

**Immutable Audit Trail:**
Audit logs are written to a separate, append-only data store (e.g., a dedicated PostgreSQL schema with INSERT-only permissions, or a write-once S3 bucket with object locking). Application code has no UPDATE or DELETE permissions on the audit store. This ensures the audit trail cannot be tampered with — even by a compromised application layer.

**Compliance Standards:**
- **NDPR** (Nigerian Data Protection Regulation): Mandates data minimization, consent, and the right to erasure. All PII handling must comply.
- **INEC Code of Conduct**: Election observation data must be tamper-evident and attributable.
- **GDPR** (if EU stakeholders are present): Extends NDPR requirements with stricter consent and portability obligations.
- **WABA Compliance**: WhatsApp Business API usage must adhere to Meta's messaging policies, including opt-in consent tracking for all WhatsApp communications.

---

## 2. Security Implementation Plan

### Phase 1: Critical (Week 1–2)

These items address the most severe vulnerabilities — the absence of real authentication and authorization.

| # | Task | Deliverable |
|---|---|---|
| 1 | Implement NextAuth.js v5 with Credentials provider | `src/app/api/auth/[...nextauth]/route.ts`, `src/lib/auth.ts` |
| 2 | Add `middleware.ts` with JWT validation and role checking | `src/middleware.ts` |
| 3 | Add tenant isolation checks to all 28 API routes | Updates to every file in `src/app/api/` |
| 4 | Encrypt sensitive fields at rest (initial pass with a single master key) | `src/lib/encryption.ts`, migration script |
| 5 | Add rate limiting (using `@upstash/ratelimit` or equivalent edge-compatible limiter) | `src/lib/rate-limit.ts`, middleware integration |

### Phase 2: High (Week 3–4)

These items harden the platform against common attack vectors and establish observability.

| # | Task | Deliverable |
|---|---|---|
| 6 | Implement TOTP two-factor authentication | `src/lib/two-factor.ts`, enrollment/disabling API routes, QR code generation |
| 7 | Add security headers (CSP, HSTS, X-Frame-Options, etc.) | `src/middleware.ts` header injection |
| 8 | Implement session management with expiry and revocation | Session table, refresh token rotation, active session listing |
| 9 | Add comprehensive audit logging | `src/lib/audit.ts`, audit API, append-only store configuration |
| 10 | Secure WhatsApp bridge with API key authentication | API key generation/validation, rotation support |

### Phase 3: Medium (Week 5–6)

These items address data infrastructure, advanced encryption, and operational security.

| # | Task | Deliverable |
|---|---|---|
| 11 | Migrate SQLite to PostgreSQL | Schema migration, connection pool, query updates |
| 12 | Implement per-tenant field-level encryption with key rotation | `src/lib/field-encryption.ts`, key rotation job |
| 13 | Add request signing for inter-service communication | HMAC-SHA256 request signing, verification middleware |
| 14 | Implement device trust enforcement | Trust score computation, step-up authentication triggers |
| 15 | Add security event alerting (real-time notifications) | Alert rules, notification channels (email, Slack, PagerDuty) |

---

## 3. Encryption Implementation Details

### 3.1 Password Hashing

```typescript
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;
// Server-side pepper stored in Vault/KMS — never in code or .env
const PEPPER = await getSecret('PASSWORD_PEPPER');

export async function hashPassword(password: string): Promise<string> {
  const peppered = password + PEPPER;
  return bcrypt.hash(peppered, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const peppered = password + PEPPER;
  return bcrypt.compare(peppered, hash);
}
```

- **Cost factor 12** provides ~250ms hashing time, balancing security and user experience.
- A **server-side pepper** is concatenated before hashing. The pepper is retrieved from the secrets manager at runtime and never committed to source control.
- The hashed output is stored in a new `passwordHash` field on the User model.

### 3.2 JWT Structure

```
HEADER (Base64URL)
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "key-v1-2025"
}

PAYLOAD (Base64URL)
{
  "sub": "usr_3f7a2b1c",       // User ID
  "email": "observer@example.com",
  "role": "FIELD_OBSERVER",     // One of: SUPER_ADMIN, TRUST_SAFETY, CAMPAIGN_ADMIN, FIELD_OBSERVER, SYSTEM
  "tenantId": "tnt_9d4e1f2a",   // Tenant the user belongs to
  "deviceId": "sess_8c2d4e6f",  // Bound session/device
  "iat": 1720876800,            // Issued at
  "exp": 1720877700,            // Expires (iat + 15min for access, iat + 7d for refresh)
  "jti": "tok_a1b2c3d4e5"       // Unique token ID for revocation
}

SIGNATURE
RSA-SHA256 using 2048-bit private key
```

- **Access token**: 15-minute expiry. Used for all API authorization.
- **Refresh token**: 7-day expiry. Stored server-side; used only to obtain new access tokens.
- **Token revocation**: The `jti` of revoked tokens is stored in a Redis set (or database table) with TTL matching the token's remaining lifetime. Middleware checks this set on every request.

### 3.3 Field-Level Encryption

```typescript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

// Fields that must be encrypted before storage
const ENCRYPTED_FIELDS = [
  'phone',
  'whatsappJid',
  'biometricProfile',
  'twoFactorSecret',
] as const;

type EncryptableField = (typeof ENCRYPTED_FIELDS)[number];

// Derive a per-tenant encryption key using HKDF-SHA256
function deriveTenantKey(masterKey: Buffer, tenantId: string, salt: Buffer): Buffer {
  return crypto.hkdfSync('sha256', masterKey, salt, tenantId, 32);
}

// Encrypt a plaintext value; returns base64-encoded iv:ciphertext:authTag
function encryptField(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  let ciphertext = cipher.update(plaintext, 'utf8');
  ciphertext = Buffer.concat([ciphertext, cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, ciphertext, authTag]).toString('base64');
}

// Decrypt a base64-encoded iv:ciphertext:authTag value
function decryptField(encrypted: string, key: Buffer): string {
  const buffer = Buffer.from(encrypted, 'base64');
  const iv = buffer.subarray(0, IV_LENGTH);
  const authTag = buffer.subarray(buffer.length - AUTH_TAG_LENGTH);
  const ciphertext = buffer.subarray(IV_LENGTH, buffer.length - AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  let plaintext = decipher.update(ciphertext);
  plaintext = Buffer.concat([plaintext, decipher.final()]);
  return plaintext.toString('utf8');
}
```

**Key rotation**: When a tenant's encryption key is rotated, a background job iterates over all encrypted records for that tenant, decrypts with the old key, re-encrypts with the new key, and updates the record. The key version is stored alongside each encrypted value to support dual-key decryption during the rotation window.

### 3.4 Evidence Chain of Custody

Election evidence (photos, videos, PVT results) requires a tamper-evident chain of custody:

- **C2PA signing**: Media files are signed using the Coalition for Content Provenance and Authenticity (C2PA) standard. The `c2paSignature` field on the Evidence model is already defined but not populated. The implementation embeds a C2PA manifest containing the author's userId, timestamp, GPS coordinates (if available), and a SHA-256 hash of the file content.
- **SHA-256 hash verification**: PVT (Parallel Vote Tabulation) submissions already compute a SHA-256 hash of the result payload. This is verified on receipt and stored in the `hash` field.
- **Hash chain**: Each new evidence record includes a `previousHash` field linking it to the preceding record in the chain. Any tampering with a record invalidates all subsequent hashes in the chain, making manipulation detectable.
- **Tamper-evident logging**: All evidence access events (view, download, export) are written to the immutable audit log with the requester's identity, timestamp, and the evidence hash at the time of access.

---

## 4. Security Headers Configuration

All responses from the Next.js application must include the following security headers. These are injected in `src/middleware.ts` to ensure they apply to every response, including API routes and static assets.

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{random}';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https:;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https:;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self'

Strict-Transport-Security:
  max-age=31536000; includeSubDomains; preload

X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(self)
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
Pragma: no-cache
```

**CSP Notes:**
- The `nonce-{random}` placeholder is replaced at runtime with a cryptographic nonce generated per request, preventing inline script injection.
- `img-src` permits `data:` and `blob:` URIs for evidence image display, and `https:` for external map tiles.
- `connect-src` is restricted to same-origin to prevent data exfiltration via fetch/WebSocket to third-party origins.

---

## 5. Rate Limiting Strategy

Rate limiting is enforced at the middleware layer to protect against brute force, denial of service, and abuse. Limits are applied per-identifier (IP for unauthenticated requests, userId for authenticated requests).

| Context | Limit | Window | Identifier |
|---|---|---|---|
| **Global** | 100 requests | 1 minute | IP address |
| **Auth endpoints** (`/api/auth/*`) | 5 attempts | 1 minute | Email address |
| **Auth endpoints** (`/api/auth/*`) | 20 attempts | 1 hour | IP address |
| **POST endpoints** (data mutation) | 30 requests | 1 minute | User ID |
| **GET endpoints** (data retrieval) | 120 requests | 1 minute | User ID |
| **WhatsApp bridge** (`/api/whatsapp/*`) | 1000 messages | 1 minute | Campaign ID |
| **Data export** (`/api/export/*`) | 3 requests | 1 hour | User ID |
| **Password reset** (`/api/auth/reset`) | 3 requests | 1 hour | Email address |

**Implementation:** Use `@upstash/ratelimit` (compatible with Vercel Edge Runtime) backed by Upstash Redis. Fallback: an in-memory sliding window for development environments.

**Response on limit exceeded:** Return `429 Too Many Requests` with a `Retry-After` header indicating when the client may retry.

---

## 6. Incident Response Plan

### 6.1 Severity Classification

| Severity | Description | Response Time |
|---|---|---|
| **CRITICAL** | Active breach, data exfiltration, account takeover, ransomware | Immediate (within 15 minutes) |
| **HIGH** | Vulnerability exploited but contained, unauthorized access attempt detected | Within 1 hour |
| **WARNING** | Suspicious activity pattern, policy violation, failed brute force | Within 4 hours |
| **INFO** | Routine security event, successful auth log, permission check | Logged, reviewed daily |

### 6.2 Response Phases

1. **Detection**: Automated alerts from the security monitoring system (see Section 7) trigger an incident. Manual reports from users or staff also initiate the process.
2. **Triage**: The on-call security specialist classifies severity, identifies affected systems and data, and determines blast radius.
3. **Containment**: Immediate actions to stop the bleeding:
   - Auto-lock compromised accounts (leverage the existing `isLocked` mechanism).
   - Revoke all active sessions for affected users.
   - Block suspicious IP addresses at the WAF/edge level.
   - Disable affected API endpoints if necessary.
4. **Eradication**: Remove the root cause — patch the vulnerability, rotate compromised credentials, update firewall rules.
5. **Recovery**: Restore affected systems from verified backups, validate data integrity using hash chains, and gradually re-enable services with enhanced monitoring.
6. **Post-Incident**: Conduct a root cause analysis (RCA), document findings in an incident report, update the threat model, and adjust security controls to prevent recurrence. The RCA is reviewed in the next security standup.

### 6.3 Escalation Path

- **Level 1**: On-call security specialist → resolves INFO and WARNING.
- **Level 2**: Security lead + engineering manager → resolves HIGH.
- **Level 3**: CTO + legal counsel + external forensics (if needed) → resolves CRITICAL.

---

## 7. Security Monitoring

All security-relevant events are logged, aggregated, and monitored. The monitoring system provides both real-time alerting and historical analysis.

### 7.1 Logged Events

| Event Category | Specific Events |
|---|---|
| **Authentication** | Successful login, failed login, account lockout, account unlock, password change, TOTP enable/disable, session creation, session revocation, token refresh |
| **Authorization** | Permission denied (role mismatch), tenant isolation violation, field-level access denied, expired token rejection, revoked token rejection |
| **Data Access** | Record read (with field-level detail), record created, record updated, record deleted, bulk export initiated, bulk export completed |
| **Anomalies** | Brute force pattern detected (5+ failures in 10 min from same IP), impossible travel (login from two geographically distant locations within short time), unusual API volume (3x normal), cross-tenant access attempt |

### 7.2 Alerting Channels

- **CRITICAL**: PagerDuty + SMS + Slack `#security-incidents` channel + email to security lead.
- **HIGH**: Slack `#security-alerts` channel + email to security team.
- **WARNING**: Slack `#security-alerts` channel (low priority).
- **INFO**: Written to audit log only; reviewed in daily security digest.

### 7.3 Dashboard Metrics

A security dashboard (accessible to SUPER_ADMIN and TRUST_SAFETY roles) displays:
- Authentication success/failure rate (last 24h, 7d, 30d).
- Top 10 failed-login source IPs.
- Active sessions by role and tenant.
- Authorization failure count by endpoint.
- Audit log volume and storage utilization.
- Rate limit trigger count by category.

---

## 8. Compliance Checklist

The following checklist tracks compliance with applicable regulations and standards. Each item must be verified, documented, and signed off before the platform enters production.

- [ ] **NDPR (Nigerian Data Protection Regulation)**
  - [ ] Data Protection Impact Assessment (DPIA) completed
  - [ ] Data processing register maintained
  - [ ] Consent management for WhatsApp messaging implemented
  - [ ] Data subject access request (DSAR) process documented
  - [ ] Right to erasure implemented and tested
  - [ ] Data retention policy enforced (auto-deletion after retention period)
  - [ ] Data breach notification process (72-hour notification to NDPC)

- [ ] **INEC Code of Conduct for Election Observers**
  - [ ] Observer identity verification before data submission
  - [ ] Evidence chain of custody (C2PA signing) operational
  - [ ] PVT result integrity verification (hash chain) operational
  - [ ] Tamper-evident audit trail for all observation data
  - [ ] No observer can modify or delete submitted evidence

- [ ] **WABA (WhatsApp Business API) Compliance**
  - [ ] Opt-in consent tracked per recipient before any message
  - [ ] Message templates approved by Meta
  - [ ] Opt-out mechanism functional (reply STOP)
  - [ ] Message rate limits enforced (1000/min per campaign)
  - [ ] No PII shared in message content without encryption

- [ ] **Technical Security Standards**
  - [ ] All PII encrypted at rest (AES-256-GCM)
  - [ ] All data encrypted in transit (TLS 1.2+)
  - [ ] Authentication enforced on all endpoints (no public API routes except health check)
  - [ ] Authorization enforced at middleware level (not client-side only)
  - [ ] Audit trail is immutable and append-only
  - [ ] Security headers present on all responses
  - [ ] Rate limiting active on all endpoints
  - [ ] Secrets managed via Vault/KMS (no secrets in code or .env)
  - [ ] Vulnerability scanning integrated into CI/CD pipeline
  - [ ] Penetration testing completed before production launch

---

## Appendix A: File Structure for Security Implementation

```
src/
├── middleware.ts                    # JWT validation, RBAC, rate limiting, security headers
├── lib/
│   ├── auth.ts                     # NextAuth.js v5 configuration
│   ├── permissions.ts              # Permission matrix (28 endpoints × 5 roles)
│   ├── encryption.ts               # Field-level encryption (AES-256-GCM)
│   ├── audit.ts                    # Audit logging service
│   ├── rate-limit.ts               # Rate limiting configuration
│   ├── two-factor.ts               # TOTP generation and verification
│   ├── device-trust.ts             # Device fingerprinting and trust scoring
│   └── security-headers.ts         # CSP and security header constants
├── app/api/auth/
│   └── [...nextauth]/
│       └── route.ts                # NextAuth.js catch-all handler
├── app/api/audit/
│   └── logs/
│       └── route.ts                # Audit log query endpoint (SUPER_ADMIN, TRUST_SAFETY)
└── config/
    └── security.ts                 # Security configuration constants
```

## Appendix B: Threat Model Summary

| Threat | Current Risk | Target Mitigation |
|---|---|---|
| Unauthorized access (no auth) | **CRITICAL** — anyone can access all endpoints | NextAuth.js v5 + JWT + middleware enforcement |
| Privilege escalation (client-side roles) | **CRITICAL** — roles modifiable in browser | Backend RBAC middleware, server-side role from JWT |
| Cross-tenant data leakage | **CRITICAL** — no tenant isolation | Tenant ID in JWT, verified on every data access |
| PII exposure (plaintext storage) | **HIGH** — phone, email, biometrics in cleartext | AES-256-GCM field-level encryption |
| Brute force attacks | **HIGH** — no rate limiting or lockout | Rate limiting + account lockout + exponential backoff |
| Session hijacking | **HIGH** — no session management | HTTP-only cookies, short-lived tokens, device binding |
| Data tampering (evidence) | **HIGH** — no chain of custody | C2PA signing + SHA-256 hash chains |
| Insider threat (cross-tenant) | **MEDIUM** — no isolation between tenants | Tenant isolation middleware + audit logging |
| DoS attacks | **MEDIUM** — no rate limiting | Global and per-endpoint rate limits |
| Compliance violation | **HIGH** — no audit trail, no consent tracking | Immutable audit logs + consent management |

---

*This document is a living artifact. It must be updated as the security implementation progresses, as new threats are identified, and as compliance requirements evolve. All changes require review and approval by the Security Lead.*