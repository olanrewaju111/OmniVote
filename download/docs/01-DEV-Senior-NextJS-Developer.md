# OmniVote Monitor v2.1 — Senior Next.js Developer Guide

> **Audience:** Senior Next.js developers joining or maintaining the OmniVote Monitor v2.1 codebase.
> **Last updated:** 2025
> **Runtime:** Bun (not Node.js)

---

## 1. Project Architecture Overview

OmniVote Monitor v2.1 is a real-time election monitoring dashboard built on a modern web stack. Understanding the architectural decisions and constraints is critical before making any changes.

### Core Stack

| Layer          | Technology                     | Version | Notes                                      |
|----------------|--------------------------------|---------|--------------------------------------------|
| Framework      | Next.js (App Router)           | 16      | `src/app/` directory routing               |
| Runtime        | Bun                            | latest  | **NOT Node.js** — use `bun` commands only  |
| UI Library     | React                          | 19      | Concurrent features, Server Components     |
| Language       | TypeScript                     | 5       | Strict mode enabled                        |
| ORM            | Prisma                         | 6       | SQLite adapter                             |
| Client State   | Zustand                        | 5       | Single global store                        |
| Server State   | TanStack React Query            | v5      | All API data fetching                      |
| Styling        | Tailwind CSS + shadcn/ui       | 4       | Dark theme, mobile-responsive              |
| Charts         | Recharts                       | —       | NOT D3                                     |
| Maps           | react-leaflet + next/dynamic   | —       | SSR disabled via `ssr: false`              |
| Forms          | react-hook-form + Zod          | —       | Schema validation on all forms             |
| Database       | SQLite                         | —       | File-based, no external DB server          |

### Scale at a Glance

- **28 API route files** under `src/app/api/`
- **27+ dashboard components** under `src/components/dashboard/`
- **40+ shadcn/ui primitives** under `src/components/ui/`
- **23 Prisma models** in `prisma/schema.prisma`
- **128 message templates** in `src/data/templates.ts`
- **5 user roles** with frontend-only RBAC

### Architectural Principles

1. **Single-page dashboard** — The entire application is essentially one page (`src/app/page.tsx`) with a sidebar that switches between 21 tab views. There are no multi-page routes; navigation is state-driven via Zustand.
2. **No middleware** — There is no `middleware.ts` file. No route protection, no authentication guards, no redirects. All routes are publicly accessible by default.
3. **No backend RBAC** — Role-based access control is enforced only in the frontend sidebar. API routes do not check user permissions.
4. **Bun-first** — All scripts, package manager operations, and the production server run on Bun. Do not use `npm` or `npx`.

---

## 2. Directory Structure (Detailed)

```
src/
├── app/
│   ├── page.tsx              # Main dashboard — the single-page orchestrator
│   ├── layout.tsx            # Root layout (HTML shell, providers, fonts)
│   ├── globals.css           # Tailwind directives + custom CSS variables (dark theme)
│   ├── favicon.ico
│   └── api/                  # 28 API route files (Route Handlers)
│       ├── agents/
│       │   ├── route.ts          # GET (list), POST (create)
│       │   └── [id]/
│       │       └── route.ts      # GET, PATCH, DELETE (single agent)
│       ├── incidents/
│       │   ├── route.ts          # GET, POST
│       │   └── [id]/
│       │       └── route.ts      # GET, PATCH, DELETE
│       ├── alerts/
│       │   └── route.ts          # GET, POST, PATCH
│       ├── kpis/
│       │   └── route.ts          # GET (aggregated KPI data)
│       ├── polling-units/
│       │   └── route.ts          # GET, POST, PATCH
│       ├── messages/
│       │   └── route.ts          # GET (templates), POST (send)
│       ├── reports/
│       │   └── route.ts          # GET, POST
│       ├── uploads/
│       │   └── route.ts          # POST (file upload)
│       └── ... (remaining routes)
│
├── components/
│   ├── ui/                   # shadcn/ui primitives — 40+ files
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── table.tsx
│   │   ├── toast.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   ├── sheet.tsx
│   │   ├── tabs.tsx
│   │   └── ... (30+ more)
│   │
│   └── dashboard/            # 27+ feature components
│       ├── sidebar.tsx           # 21 nav items, role filtering, alert badge
│       ├── header.tsx            # Search, notifications, profile
│       ├── agents/
│       │   ├── agent-list.tsx
│       │   ├── agent-map.tsx
│       │   └── agent-form.tsx
│       ├── incidents/
│       │   ├── incident-list.tsx
│       │   ├── incident-map.tsx
│       │   └── incident-form.tsx
│       ├── alerts/
│       │   └── alert-panel.tsx
│       ├── kpis/
│       │   └── kpi-cards.tsx
│       ├── polling-units/
│       │   ├── pu-table.tsx
│       │   └── pu-map.tsx
│       ├── reports/
│       │   └── report-generator.tsx
│       ├── messages/
│       │   └── message-center.tsx
│       └── ... (remaining feature components)
│
├── store/
│   └── dashboard.ts          # Zustand store — single source of truth for UI state
│
├── lib/
│   ├── api.ts                # fetchJson<T>() — the ONLY way to call APIs
│   ├── db.ts                 # Prisma client singleton (import { db })
│   ├── utils.ts              # cn() helper, formatters, misc utilities
│   └── tenant.ts             # resolveTenant(req) — tenant resolution helper
│
├── types/
│   └── leaflet.d.ts          # TypeScript declarations for react-leaflet
│
├── data/
│   └── templates.ts          # 128 pre-defined message templates
│
└── prisma/
    └── schema.prisma         # 23 models defining the entire data layer
```

