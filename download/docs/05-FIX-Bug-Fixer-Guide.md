# OmniVote Monitor v2.1 — Bug Fixer Guide

> **Document ID**: 05-FIX
> **Version**: 2.1.0
> **Last Updated**: 2025-07-10
> **Scope**: Known issues, common bug patterns, and the end-to-end fixing workflow for the OmniVote Monitor multi-tenant election monitoring platform.

---

## 1. Bug Fixing Workflow

Every bug fix in this codebase must follow a strict, repeatable six-step process. Skipping steps — especially the build verification step — has historically introduced regressions that went unnoticed until deployment.

### Step 1: Reproduce the Bug

Before writing any code, you must reproduce the bug with exact, repeatable steps.

- **Record the browser** (Chrome, Firefox, Edge — version matters).
- **Record the role** (SUPER_ADMIN, TENANT_ADMIN, FIELD_AGENT, ANALYST, OBSERVER).
- **Record the tenant** (OmniVote-NG, OmniVote-KE, OmniVote-GH — each has different seed data).
- **Record the exact navigation path**: which tab, which button, what input values.
- **Capture the error**: screenshot the browser console, the server terminal output, and the Network tab response body if applicable.

If you cannot reproduce the bug, you cannot verify the fix. Do not proceed.

### Step 2: Identify Root Cause

Read the code path from the UI component through the data-fetching layer, through the API route, to the database query.

| Layer | Where to look | What to check |
|-------|---------------|---------------|
| **UI** | `src/app/dashboard/tabs/` | Which `useQuery` or `useMutation` is involved? What arguments does it pass? |
| **Data fetching** | `src/lib/api.ts` (`fetchJson`) | Is the URL correct? Are query parameters being serialized? Is the response type correct? |
| **API route** | `src/app/api/*/route.ts` | Is `req.json()` parsed correctly? Is `tenantId` validated? Is the Prisma query correct? |
| **Database** | `prisma/schema.prisma` | Does the model have the field you expect? Are relations configured properly? |
| **Zustand store** | `src/store/` | Is the store state being updated? Are selectors correct? |

Common root causes in this codebase: missing `tenantId` in API URLs, missing `res.ok` checks (before `fetchJson` existed), useEffect referencing variables before declaration, and mutations without error handling.

### Step 3: Write the Fix

- Make the **minimum change** that fixes the root cause. Do not refactor surrounding code in the same commit — separate fixes into separate commits.
- Follow existing code patterns. If other components use `fetchJson<SomeType>()`, use it too.
- Ensure TypeScript types are correct. No `any`, no `as any`.
- If the fix involves an API route change, update the corresponding UI component to match.

### Step 4: Verify Fix with Build

Run the build command and verify **zero errors**:

```bash
bun run build
```

This is non-negotiable. The build catches:
- TypeScript type errors
- Missing imports
- Invalid JSX
- Prisma client generation issues
- Server component / client component boundary violations

If the build fails, fix the build errors before proceeding. Do not commit code that does not build.

Optionally, also run linting:

```bash
bun run lint
```

Lint warnings are acceptable (for now), but lint errors must be resolved.

### Step 5: Test Fix in Browser

1. Restart the dev server: `bun run dev`
2. Navigate to the exact page and perform the exact steps from Step 1.
3. Verify the bug is gone.
4. Test edge cases: empty data, long strings, special characters, rapid clicking, multiple tenants.

### Step 6: Check for Regressions

- Does the fix break any other tab or feature?
- Does it change behavior for other roles?
- Does it affect other tenants' data?
- Run through the Build Verification Checklist (Section 6) at minimum.

---

## 2. Previously Fixed Bugs (Session History)

The following bugs have been identified and fixed across multiple debugging sessions. This history is critical context — many of these bugs share common root causes (documented in Section 4), and similar patterns may still exist in unfixed parts of the codebase.

### Round 1: Silent Error Swallowing (27 bugs)