### Key File Responsibilities

| File | Purpose |
|------|---------|
| `src/app/page.tsx` | The orchestrator — reads `activeTab` from Zustand, conditionally renders one of 21 dashboard views, kicks off all initial data loads |
| `src/app/layout.tsx` | Root HTML shell — wraps children in providers (QueryClientProvider, Toaster, ThemeProvider) |
| `src/lib/api.ts` | Exports `fetchJson<T>()` — the mandatory HTTP client for all API communication |
| `src/lib/db.ts` | Exports singleton `db` Prisma client — prevents connection pool exhaustion |
| `src/lib/tenant.ts` | Exports `resolveTenant(req)` — extracts and validates tenant from request |
| `src/store/dashboard.ts` | Zustand store — user auth state, active tab, election metadata, filters, search query, sidebar collapse, unread alert count |

---

## 3. Critical Development Patterns

These are non-negotiable patterns that every developer must follow. Deviating from these patterns introduces bugs, build failures, or runtime errors.

### 3.1 `fetchJson<T>()` — The Only HTTP Client

**Rule:** ALL API calls MUST use `fetchJson<T>()` from `src/lib/api.ts`. Never use raw `fetch()`.

```typescript
// src/lib/api.ts — simplified
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${res.status}`);
  }
  return res.json();
}
```

**Why:** This wrapper checks `res.ok`, parses error bodies, and provides type safety. Raw `fetch` silently swallows non-2xx responses and returns opaque `Response` objects.

```typescript
// CORRECT
const agents = await fetchJson<Agent[]>('/api/agents?tenantId=xxx');

// WRONG — never do this
const res = await fetch('/api/agents?tenantId=xxx');
const agents = await res.json(); // no error checking!
```

### 3.2 `tenantId` — Always a Query Parameter

**Rule:** `tenantId` is ALWAYS passed as a URL query parameter. NEVER in the request body.

```typescript
// CORRECT
fetchJson<Agent[]>('/api/agents?tenantId=abc-123')
fetchJson<Incident>('/api/incidents/42?tenantId=abc-123', {
  method: 'PATCH',
  body: JSON.stringify({ status: 'resolved' }),
})

// WRONG — tenantId in body
fetchJson('/api/incidents', {
  method: 'POST',
  body: JSON.stringify({ tenantId: 'abc-123', title: '...' }), // NEVER
})
```

### 3.3 API Route Pattern

Each API route file exports named functions matching HTTP methods. The Next.js `route context` (second parameter) is intentionally unused. URL parsing is done via `new URL(req.url)`.

```typescript
// src/app/api/agents/route.ts
import { db } from '@/lib/db';
import { fetchJson } from '@/lib/api'; // Not used in routes, but shown for contrast
import { resolveTenant } from '@/lib/tenant';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get('tenantId');

  if (!tenantId) {
    return Response.json({ error: 'tenantId is required' }, { status: 400 });
  }

  const tenant = await resolveTenant(req);
  // ... fetch data scoped to tenant
  const agents = await db.agent.findMany({
    where: { tenantId: tenant.id },
  });

  return Response.json(agents);
}