- **Problem**: All `fetch()` calls in the codebase checked `!res.ok` but only some threw errors on failure. Twenty-seven `fetch()` calls across 14 files silently swallowed HTTP errors, meaning the UI would show stale data or nothing at all when the API returned 4xx/5xx responses.
- **Root Cause**: Inconsistent error handling pattern — some files had `if (!res.ok) throw new Error(...)`, others had `if (!res.ok) return null`.
- **Fix**: Created `src/lib/api.ts` with a centralized `fetchJson<T>()` function that always throws a descriptive `Error` on non-ok HTTP responses (including the status code and response body in the error message). Updated all 27 call sites.
- **Files affected**:
  - `page.tsx` — 3 calls
  - `agent-engagement.tsx` — 7 calls
  - `field-safety.tsx` — 2 calls
  - `campaign-monitor.tsx` — 2 calls
  - `agent-roster.tsx` — 2 calls
  - `situation-room.tsx` — 1 call
  - `field-submit.tsx` — 4 calls
  - `login.tsx` — 1 call
  - `evidence-dossier.tsx` — 2 calls
  - `osint-monitor.tsx` — 1 call
  - `pvt-quick-count.tsx` — 1 call
  - `honeypot-biometrics.tsx` — 2 calls
  - `flashpoint-wargame.tsx` — 2 calls
  - `field-reports.tsx` — 1 call
- **Lesson**: Never use raw `fetch()` in this codebase. Always use `fetchJson()`.

### Round 2: Empty Templates File

- **Problem**: `src/data/templates.ts` was an empty file (0 bytes). Since multiple components imported from this module, the entire application failed to build with module resolution errors.
- **Root Cause**: File was created as a placeholder during scaffolding but never populated.
- **Fix**: Created 110 rich media templates across 14 categories (incident alerts, safety advisories, voter information, results announcements, etc.) with proper TypeScript typing.
- **Lesson**: Empty module files that are imported anywhere will break the build. Always either populate them or remove the imports.

### Round 3: Mutation Error Handling

- **Problem**: Two `useMutation` calls in `tenant-mgmt.tsx` were missing `res.ok` checks after fetching. Mutations would silently fail without notifying the user.
- **Fix**: Added proper `res.ok` check with `throw new Error(...)` inside the mutation function, plus `onError` callbacks with toast notifications.
- **Lesson**: Every mutation must validate the response. See Pattern 3 in Section 4.

### Round 4: C2PA Metric Bug

- **Problem**: The C2PA verification metric in the evidence dossier showed the total incident count instead of the count of C2PA-verified incidents. The filter expression was `incidents.filter(i => true)`, which is a no-op.
- **Root Cause**: Likely a placeholder or incomplete implementation during initial development.
- **Fix**: Changed the filter to `incidents.filter(i => i.evidenceC2PA === 'VERIFIED')`.
- **Lesson**: Always verify that filter/map/reduce expressions are meaningful, not trivially true/false.

### Round 5: Unused Imports

- **Problem**: Eleven unused imports across 5 files, causing ESLint warnings and slightly inflating the client bundle size.
- **Fix**: Removed all unused imports.
- **Lesson**: Run `bun run lint` after every code change. See Pattern 6 in Section 4.

### Round 6: Type Safety

- **Problem**: `let parsedParams: any` in `flashpoint-wargame.tsx` — an explicit `any` type that defeats TypeScript's type checking for all downstream code using `parsedParams`.
- **Fix**: Changed to `Record<string, unknown>`, which forces proper type narrowing before accessing properties.
- **Lesson**: Never use `any`. See Pattern 7 in Section 4.

### Round 7: Silent Catch Blocks

- **Problem**: Two `catch { /* non-fatal */ }` blocks in `src/app/api/results/route.ts` swallowed errors entirely. If these failed, there would be zero indication in logs or monitoring.
- **Fix**: Added `console.error(error)` inside both catch blocks to ensure failures are at least logged.
- **Lesson**: Even "non-fatal" errors must be logged. Silent failures are the hardest bugs to diagnose.

### Round 8: Temporal Dead Zone

- **Problem**: A `useEffect` in `page.tsx` referenced `alertsData` before its `useQuery` declaration. In JavaScript, `const` and `let` declarations are hoisted but not initialized, causing a ReferenceError at runtime ("Cannot access 'alertsData' before initialization").
- **Fix**: Moved the `useEffect` block to after the `useQuery` declaration for `alertsData`.
- **Lesson**: In React components, all `useQuery`/`useMutation` declarations must appear before any `useEffect` that references their return values. See Pattern 2 in Section 4.

### Round 9: Missing onError on Mutations

- **Problem**: Five `useMutation` calls across the codebase lacked `onError` callbacks. When these mutations failed (network error, 500 response, etc.), the user received no feedback.
- **Fix**: Added `onError` callbacks with toast notifications to all five mutations.
- **Lesson**: See Pattern 3 in Section 4.

### Round 10: Hardcoded Mock Data

- **Problem**: Three major dashboard components — `media-gallery.tsx`, `system-health.tsx`, and `ai-insights.tsx` — used hardcoded arrays instead of fetching real API data. They showed the same static content regardless of tenant or actual database state.
- **Root Cause**: Components were built with placeholder data during rapid prototyping and never connected to the API.
- **Fix**: Rewrote all three components to use `useQuery` with `fetchJson` calls to their respective API endpoints. Added proper loading spinners, error states, and empty-state messaging.
- **Lesson**: Every component must fetch real data. Mock data belongs in seed scripts, not in production components. See Pattern 4 in Section 4.

---

## 3. Known Remaining Issues (To Fix)

The following issues are known and have not yet been addressed. They are ordered by severity.

### 3.1 No Authentication [CRITICAL]

- **Location**: Entire application — there is no authentication middleware or session management.
- **Impact**: Anyone with network access to the platform can access any data, perform any action, and impersonate any user.
- **Recommended Fix**: Implement NextAuth.js v5 with credentials provider. Create `src/middleware.ts` to protect all `/dashboard/*` routes. Add session checks to all API routes.

### 3.2 No Backend RBAC [CRITICAL]

- **Location**: All 28 API routes under `src/app/api/`.
- **Impact**: Even after authentication is added, any authenticated user can perform any action regardless of their assigned role. A FIELD_AGENT could delete tenants or modify system configuration.
- **Recommended Fix**: Create a `requireRole(roles: string[])` helper function. Call it at the top of every route handler. The SUPER_ADMIN role should have access to all routes; other roles should be restricted to their permitted actions.

### 3.3 No Tenant Isolation [CRITICAL]

- **Location**: All API routes that accept `tenantId` as a query parameter.
- **Impact**: A user belonging to Tenant A can pass `tenantId=tenant-b-id` in their API request and access Tenant B's data. This is a cross-tenant data leak.
- **Recommended Fix**: After authentication, derive the user's tenant from their session (not from the request body or query params). All Prisma queries must filter by `tenantId` from the session, never from user-supplied input. Add a database-level Row-Level Security (RLS) policy if the database supports it.

### 3.4 SQLite Limitations [HIGH]

- **Location**: `prisma/schema.prisma` — the datasource is configured for SQLite.
- **Impact**: SQLite does not support concurrent writes (the entire database is locked during writes), has no connection pooling, stores the entire database in a single file (not suitable for production), and lacks advanced features like full-text search, JSON operators, and array types.
- **Recommended Fix**: Migrate to PostgreSQL. Update `DATABASE_URL` in `.env`, change the `provider` in `schema.prisma`, run `bunx prisma migrate dev`, and update any SQLite-specific queries.

### 3.5 No Real-Time Updates [MEDIUM]

- **Location**: All `useQuery` calls across dashboard components use 30-second polling intervals.
- **Impact**: In a fast-moving election monitoring scenario, 30 seconds of delay is unacceptable. Critical incidents, safety alerts, and result updates should appear instantly.
- **Recommended Fix**: Implement WebSocket connections (Socket.io or native WebSocket) with server-side push for real-time event streams. Keep polling as a fallback.

### 3.6 AI/ML Features Simulated [MEDIUM]

- **Location**: Multiple API routes including incidents, OSINT, evidence analysis, and flashpoint wargame.
- **Impact**: AI-generated summaries, sentiment analysis scores, CIB (Coordinated Inauthentic Behavior) detection scores, steganography detection results, and anomaly detection alerts are all deterministic or random — not powered by actual machine learning models.
- **Recommended Fix**: Integrate Python-based ML microservices. Expose them via internal API endpoints. The Go service running on port 9090 could be extended to proxy ML requests.