export async function POST(req: Request) {
  const body = await req.json();
  const tenant = await resolveTenant(req);
  // ... create record scoped to tenant
}
```

**Key points:**
- Named exports: `GET`, `POST`, `PATCH`, `PUT`, `DELETE`
- No default export
- URL parsing: `new URL(req.url)` to extract query params
- Tenant resolution: always call `resolveTenant(req)` first
- Return `Response.json()` directly

### 3.4 Prisma Client — Singleton Pattern

**Rule:** Always import from `@/lib/db`, never instantiate PrismaClient directly.

```typescript
// CORRECT
import { db } from '@/lib/db';
const agents = await db.agent.findMany({ ... });

// WRONG — creates a new connection pool each time
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
```

The `db` singleton in `src/lib/db.ts` ensures only one PrismaClient instance exists, preventing connection pool exhaustion with SQLite.

### 3.5 Tenant Resolution

**Rule:** Always use `resolveTenant(req)` from `@/lib/tenant` at the start of every API route.

```typescript
import { resolveTenant } from '@/lib/tenant';

export async function GET(req: Request) {
  const tenant = await resolveTenant(req);
  // tenant.id is guaranteed to exist and be active
  // Falls back to the first active tenant if no tenantId provided
}
```

Resolution order:
1. Extract `tenantId` from URL query parameters
2. Validate tenant exists in the database and is active
3. If no `tenantId` or invalid, fall back to the first active tenant
4. Throw 400 if no active tenants exist at all

### 3.6 Sandbox Process Lifecycle

**Rule:** The dev server process dies between bash calls in the sandbox environment.

When running `bun run dev`, the process may be reaped between tool invocations. To keep logs visible:

```bash
# Log output while keeping server alive
bun run dev 2>&1 | tee /tmp/dev.log
```

If the server stops responding, restart it. Do not assume long-running processes persist.

### 3.7 No Middleware — No Route Protection

There is no `middleware.ts` file. No authentication guards, no route redirects, no session checks. Every route (both pages and API) is publicly accessible. If backend protection is needed, it must be added from scratch.

---

## 4. Component Architecture

### 4.1 `page.tsx` — The Orchestrator

The main page (`src/app/page.tsx`) is the single entry point for the entire application. It:

1. Reads `activeTab` from the Zustand store
2. Kicks off **all** initial data loads via React Query (agents, incidents, alerts, KPIs, polling units)
3. Conditionally renders one of 21 dashboard components based on `activeTab`
4. All data queries use a 30-second `refetchInterval` for near-real-time updates

```typescript
// Simplified structure of page.tsx
export default function DashboardPage() {
  const { activeTab } = useDashboardStore();

  // Preload all data
  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: () => fetchJson<Agent[]>('/api/agents?tenantId=xxx'),
    refetchInterval: 30000,
  });
  // ... more queries for incidents, alerts, kpis, polling-units

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          {activeTab === 'overview' && <OverviewDashboard />}
          {activeTab === 'agents' && <AgentList />}
          {activeTab === 'incidents' && <IncidentList />}
          {activeTab === 'alerts' && <AlertPanel />}
          {/* ... 17 more tab renderings */}
        </main>
      </div>
    </div>
  );
}
```

### 4.2 `sidebar.tsx` — Navigation & Role Filtering

- 21 navigation items corresponding to the 21 dashboard views
- `ROLE_TABS` constant maps each `UserRole` to an array of allowed `ViewTab` values
- Displays an unread alert count badge
- Collapsible (controlled by Zustand `sidebarCollapsed` state)

### 4.3 `header.tsx` — Search, Notifications, Profile

- **Global search:** Typing in the search bar and pressing Enter navigates to the relevant tab. `Ctrl/Cmd+K` focuses the search input. `Escape` clears the search.
- **Notification bell:** A `DropdownMenu` component showing recent alerts with a "Mark as Read" action.
- **Profile dialog:** Opens a dialog showing current user info, role, and logout option.

### 4.4 Dashboard Components — Self-Contained Units

Each of the 27+ dashboard components follows this pattern:

1. **Own data fetching:** Each component calls APIs directly via `useQuery` / `useMutation` — data is not passed down from `page.tsx`
2. **Own local state:** `useState` for UI concerns (selected row, open dialog, local filters)
3. **Loading/empty/error states:** Every component must render appropriate states for each data condition
4. **Charts:** Use `recharts` (BarChart, LineChart, PieChart, etc.) — never D3 directly
5. **Maps:** Use `react-leaflet` loaded via `next/dynamic` with `ssr: false` to avoid window-related SSR crashes
6. **Forms:** Use `react-hook-form` with `zod` schema validation

```typescript
// Example: Typical dashboard component structure
export function IncidentList() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: incidents, isLoading, error } = useQuery({
    queryKey: ['incidents'],
    queryFn: () => fetchJson<Incident[]>('/api/incidents?tenantId=xxx'),
    refetchInterval: 30000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/incidents/${id}?tenantId=xxx`, { method: 'DELETE' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['incidents'] }); },
    onError: (err) => { toast.error(`Delete failed: ${err.message}`); },
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (error) return <ErrorState message={error.message} />;
  if (!incidents?.length) return <EmptyState icon={AlertTriangle} message="No incidents reported" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Incidents</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>...</Table>
      </CardContent>
    </Card>
  );
}
```

---

## 5. State Management

### 5.1 Zustand Store (`src/store/dashboard.ts`)

The Zustand store is the **single source of truth** for all client-side UI state. It does NOT hold server/fetched data — that is React Query's responsibility.

**Store shape (key slices):**

| Slice | Fields | Purpose |
|-------|--------|---------|
| Auth | `user`, `role`, `isAuthenticated` | Current user identity and role |
| Navigation | `activeTab`, `sidebarCollapsed` | Which dashboard view is shown |
| Election | `electionName`, `electionDate`, `electionStatus` | Current election metadata |
| Filters | `dateRange`, `statusFilter`, `severityFilter`, `locationFilter` | Global filter state shared across tabs |
| Search | `searchQuery` | Global search text |
| Alerts | `unreadAlertCount` | Badge count for notification bell |

```typescript
// Accessing store values
import { useDashboardStore } from '@/store/dashboard';

function MyComponent() {
  const { activeTab, setActiveTab, user } = useDashboardStore();
  // or with selectors for performance
  const role = useDashboardStore((s) => s.user.role);
}
```

### 5.2 React Query (Server State)

All data from the API is managed by TanStack React Query v5:

- **Queries (`useQuery`):** Read operations. Most use `refetchInterval: 30000` (30s polling).
- **Mutations (`useMutation`):** Write operations (create, update, delete). Must have `onSuccess` (invalidate related queries) and `onError` (show toast).
- **Query keys:** Follow the pattern `['resource']` for lists and `['resource', id]` for single items.
- **Stale time:** Not explicitly set — defaults to 0, meaning data is considered stale immediately and refetched on mount/window focus.

```typescript
// Mutation pattern — ALWAYS include onError
const createMutation = useMutation({
  mutationFn: (data: CreateAgentInput) =>
    fetchJson<Agent>('/api/agents?tenantId=xxx', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  onSuccess: (newAgent) => {
    queryClient.invalidateQueries({ queryKey: ['agents'] });
    toast.success(`Agent "${newAgent.name}" created`);
    form.reset();
  },
  onError: (error) => {
    toast.error(`Failed to create agent: ${error.message}`);
    console.error('Agent creation failed:', error);
  },
});
```

### 5.3 Local State (`useState`)

Component-specific UI state lives in `useState` within each component:

- Selected table row
- Dialog open/close
- Local filter overrides
- Form mode (create vs. edit)
- Expanded/collapsed sections

This state is intentionally NOT global — it resets when the component unmounts (tab switch).

---

## 6. Role-Based Access Control

### 6.1 Defined Roles

```typescript
type UserRole =
  | 'admin'        // Full access to all features
  | 'supervisor'   // Most features, limited settings
  | 'operator'     // Data entry, incident management
  | 'viewer'       // Read-only dashboard views
  | 'guest';       // Minimal access, overview only
```

### 6.2 Role-Tab Mapping

The `ROLE_TABS` constant (in `sidebar.tsx` or `store/dashboard.ts`) maps each role to its allowed tabs:

```typescript
const ROLE_TABS: Record<UserRole, ViewTab[]> = {
  admin:      ['overview', 'agents', 'incidents', 'alerts', 'kpis', 'polling-units', 'messages', 'reports', 'settings', ...],
  supervisor: ['overview', 'agents', 'incidents', 'alerts', 'kpis', 'polling-units', 'messages', 'reports'],
  operator:   ['overview', 'agents', 'incidents', 'alerts', 'messages'],
  viewer:     ['overview', 'kpis', 'reports'],
  guest:      ['overview'],
};
```

### 6.3 Critical Limitation: Frontend-Only RBAC

**Role checks exist only in the sidebar component.** API routes do NOT verify the caller's role. This means:

- A user with `viewer` role can directly call `POST /api/agents` via browser DevTools and it will succeed.
- There is no JWT validation, no session checking, no role middleware.
- If backend enforcement is required, it must be built from scratch in each API route.

---

## 7. Common Pitfalls & Bugs Found

These are real issues discovered during development. Avoid them.

### 7.1 Temporal Dead Zone

Variables referenced in `useEffect` callbacks that are declared after the effect cause runtime crashes.

```typescript
// BUG — myValue is in temporal dead zone
useEffect(() => {
  console.log(myValue); // ReferenceError: Cannot access before initialization
}, []);

const myValue = computeSomething();

// FIX — declare before the effect
const myValue = computeSomething();
useEffect(() => {
  console.log(myValue); // Works correctly
}, []);
```

### 7.2 Unused Imports

Unused imports cause TypeScript/ESLint build warnings. With strict CI, these can fail the build.

```typescript
// BAD
import { useState, useEffect, useCallback } from 'react';
// useCallback is never used — build warning

// GOOD — only import what you use
import { useState, useEffect } from 'react';
```

**Action:** Run `bunx tsc --noEmit` frequently and fix all warnings immediately.

### 7.3 Silent Catch Blocks

Empty `catch` blocks swallow errors silently, making debugging impossible.

```typescript
// BAD
try {
  await fetchJson('/api/data');
} catch {
  // silently ignored
}

// GOOD
try {
  await fetchJson('/api/data');
} catch (error) {
  console.error('Failed to fetch data:', error);
  toast.error('Failed to load data');
}
```

### 7.4 `any` Type Usage

TypeScript `any` defeats the purpose of the type system and masks bugs.

```typescript
// BAD
let data: any = await fetchJson('/api/kpis');

// GOOD — use proper types
let data: Record<string, unknown> = await fetchJson<Record<string, unknown>>('/api/kpis');

// BETTER — define an interface
interface KpiData {
  totalAgents: number;
  activeIncidents: number;
  // ...
}
let data: KpiData = await fetchJson<KpiData>('/api/kpis');
```

### 7.5 Mutations Without `onError`

A `useMutation` without `onError` leaves failures invisible to the user. The mutation silently fails, and the UI shows no feedback.

```typescript
// BAD
const mutation = useMutation({
  mutationFn: (id: string) => fetchJson(`/api/items/${id}`, { method: 'DELETE' }),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
  // No onError — user sees nothing on failure
});

// GOOD
const mutation = useMutation({
  mutationFn: (id: string) => fetchJson(`/api/items/${id}`, { method: 'DELETE' }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['items'] });
    toast.success('Item deleted');
  },
  onError: (error) => {
    toast.error(`Delete failed: ${error.message}`);
    console.error('Mutation failed:', error);
  },
});
```

---

## 8. Build & Dev Commands

All commands use Bun. Never use `npm` or `npx` (use `bunx` instead).

### Development

```bash
# Start dev server on port 8080 with request logging
bun run dev

# Dev server with persistent log (for sandbox environments)
bun run dev 2>&1 | tee /tmp/dev.log
```

### Production Build

```bash
# Production build — outputs to .next/standalone
bun run build

# Start production server via Bun (not node)
bun run start
```

### Database Operations

```bash
# Push schema changes to SQLite (destructive in dev, use with caution)
bunx prisma db push

# Regenerate the Prisma client after schema changes
bunx prisma generate

# Create a named migration
bunx prisma migrate dev --name describe-your-change

# Apply pending migrations (production)
bunx prisma migrate deploy

# Open Prisma Studio (database GUI)
bunx prisma studio
```

### Type Checking & Linting

```bash
# Type check without emitting
bunx tsc --noEmit

# Lint
bun run lint

# Lint with auto-fix
bun run lint --fix
```

---

## 9. Testing Checklist for Next.js Developer

Use this checklist for every new feature or change. No PR should be merged without satisfying all applicable items.

### API Routes

- [ ] Test with `fetchJson<T>()` from a component — verify happy path
- [ ] Test error cases (missing `tenantId`, invalid body, missing required fields)
- [ ] Verify `tenantId` isolation — data from tenant A is never visible to tenant B
- [ ] Test with empty result sets (no agents, no incidents, etc.)
- [ ] Verify HTTP status codes: 200 for success, 201 for creation, 400 for bad input, 404 for not found, 500 for server errors
- [ ] Test with malformed JSON body

### Components

- [ ] **Loading state:** Show skeleton/spinner while data is being fetched
- [ ] **Empty state:** Show meaningful message with icon when data set is empty
- [ ] **Error state:** Show error message with retry button when fetch fails
- [ ] Verify component renders correctly when data arrives after initial mount (race condition)
- [ ] Test with `null` and `undefined` data gracefully

### Mutations

- [ ] `onSuccess` callback invalidates relevant query keys
- [ ] `onError` callback displays error toast with meaningful message
- [ ] Optimistic updates (if used) roll back on error
- [ ] Button shows loading spinner during mutation
- [ ] Form resets after successful submission

### Mobile Responsiveness

Test at these breakpoints:

| Breakpoint | Width | What to Check |
|------------|-------|---------------|
| Mobile     | 375px | Sidebar hidden, single-column layouts, touch targets ≥44px |
| Tablet     | 768px | Sidebar overlay or collapsed, two-column grids |
| Desktop    | 1024px | Full sidebar, multi-column grids |
| Wide       | 1440px | Content doesn't stretch beyond max-width |

### Keyboard Navigation & Accessibility

- [ ] Interactive elements (not native buttons/links) have `tabIndex={0}` and `role="button"`
- [ ] `onKeyDown` handlers respond to `Enter` and `Space` for custom interactive elements
- [ ] `aria-label` on icon-only buttons and interactive elements
- [ ] `aria-live="polite"` on dynamic content regions (toasts, alert counts)
- [ ] `focus-visible` ring styling on all focusable elements
- [ ] Dialog traps focus and returns focus on close
- [ ] Color contrast meets WCAG AA (4.5:1 for normal text, 3:1 for large text)

---

## 10. Code Quality Standards

These are hard rules. Code reviews will reject violations.

### TypeScript

| Rule | Description |
|------|-------------|
| No `any` | Use proper interfaces, `Record<string, unknown>`, or generic types |
| No unused imports | Remove every unused import before committing |
| No unused variables | Prefix with `_` if intentionally unused (e.g., `_e` in catch) |
| Strict null checks | Handle `undefined` and `null` explicitly |
| Explicit return types | Not required but encouraged for complex functions |

### Error Handling

| Rule | Description |
|------|-------------|
| No silent catches | Every `catch` block must have `console.error()` at minimum |
| All mutations have `onError` | User must see feedback on failure |
| All `fetchJson` calls wrapped | Either in `useQuery`/`useMutation` or in try/catch |

### API Communication

| Rule | Description |
|------|-------------|
| Use `fetchJson<T>()` | Never raw `fetch` |
| `tenantId` as query param | Never in request body |
| Type all responses | `fetchJson<Agent[]>('/api/agents?...')` |

### Component Quality

| Rule | Description |
|------|-------------|
| Loading state | Skeleton or spinner while data loads |
| Empty state | Icon + message when no data |
| Error state | Error message + retry action |
| Use shadcn/ui | No custom `<button>`, `<input>`, `<select>` — use the `ui/` primitives |
| Responsive | Must work at 375px–1440px |
| Accessible | aria-labels, focus management, keyboard support |

### Commit Hygiene

- Run `bunx tsc --noEmit` before committing — zero errors
- Run `bun run lint --fix` before committing — zero warnings
- Test the specific feature at mobile (375px) and desktop (1440px) widths
- Verify all mutations show error toasts on failure

---

## Quick Reference Card

```
# Start developing
bun run dev

# After schema changes
bunx prisma db push && bunx prisma generate

# Type check
bunx tsc --noEmit

# API call pattern
const data = await fetchJson<MyType>('/api/resource?tenantId=xxx');

# Route pattern
export async function GET(req: Request) {
  const tenant = await resolveTenant(req);
  const data = await db.resource.findMany({ where: { tenantId: tenant.id } });
  return Response.json(data);
}

# Query pattern
const { data, isLoading, error } = useQuery({
  queryKey: ['resource'],
  queryFn: () => fetchJson<MyType[]>('/api/resource?tenantId=xxx'),
  refetchInterval: 30000,
});

# Mutation pattern
const mutation = useMutation({
  mutationFn: (input) => fetchJson<MyType>('/api/resource?tenantId=xxx', {
    method: 'POST', body: JSON.stringify(input),
  }),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['resource'] }),
  onError: (err) => toast.error(err.message),
});
```

---

*This document is the authoritative reference for Next.js development on OmniVote Monitor v2.1. When in doubt, refer back to these patterns. Consistency across the codebase is a priority.*