### 3.7 System Health Data Static [LOW]

- **Location**: `system-health.tsx` component.
- **Impact**: The system health dashboard shows simulated uptime percentages, latency measurements, and service health statuses that do not reflect the actual state of the platform infrastructure.
- **Recommended Fix**: Integrate a real APM solution (Datadog, New Relic, Grafana, or a self-built health check service that pings all dependencies and reports actual metrics).

### 3.8 WhatsApp Bridge Unauthenticated [HIGH]

- **Location**: `/api/whatsapp/route.ts` and the Go bridge service running on port 9090.
- **Impact**: The WhatsApp bridge accepts messages without any authentication. Anyone who discovers the endpoint can send WhatsApp messages through the platform, potentially sending misinformation to voters.
- **Recommended Fix**: Add API key authentication to the bridge. The API route should validate a shared secret header. The Go service should also require authentication for inbound webhook calls.

### 3.9 Dead Dependency [LOW]

- **Location**: `package.json` — `next-auth` v4.24.11 is listed as a dependency but is not imported or used anywhere in the codebase.
- **Impact**: Adds unnecessary bundle weight, increases install time, and expands the attack surface (unused packages may have known vulnerabilities).
- **Recommended Fix**: Either remove the dependency entirely (`bun remove next-auth`) or upgrade to NextAuth.js v5 and implement the authentication system described in Issue 3.1.

### 3.10 No Error Boundaries [MEDIUM]

- **Location**: All dashboard tab components in `src/app/dashboard/tabs/`.
- **Impact**: If any tab component throws a runtime error (e.g., from unexpected API response shape, null reference, etc.), the entire dashboard crashes with a white screen. React Error Boundaries would catch these errors and display a fallback UI while keeping the rest of the dashboard functional.
- **Recommended Fix**: Create a generic `ErrorBoundary` component class (React error boundaries require class components). Wrap each tab's content in an `ErrorBoundary` with a user-friendly fallback that includes a retry button.

---

## 4. Common Bug Patterns to Watch For

These patterns have been the source of the majority of bugs found in this codebase. When reviewing code or diagnosing new bugs, check for these patterns first.

### Pattern 1: Missing fetchJson Usage

- **Symptom**: API call doesn't throw on error. UI shows stale data, loading spinner forever, or silently fails.
- **How to detect**: Run `rg "fetch\(" src/` — every `fetch()` call must go through `fetchJson()`. Any direct `fetch()` usage is a bug.
- **Fix**: Replace with `fetchJson<T>(url, options)` from `src/lib/api.ts`.

### Pattern 2: useEffect Variable Order

- **Symptom**: Runtime error `"Cannot access 'X' before initialization"` in the browser console.
- **How to detect**: Any `useEffect` that references a variable declared with `const` or `let` on a subsequent line. In React functional components, hook declarations (useQuery, useMutation, useState) must come before any useEffect that uses their return values.
- **Fix**: Reorder the code so that all variable declarations appear before the useEffect that references them.

### Pattern 3: Mutation Without Error Handling

- **Symptom**: Clicking a submit/delete/update button does nothing when the API returns an error. No toast, no error message, no indication of failure.
- **How to detect**: Any `useMutation` call that lacks an `onError` callback. Run `rg "useMutation" src/` and check each result.
- **Fix**: Add an `onError: (error) => { toast.error(error.message); }` callback (or equivalent user notification).

### Pattern 4: Missing Loading/Empty States

- **Symptom**: Blank screen, permanent spinner, or a cryptic error when data is empty or the API is slow.
- **How to detect**: Any component that calls `useQuery` but does not have conditional rendering for `isLoading`, `isError`, and empty data arrays.
- **Fix**: Add three conditional branches: loading state (spinner), error state (error message with retry), and empty state (friendly "No data" message).

### Pattern 5: Tenant ID Not Passed

- **Symptom**: API returns data from the wrong tenant, returns a 404, or returns all tenants' data mixed together.
- **How to detect**: Any `fetchJson` or API URL that does not include `?tenantId=xxx` in the query string. Run `rg "fetchJson" src/` and inspect each URL.
- **Fix**: Ensure every API URL includes the current tenant's ID as a query parameter.

### Pattern 6: Unused Imports After Refactoring

- **Symptom**: ESLint warnings, slightly larger JavaScript bundle, potential confusion for future developers.
- **How to detect**: Run `bun run lint` after every code change. Look for "is defined but never used" warnings.
- **Fix**: Remove the unused import statements.

### Pattern 7: Type Safety Violations

- **Symptom**: TypeScript `any` types, `as any` assertions, or `@ts-ignore` comments. These disable type checking and allow bugs to slip through that the compiler would otherwise catch.
- **How to detect**: Run `rg ": any" src/` and `rg "as any" src/`. Both should return zero results.
- **Fix**: Replace `any` with the correct type. Use `unknown` if the type is truly not known at compile time (and then narrow with type guards).

---

## 5. Debugging Techniques

### 5.1 Build Errors

The first and most important check. If the code doesn't build, nothing works.

```bash
bun run build
```

**Zero errors** is required. Warnings are acceptable but should be tracked. If the build fails, read the error message carefully — it will tell you the file, line number, and exact issue.

### 5.2 Runtime Errors

Check two places simultaneously:
1. **Browser console** (F12 → Console tab) — for client-side errors, uncaught promises, React errors.
2. **Server terminal** — for server-side errors, unhandled exceptions, Prisma query errors.

Tip: Tee the dev server output to a log file for easier searching:

```bash
bun run dev 2>&1 | tee dev.log
```

### 5.3 API Errors

Use the browser DevTools **Network** tab:
1. Open DevTools → Network tab.
2. Reproduce the action.
3. Find the failing request (red status code).
4. Check the **Response** tab for the error body.
5. Check the **Headers** tab to verify the request payload and content type.

### 5.4 Data Issues

Use Prisma Studio to inspect the database directly:

```bash
bunx prisma studio
```

This opens a web GUI at `http://localhost:5555` where you can browse all 23 models, view records, and manually edit data for testing.

### 5.5 State Issues

If a component isn't updating when expected, add `console.log` statements inside Zustand store actions and in the component's render function. Check that:
- The store action is being called.
- The store state is being updated.
- The component is re-rendering (React DevTools can help here).

### 5.6 Layout Issues

Use the browser DevTools **Elements** tab:
1. Inspect the element with incorrect styling.
2. Check the **Computed** styles panel.
3. Verify Tailwind classes are being applied (check for typos in class names).
4. Use the **Layout** panel to debug flexbox/grid issues.

---

## 6. Build Verification Checklist

Before considering any bug fix complete, verify every item on this checklist:

- [ ] `bun run build` completes with **0 errors**
- [ ] `bun run lint` completes with 0 errors (warnings are acceptable but should be noted)
- [ ] All 28 API routes are registered in the build output (check the build log)
- [ ] Server starts successfully: `bun run start` or `bun run dev`
- [ ] HTTP 200 on `http://localhost:3000` (or configured port)
- [ ] Login page loads and login works for all 3 tenants
- [ ] All 21 dashboard tabs load without errors for SUPER_ADMIN role
- [ ] RBAC correctly hides restricted tabs for FIELD_AGENT, ANALYST, and OBSERVER roles
- [ ] The specific bug that was fixed no longer reproduces
- [ ] No regressions in adjacent features

---

## Appendix: Quick Reference Commands

```bash
# Build
bun run build

# Lint
bun run lint

# Dev server
bun run dev

# Prisma Studio (database GUI)
bunx prisma studio

# Prisma migrations
bunx prisma migrate dev

# Prisma generate (after schema changes)
bunx prisma generate

# Search for raw fetch() calls (should be zero)
rg "fetch\(" src/

# Search for `any` types (should be zero)
rg ": any" src/
rg "as any" src/

# Search for useMutation calls (check each has onError)
rg "useMutation" src/

# Search for silent catch blocks
rg "catch \{" src/
```