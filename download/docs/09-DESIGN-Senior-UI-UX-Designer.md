# 09 — Senior UI/UX Designer Guide

## OmniVote Monitor v2.1 — Design System & UI/UX Specification

**Document Owner:** Senior UI/UX Designer
**Target Audience:** Designers, Frontend Engineers, QA (Visual Regression)
**Version:** 2.1
**Theme:** Dark mode (default and only mode)

---

## 1. Design System Overview

### 1.1 Visual Identity

**Platform Name:** OmniVote Monitor v2.1

**Tagline:** "Zero-Trust Architecture · AES-256 Encryption" (cosmetic badge, displayed in the header bar to reinforce the security posture of the platform to operators and stakeholders).

**Theme:** Dark mode is the default and, as of v2.1, the only mode. There is no light-mode toggle. This decision is intentional: election monitoring operations centers run continuous 12–18 hour shifts on election day, and a dark interface reduces cumulative eye strain. All design decisions below assume a dark background context.

**Primary Palette — Slate/Zinc Grays:**

| Token                  | Tailwind Class      | Hex       | Usage                                    |
|------------------------|---------------------|-----------|------------------------------------------|
| Background (app shell) | `bg-zinc-950`       | `#09090b` | Outermost app background                 |
| Surface (card/panel)   | `bg-zinc-900`       | `#18181b` | Card backgrounds, sidebar, elevated areas|
| Surface (elevated)     | `bg-zinc-800`       | `#27272a` | Inputs, dropdowns, nested cards          |
| Border (default)       | `border-zinc-800`   | `#27272a` | Card borders, dividers                   |
| Border (subtle)        | `border-zinc-700/50`| `#3f3f4680`| Hover states, active indicators         |
| Text (primary)         | `text-zinc-100`     | `#f4f4f5` | Headings, primary body text              |
| Text (secondary)       | `text-zinc-400`     | `#a1a1aa` | Descriptions, labels, muted content      |
| Text (muted)           | `text-zinc-500`     | `#71717a` | Placeholders, disabled text              |

**Accent — Emerald Green (`#10b981` / `emerald-500`):**

The emerald accent is used for positive states, active navigation, primary CTAs, and the brand identity. It is customizable per tenant via the `Tenant.primaryColor` database field, meaning multi-tenant deployments may substitute this accent with an organization-specific color. All accent references in the codebase should reference a single CSS custom property or Tailwind theme token so that tenant-level overrides propagate globally without component-level changes.

**Alert & Semantic Colors:**

| Semantic   | Tailwind Class   | Hex       | Usage                                            |
|------------|------------------|-----------|--------------------------------------------------|
| CRITICAL   | `text-red-500`   | `#ef4444` | SOS incidents, system down, security breaches    |
| SOS        | `text-red-600`   | `#dc2626` | Same as CRITICAL with pulsing animation           |
| HIGH       | `text-amber-500` | `#f59e0b` | Warning alerts, quarantined items, anomalies     |
| WARNING    | `text-amber-400` | `#fbbf24` | Same as HIGH — used interchangeably               |
| INFO       | `text-blue-500`  | `#3b82f6` | Informational notices, system messages           |
| SUCCESS    | `text-green-500` | `#22c55e` | Completed actions, healthy status, confirmed data|

These four semantic colors must be applied consistently across every component: badges, borders, icons, chart segments, table rows, and toast notifications. A severity event labeled CRITICAL must always render in red whether it appears in the live feed, the alerts panel, the map popup, or a toast.

**Typography:**

- **UI Font:** Inter (sans-serif). The primary typeface for all interface text — headings, labels, body copy, button text. Inter provides excellent legibility at small sizes on dark backgrounds due to its tall x-height and open apertures.
- **Data Font:** System monospace (`ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`). Used exclusively for numerical data, vote counts, timestamps, log entries, and code-like content (API keys, IP addresses).
- **Font Scale:** Tailwind's default type scale (`text-xs` through `text-4xl`). KPI values use `text-3xl font-bold`. Card titles use `text-sm font-medium`. Body text uses `text-sm text-zinc-400`.
- **Line Height:** Default `leading-normal` (1.5) for body; `leading-tight` (1.25) for headings; `leading-none` for KPI values to maximize information density.

### 1.2 Design Principles

**1. Information Density — High**

This is an operations center tool, not a marketing website. Operators need the maximum amount of actionable data per screen. Prefer compact spacing (`p-4`, `gap-4`) over generous whitespace. Cards should be information-rich. Tables should show 8–12 columns where context allows. The goal is to minimize the number of clicks and scrolls required to assess the election's health at a glance.

**2. Progressive Disclosure — Summary → Detail Hierarchy**

Every data domain follows a three-level hierarchy:
- **Level 1 (Overview):** KPI cards with single metrics and trend arrows. Visible on the Overview tab. Answer: "Is everything okay?"
- **Level 2 (List/Feed):** Tables, feeds, and map views. Answer: "What is happening?" Each row or item is clickable to reach Level 3.
- **Level 3 (Detail):** Expanded panels, side sheets, or dedicated detail tabs. Answer: "Tell me everything about this specific item."

Never show Level 3 data at Level 1. Never force users to drill down for Level 1 information.

**3. Color-Coded Severity — Consistent Everywhere**

Severity is the most critical dimension in election monitoring. A CRITICAL incident must be immediately recognizable regardless of which component displays it. This means:
- Same hex value for CRITICAL everywhere (no "slightly different reds").
- Text label always accompanies the color (never color-only indicators).
- Icons reinforce the color (shield for security, triangle for warning, etc.).

**4. Dark Theme — Reduce Eye Strain**

All 21 tabs, 40+ components, and every state (loading, empty, error) must look correct on a dark background. No component should ever render white backgrounds, light gray text on white, or any assumption of a light theme. This is the only mode.

**5. Mobile-First — Field Agents Use Phones**

The same codebase serves two very different user contexts:
- **Field Agents:** Mobile phones (Android/iOS), potentially in areas with poor connectivity. They submit incident reports, view their assignments, and check safety alerts. Their experience must be touch-optimized with large tap targets (minimum 44×44px), full-width forms, and card-based layouts (no wide tables).
- **Operations Center:** Large monitors (24–32 inches), sometimes multiple screens. They need dense dashboards, wide tables, and side-by-side panel layouts.

Responsive design is not optional — it is a core architectural requirement.

### 1.3 Component Library (shadcn/ui)

The project uses **shadcn/ui**, which provides 40+ Radix UI primitives wrapped in Tailwind CSS. Key characteristics:

- **Dark variant by default:** Every shadcn/ui component is configured for dark mode out of the box via Tailwind's `dark:` prefix or by using dark-aware CSS variables.
- **Consistent border-radius:** `rounded-lg` (8px) for cards, panels, and containers. `rounded-md` (6px) for inputs, buttons, and badges. `rounded-full` for avatars and status dots.
- **Consistent spacing:** `p-4` (16px) for compact cards, `p-6` (24px) for standard cards, `gap-4` (16px) for grid gaps. These values are not arbitrary — they create a visual rhythm that users learn to parse subconsciously.
- **Customization approach:** shadcn/ui components are copied into the project (not installed as a dependency). This means they can be freely modified. Any modification should maintain the existing API surface so that updates from upstream shadcn/ui can be merged without breaking changes.

---

## 2. Layout Architecture

### 2.1 Desktop Layout (>1024px)

```
┌──────────────────────────────────────────────────────────┐
│  HEADER                                                  │
│  [Election Badge: "2027 General"]  [Search] [🔔] [User] │
├──────────┬───────────────────────────────────────────────┤
│          │                                               │
│ SIDEBAR  │            MAIN CONTENT AREA                  │
│ (240px)  │            (scrollable, flex-1)               │
│          │                                               │
│ ──────── │  Content is determined by activeTab state      │
│ Overview │  managed in Zustand. Only one tab renders      │
│ Situation│  at a time (conditional rendering).            │
│ Map      │                                               │
│ Live Feed│  Layout within main area varies per tab:       │
│ Alerts   │  - Overview: 4-col KPI grid + 2-col charts    │
│ OSINT    │  - Situation Room: breadcrumb + stacked panels│
│ AI       │  - Live Feed: single scrollable list           │
│ Media    │  - Map: full-bleed Leaflet map + overlay panel│
│ ...      │  - Submit Report: form (1-2 col responsive)   │
│          │  - System Health: grid of status cards         │
│ ──────── │                                               │
│ 21 nav   │                                               │
│ items,   │                                               │
│ role-    │                                               │
│ filtered │                                               │
│          │                                               │
├──────────┴───────────────────────────────────────────────┤
│  (No footer — content fills viewport height via h-screen)│
└──────────────────────────────────────────────────────────┘
```

**Header:** Fixed at top, full width. Contains the election context badge (so operators always know which election they are monitoring), a global search input, notification bell (with unread count badge), and the user avatar/menu. Height: approximately 56px (`h-14`).

**Sidebar:** Fixed on the left, 240px wide. Contains 21 navigation items organized into 6 labeled sections. Items are filtered by the current user's RBAC role — a Field Agent sees only "Submit Report" and "My Reports"; a Super Admin sees all 21. Active item is highlighted with the emerald accent (left border + background tint + text color).

**Main Content:** Fills the remaining horizontal and vertical space. Scrollable independently. Content swaps via Zustand's `activeTab` state. Each tab renders its own component tree.

**No Footer:** The viewport is fully utilized. Footer content (if any, like version numbers) is embedded in the sidebar bottom area.

### 2.2 Mobile Layout (<768px)

On screens below 768px, the layout undergoes significant restructuring:

- **Sidebar:** Collapses completely. Navigation moves to either a bottom tab bar (showing 4–5 most-used items) or a hamburger menu that slides in as an overlay. The bottom bar is preferred for Field Agent roles (fewer tabs, frequent switching).
- **Header:** Simplifies to: election badge (abbreviated), notification bell, user avatar. Search moves behind an icon tap.
- **Content:** Takes full width. No side panels.
- **Cards:** Stack vertically in single column.
- **Tables:** Transform into card lists. Each table row becomes a compact card showing the 2–3 most important fields, with a tap to expand the full row data.
- **Map:** Takes full viewport height. Controls move to a floating action button (FAB) or bottom sheet.
- **Charts:** Stack vertically. Consider switching complex charts (Sankey, heatmap) to simplified alternatives or summary numbers on very small screens.
- **Forms:** Single column, full-width inputs, sticky submit button at bottom.

### 2.3 Responsive Breakpoints

| Breakpoint | Width   | Layout Change                              |
|------------|---------|---------------------------------------------|
| `sm`       | 640px   | Large phones — two-column card grids possible|
| `md`       | 768px   | Tablets — sidebar still hidden, wider cards |
| `lg`       | 1024px  | Small laptops — **sidebar appears**, 4-col KPI grid |
| `xl`       | 1280px  | Desktops — full layout, comfortable table widths |
| `2xl`      | 1536px  | Large monitors / operations center — maximum density |

The most critical breakpoint is `lg` (1024px) because it triggers the sidebar and fundamentally changes the layout paradigm from mobile-first to desktop.

---

## 3. Component Design Specifications

### 3.1 KPI Cards

KPI cards are the primary summary widgets, displayed prominently on the Overview tab and potentially on other summary views.

**Grid Layout:**
- Desktop (≥1024px): 4 columns (`grid-cols-4`)
- Tablet (768–1023px): 2 columns (`grid-cols-2`)
- Mobile (<768px): 1 column (`grid-cols-1`)

**Card Anatomy:**
```
┌─────────────────────────────────┐
│  [Icon]  12,847          ▲ 3.2%│
│          Total Voters Registered │
└─────────────────────────────────┘
```

- **Icon:** 24×24px, emerald-500 color (or semantic color if the KPI represents a severity metric). Positioned left.
- **Value:** `text-3xl font-bold text-zinc-100` (or `font-mono` for counts). This is the dominant visual element — it must be scannable at arm's length on a large monitor.
- **Label:** `text-xs text-zinc-500 uppercase tracking-wide` beneath the value.
- **Trend Indicator:** Up arrow (green) or down arrow (red) with percentage. Uses `text-xs font-medium`. Only shown when trend data is available.
- **Subtle glow:** A very faint `shadow-emerald-500/10` or equivalent box-shadow in the accent color gives the card a slight luminance, reinforcing the dark-theme aesthetic. This must be subtle — not a neon glow.
- **Hover state:** `transform: scale(1.02)` with a short transition (150ms). No other hover effects — the card is read-only.
- **Border:** `border border-zinc-800 rounded-lg`
- **Background:** `bg-zinc-900`
- **Padding:** `p-4`

### 3.2 Data Tables

Tables are used across multiple tabs: Agents, Alerts, Reports, Tenant Management, and more.

**Structure:**
- **Container:** `overflow-x-auto` wrapper to enable horizontal scrolling on narrow screens.
- **Header:** `bg-zinc-800/50`, `text-xs uppercase tracking-wide text-zinc-400`, `font-medium`. Each cell uses `<th>` for accessibility.
- **Rows:** Alternating backgrounds using `even:bg-zinc-800/30` for subtle differentiation. This helps the eye track across wide rows.
- **Hover:** `hover:bg-zinc-800/60` on individual rows.
- **Sortable Columns:** Clickable `<th>` elements with a small sort icon (ascending/descending indicator). Active sort column gets `text-zinc-100` instead of `text-zinc-400`.
- **Pagination:** Bottom of the table. Shows page numbers, prev/next buttons, and "Showing X–Y of Z" text. Uses shadcn/ui `Pagination` component.
- **Action Buttons:** Right-aligned column with icon buttons (view, edit, delete). Each button is `h-8 w-8` with an icon inside. Destructive actions (delete) use red icon.
- **Status Badges:** Colored pills using `rounded-full px-2 py-0.5 text-xs font-medium`. Background uses a 15% opacity version of the semantic color (e.g., `bg-red-500/15 text-red-400` for CRITICAL status).
- **Empty State:** When no data, show a centered icon + "No [items] found" message in `text-zinc-500`.

### 3.3 Incident Feed (Live Feed)

The Live Feed is a real-time scrolling list of incidents, the primary monitoring interface for operations center staff.

**Container:** Scrollable `<div>` with `max-h-[calc(100vh-12rem)]` to fill available space while respecting header and padding. Overflow-y scroll with custom scrollbar styling (thin, dark).

**Feed Item Anatomy:**
```
┃ [Timestamp]  [Type Badge]  Description text...
┃               [Status] [Quarantine] [AI Flag]
```

- **Severity Color Bar:** A 3px left border (`border-l-3`) colored by severity: red for CRITICAL, amber for HIGH/WARNING, blue for INFO, green for RESOLVED. This is the primary scanning cue — operators can assess the feed's health by the color distribution of the left border.
- **Timestamp:** `text-xs text-zinc-500 font-mono` in "HH:MM:SS" format (relative time like "2m ago" is also acceptable).
- **Type Badge:** Small pill (`rounded-full px-2 py-0.5 text-xs`) indicating the incident category (Security, Operational, Medical, etc.).
- **Description:** `text-sm text-zinc-300`. Truncated to 2 lines with ellipsis. Full text visible on expand.
- **Status Badge:** Colored pill (same system as table status badges).
- **Quarantine Badge:** Amber pill with a shield icon. Indicates the incident has been quarantined for further investigation.
- **AI Flag:** Small badge (e.g., `bg-purple-500/15 text-purple-400`) indicating AI-detected anomaly or auto-classification.
- **Expand/Collapse:** Clicking a feed item expands it to show full details: description, affected polling unit, assigned agent, response actions taken, timeline of updates.
- **Load More:** Button at the bottom: `text-sm text-emerald-500 hover:underline` — "Load older incidents".

### 3.4 Alert Triage

The Alerts tab provides a more structured, filterable view of alerts compared to the real-time feed.

**Tab Filters:** Horizontal tab bar at the top: `ALL` | `OPERATIONAL` | `SECURITY`. Active tab uses emerald underline. Counts displayed in each tab (e.g., "SECURITY (23)").

**Alert List Item:**
- **Category Icon:** 16×16px, colored by category (shield for security, gear for operational).
- **Title:** `text-sm font-medium text-zinc-100`. Truncated to one line.
- **Timestamp:** `text-xs text-zinc-500`.
- **Read/Unread Indicator:** Unread items have a small emerald dot or slightly brighter background. Read items are `text-zinc-400`.
- **Mark as Read:** Per-item action (click to toggle). Bulk action: checkbox selection + "Mark Selected as Read" button in a floating action bar.
- **Color Coding:**
  - INFO: `text-blue-500`, blue left border
  - WARNING: `text-amber-500`, amber left border
  - CRITICAL: `text-red-500`, red left border
  - SOS: `text-red-600` with a `animate-pulse` effect on the border and badge to draw immediate attention. No other severity level should pulse — this is reserved exclusively for SOS.

### 3.5 Map (Leaflet)

The map is a full-bleed Leaflet map instance showing polling unit locations and statuses.

**Basemap:** CARTO `dark_all` tile layer. This is a dark-themed basemap that integrates seamlessly with the application's color scheme. No light basemap is used.

**Markers:** `L.circleMarker` for each polling unit. Size can represent voter count or turnout percentage (scaled to a reasonable range). Colors:
- **OPEN:** `#22c55e` (green-500) — Polling unit is active, no issues.
- **PENDING:** `#3b82f6` (blue-500) — Awaiting opening or results.
- **CLOSED:** `#71717a` (zinc-500) — Polling unit has closed for the day.
- **FLAGGED:** `#ef4444` (red-500) — Incident reported at this location.

**Selected Marker:** When a marker is clicked, it enlarges (radius increase by 50%), gains a white stroke, and a popup appears.

**Popup Content:**
- Polling Unit name
- PU Code
- Registered voters (monospace)
- Turnout percentage
- Current status (colored badge)
- "View Details" link (navigates to Situation Room for that PU)

**Legend:** Fixed overlay in the bottom-right corner of the map showing the four color meanings.

### 3.6 Charts (Recharts)

All charts use Recharts and must follow the dark theme color scheme.

**Bar Charts:**
- Used for: Party results comparison, OSINT mentions by platform, incident counts by category.
- Bars use the semantic palette (emerald for leading, slate for others, red for flagged).
- Axis labels: `text-xs text-zinc-500`.
- Grid lines: `stroke-zinc-800` (very subtle).
- Tooltip: Dark background (`bg-zinc-800`), `border-zinc-700`, white text. Custom tooltip component.

**Line Charts:**
- Used for: Time-series trends (incidents over time, voter turnout progression, system performance metrics).
- Lines use emerald or semantic colors. Multiple lines must be visually distinguishable (not just by color — use dashed lines or different stroke widths as secondary differentiators).
- Area fill: Optional, with 10% opacity gradient.

**Sankey Diagram:**
- Used for: PVT (Parallel Vote Tabulation) vote flow visualization showing state → party distribution.
- Custom implementation (Recharts does not have a native Sankey). Consider a dedicated library like `recharts-sankey` or a custom SVG implementation.
- Node colors match party affiliation colors. Flow width represents vote count.

**Heatmap (CSS Grid):**
- Used for: Flashpoint risk scores across LGAs/wards.
- **Not a chart library component** — implemented as a CSS grid of colored cells.
- Each cell represents a geographic unit. Background color interpolates from green (low risk) through amber (medium) to red (high) based on the risk score.
- Cell hover shows the unit name and exact score in a tooltip.

### 3.7 Forms (Field Agent)

Field agents use forms to submit incident reports. These must be optimized for mobile, offline-capable contexts.

**Layout:**
- Mobile: Single column, full-width inputs.
- Desktop: Two-column grid for shorter fields (type, severity, polling unit), full-width for description textarea.
- Sticky submit button at the bottom on mobile (always visible, even when scrolling the form).

**Form Fields:**
- **Incident Type:** Select dropdown with predefined categories.
- **Severity:** Radio group or segmented control (LOW / MEDIUM / HIGH / CRITICAL).
- **Polling Unit:** Select dropdown, pre-populated from the agent's assigned polling unit(s).
- **Description:** Textarea, minimum 50 characters for quality.
- **GPS Location:** Auto-filled from the assigned polling unit coordinates. Read-only field with a "Refresh GPS" button for manual override.
- **Media Attachments:** Photo/video upload with preview thumbnails. Camera integration on mobile (direct capture, not just file picker).
- **Submit Button:** `bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-md px-6 py-3`. Full-width on mobile. Shows loading spinner during submission.

---

## 4. Interaction Design Patterns

### 4.1 Navigation

**Sidebar Navigation:**
- Clicking a nav item sets `activeTab` in Zustand store.
- The main content area conditionally renders the corresponding tab component.
- Active nav item is highlighted: emerald left border (`border-l-2 border-emerald-500`), tinted background (`bg-emerald-500/10`), and bright text (`text-emerald-400`).
- Navigation is instant — no page reloads, no route changes (this is a single-page application with client-side tab switching).

**Global Search:**
- Type a query in the header search input → press Enter.
- The system infers the most relevant tab from keywords (e.g., "incident" → Live Feed, "agent" → Agents, "alert" → Alerts) and auto-navigates.
- Future improvement: real-time search suggestions dropdown as the user types.

**Breadcrumb Navigation (Situation Room):**
- Hierarchical breadcrumb: `National → Region → State → LGA → Ward`
- Each segment is clickable to navigate up the hierarchy.
- Uses shadcn/ui `Breadcrumb` component.
- Breadcrumb updates as the user drills down into geographic levels.

**Back Navigation:**
- Browser back button works correctly because `activeTab` changes can be synced with URL search params (`?tab=live-feed`).
- Zustand state persists across navigation, so returning to a tab shows the same data/filter state.

### 4.2 Feedback Mechanisms

**Toast Notifications (Sonner):**
- Success: Green icon, green border-left accent. Auto-dismiss after 4 seconds.
- Error: Red icon, red border-left accent. Requires manual dismiss (stays until the user acknowledges).
- Info: Blue icon, blue border-left accent. Auto-dismiss after 6 seconds.
- Position: Bottom-right corner (desktop), bottom-center (mobile).

**Loading States:**
- **Skeleton Loaders:** Preferred for content that has a predictable layout (cards, tables, lists). Use `bg-zinc-800 animate-pulse` with the same dimensions as the expected content.
- **Spinners:** Acceptable for indeterminate wait times (API calls with unknown duration). Use the shadcn/ui `Spinner` component, centered in the content area.
- **Progress Bars:** For file uploads and batch operations.

**Empty States:**
- Centered layout: icon (48×48px, `text-zinc-600`) + message (`text-sm text-zinc-500`) + optional CTA button.
- Messages should be contextual, not generic. Example: "No incidents reported in your assigned polling units" rather than "No data found".

**Error States:**
- Error message in `text-red-400 text-sm` explaining what went wrong.
- "Retry" button that re-triggers the failed operation.
- For critical errors (network down, auth expired), a full-page error state with a more prominent message and "Return to Dashboard" action.

**Optimistic Updates:**
- Mutations (creating an incident, marking an alert as read) should update the UI immediately (optimistic) and roll back if the API call fails.
- Rollback triggers an error toast and reverts the UI to its previous state.

### 4.3 Data Entry Patterns

**Validation:**
- Zod schemas define all validation rules server-side and client-side.
- Inline error messages appear below each invalid field in `text-red-400 text-xs`.
- Form-level error summary at the top if multiple fields are invalid.
- Validation runs on blur (when the user leaves a field) and on submit.

**Auto-Save:**
- There is no auto-save. All data entry requires an explicit "Submit" button press.
- Rationale: Field agents may be entering sensitive incident data and should have full control over when it is transmitted (especially in low-bandwidth environments).

**Confirmation Dialogs:**
- Destructive actions (delete incident, remote wipe device, deactivate agent) require an `AlertDialog` confirmation.
- Dialog text clearly states the consequence: "This will permanently delete this incident report. This action cannot be undone."
- Confirm button is red (`bg-red-600 hover:bg-red-500`).

**Multi-Step Flows:**
- Wargame scenarios and complex onboarding flows use a stepper component.
- Each step has a title, description, and content area.
- "Back" and "Next" buttons. "Next" validates the current step before proceeding.
- Progress indicator (e.g., "Step 2 of 5") shown at the top.

---

## 5. Accessibility (Current State)

### 5.1 What Exists

- **Keyboard Navigation:** `tabIndex`, `role="button"`, and `Enter`/`Space` key handlers have been added to interactive elements that are not native `<button>` or `<a>` tags (e.g., custom sidebar nav items, feed items, map markers).
- **Focus Management:** All interactive elements have a `focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950` style for keyboard focus indication. This uses the emerald accent color.
- **Semantic HTML:** Forms use proper `<label>` elements. Lists use `<ul>`/`<li>`. Headings follow `h1` → `h3` hierarchy within each tab.

### 5.2 Accessibility Gaps

The following gaps have been identified and should be addressed in priority order:

1. **No skip-to-content link.** Screen reader and keyboard users must tab through all sidebar items before reaching the main content. A "Skip to main content" link should be the first focusable element on the page, visible on focus only.

2. **No `aria-live` regions for dynamic content.** The Live Feed and Alerts tab receive new items via real-time subscriptions, but screen readers are not notified of these additions. An `aria-live="polite"` region should wrap the feed list so new items are announced. An `aria-live="assertive"` region should be reserved for SOS/critical alerts.

3. **No screen reader announcements for new incidents.** Beyond `aria-live`, a custom announcement mechanism (e.g., `aria-announce` or a visually hidden live region) should be used to proactively notify screen reader users of high-severity incidents.

4. **No high-contrast mode.** While the dark theme is intentional, some users with low vision may need higher contrast ratios. A toggle for increased contrast (e.g., `text-zinc-50` instead of `text-zinc-400` for secondary text) should be considered.

5. **No font size scaling.** The interface does not provide a built-in font size control. Users who need larger text must rely on browser zoom, which may break layouts. A font scale setting (Small / Default / Large) in the user preferences would improve usability.

6. **Complex tables without proper `<thead>`/`<th>`.** Some data tables may be using `<div>`-based layouts rather than semantic `<table>` elements. All tabular data must use proper `<table>` → `<thead>` → `<th>` → `<tbody>` → `<tr>` → `<td>` structure for screen reader compatibility.

7. **Modal focus trapping not verified.** When an `AlertDialog` or sheet opens, focus should be trapped within the modal. When the modal closes, focus should return to the trigger element. This must be audited for all modal-like components.

8. **Color-only severity indicators.** Severity is communicated partly through color alone (red left border on feed items, colored dots). Every color indicator must be accompanied by a text label or icon that conveys the same information non-visually. For example, a red left border should have an `aria-label="Critical severity"` on the container.

9. **`prefers-reduced-motion` not respected.** Several components use Framer Motion animations (page transitions, list item entrances, hover effects). These should check `prefers-reduced-motion: reduce` and disable or simplify animations for users who have requested reduced motion in their OS settings.

10. **No keyboard shortcuts documentation.** Power users (operations center staff) would benefit from keyboard shortcuts (e.g., `Ctrl+K` for search, `1`–`9` for tab switching). If implemented, these must be documented and should not conflict with screen reader shortcuts.

---

## 6. Information Architecture

The 21 tabs are organized into 6 logical sections in the sidebar. Each section has a labeled header (non-clickable) that groups related functionality:

### Section 1: Command Center
| Tab | Icon | Description | Primary Audience |
|-----|------|-------------|-----------------|
| Overview | LayoutDashboard | KPI cards, summary charts, system status | All roles |
| Situation Room | MapPin | Hierarchical drill-down: National → State → LGA → Ward → PU | Analyst+, Admin |
| Map | Map | Full-bleed Leaflet map with polling unit markers | Analyst+, Admin |
| Live Feed | Activity | Real-time scrolling incident feed | All roles |
| Alerts | Bell | Filterable alert triage list | All roles |

### Section 2: Intelligence
| Tab | Icon | Description | Primary Audience |
|-----|------|-------------|-----------------|
| OSINT | Globe | Social media monitoring, keyword tracking, platform breakdowns | Intel Officer, Admin |
| AI Insights | Brain | AI-detected anomalies, pattern analysis, predictions | Intel Officer, Admin |
| Media Gallery | Image | Uploaded photos, videos, and documents from field agents | All roles |

### Section 3: Operations
| Tab | Icon | Description | Primary Audience |
|-----|------|-------------|-----------------|
| Mobilization | Users | Voter mobilization tracking and metrics | Ops Manager, Admin |
| Campaigns | Megaphone | Campaign activity monitoring | Ops Manager, Admin |
| Security | Shield | Security incident management and response | Security Officer, Admin |
| Field Safety | Heart | Field agent safety status and emergency contacts | All roles |
| Agents | UserCheck | Field agent management (assignment, status, communication) | Ops Manager, Admin |
| Engagement | MessageSquare | Citizen engagement and communication logs | Ops Manager, Admin |

### Section 4: Field
| Tab | Icon | Description | Primary Audience |
|-----|------|-------------|-----------------|
| Submit Report | FilePlus | Incident report submission form | Field Agent |
| My Reports | FileText | Field agent's submitted report history | Field Agent |

### Section 5: Admin
| Tab | Icon | Description | Primary Audience |
|-----|------|-------------|-----------------|
| System Health | Server | Infrastructure health, API status, database metrics | Super Admin |
| Tenant Management | Building2 | Multi-tenant configuration (branding, accent colors, feature flags) | Super Admin |

### Section 6: Analytics
| Tab | Icon | Description | Primary Audience |
|-----|------|-------------|-----------------|
| PVT | BarChart3 | Parallel Vote Tabulation — expected vs. reported results | Analyst+, Admin |
| Evidence | FileCheck | Evidence collection and chain-of-custody tracking | Analyst+, Admin |
| Flashpoint | Flame | LGA/Ward risk heatmap and flashpoint prediction | Analyst+, Admin |
| Honeypot | Bug | Honeypot/decoy monitoring for detecting manipulation attempts | Security Officer, Admin |

**RBAC Filtering:** The sidebar renders only the tabs the current user's role is permitted to access. Role definitions:
- **Field Agent:** Submit Report, My Reports, Alerts (read-only), Field Safety
- **Analyst:** All Command Center + Intelligence (read OSINT) + Analytics
- **Operations Manager:** All Command Center + Operations + Field (view-only)
- **Security Officer:** All Command Center + Security, Field Safety, Honeypot
- **Super Admin:** All 21 tabs

---

## 7. Design Recommendations

### 7.1 Immediate Improvements (Sprint-Level)

These are changes that can be implemented within a single development sprint (1–2 weeks) and have immediate usability impact:

1. **Add a skip-to-content link.** First focusable element on the page. `<a href="#main-content" class="sr-only focus:not-sr-only ...">Skip to main content</a>`. Attach `id="main-content"` to the main content area. This is a 15-minute fix with significant accessibility impact.

2. **Add `aria-live` regions.** Wrap the Live Feed list in `<div aria-live="polite" aria-label="Live incident feed">`. Add a visually hidden `<div aria-live="assertive" aria-atomic="true">` for SOS alerts. This ensures screen reader users are notified of new incidents without polling the page.

3. **Audit color contrast ratios.** Using a tool like axe DevTools or the Chrome DevTools contrast checker, verify that all text meets WCAG AA (4.5:1 for normal text, 3:1 for large text). Specific concerns:
   - `text-zinc-500` on `bg-zinc-900` — verify this meets 4.5:1
   - `text-zinc-400` on `bg-zinc-900` — verify this meets 4.5:1
   - Status badge text on colored backgrounds — verify contrast
   - If any combination fails, adjust the text or background color until it passes.

4. **Add `prefers-reduced-motion` support.** In the global CSS or in each Framer Motion animation configuration, add:
   ```css
   @media (prefers-reduced-motion: reduce) {
     *, *::before, *::after {
       animation-duration: 0.01ms !important;
       animation-iteration-count: 1 !important;
       transition-duration: 0.01ms !important;
       scroll-behavior: auto !important;
     }
   }
   ```

5. **Replace spinners with skeleton loaders.** For content areas with predictable layouts (KPI cards, table rows, feed items), replace the generic loading spinner with skeleton loaders that match the content's shape. This reduces perceived load time and provides visual stability.

### 7.2 Medium-Term Improvements (Quarter-Level)

These require more design work and development effort but significantly improve the platform's maturity:

1. **Design a light theme variant.** While dark mode is the default, field agents working outdoors in bright sunlight may struggle with dark backgrounds. A light theme variant (toggleable in user preferences) would improve outdoor usability. This requires:
   - Defining light-mode tokens for every color in the palette
   - Testing all 40+ components in light mode
   - Ensuring the map basemap can switch (or finding a light CARTO basemap)

2. **Create a design token system.** Extract all color, spacing, typography, and border-radius values into CSS custom properties. This enables:
   - Tenant-level theming without code changes
   - Theme switching (dark/light) by swapping a single class
   - Consistency enforcement via linters

3. **Build a Figma component library.** Create a Figma file that mirrors every component in the codebase. This enables:
   - Designers to create mockups that are pixel-accurate to the implementation
   - Stakeholder reviews without building prototypes
   - Onboarding new designers quickly

4. **Improve data visualization accessibility.** Charts should include:
   - Keyboard-accessible data points (focusable SVG elements)
   - Screen reader-friendly data tables as alternatives or supplements
   - Patterns/textures in chart segments (not just color) for color-blind users
   - Clear axis labels and legends

5. **Mobile app design for field agents.** While the responsive web app works on mobile, a dedicated mobile app (or PWA with native-like interactions) would provide:
   - Offline-first architecture (critical for areas with poor connectivity)
   - Native camera integration for photo/video capture
   - Push notifications for safety alerts
   - Background location tracking for agent safety

### 7.3 Long-Term Vision (Roadmap-Level)

These are aspirational features that would differentiate the platform:

1. **Customizable dashboards.** Allow operations center staff to drag-and-drop widgets (KPI cards, charts, feeds, map) to create personalized dashboard layouts. Each user's layout persists via localStorage or database. This addresses the reality that different roles prioritize different information.

2. **Real-time collaboration.** Multiple analysts should be able to view the same data simultaneously with presence indicators (colored cursors or avatars showing who else is viewing a specific incident or geographic area). This enables collaborative analysis during high-tempo election events.

3. **Map-based incident reporting.** Field agents should be able to tap on the map at their current location to create an incident, pre-filling the GPS coordinates and nearest polling unit. This is faster and more accurate than manually entering location data.

4. **Voice-to-text incident reporting.** In high-stress situations, typing may not be feasible. A voice-to-text input (using the Web Speech API or a cloud service) would allow field agents to dictate incident descriptions hands-free.

5. **Augmented reality (AR) for polling unit verification.** Using the device camera and GPS, field agents could point their phone at a polling unit to verify its identity against the database, view assigned agent information, and overlay real-time status data. This is a significant technical undertaking but would be a transformative feature for field operations.

---

## 8. Design File Structure

The design system is implemented across the following files in the codebase:

```
src/
├── app/
│   └── globals.css          # Tailwind v4 config, CSS custom properties,
│                            # dark theme variables, custom scrollbar styles,
│                            # animation keyframes, @layer directives
│
├── components/
│   ├── ui/                  # 40+ shadcn/ui primitives (Button, Card, Dialog,
│   │                        # Table, Badge, Select, Input, Textarea, Sheet,
│   │                        # Skeleton, Tooltip, AlertDialog, Tabs, etc.)
│   │                        # Each is a self-contained .tsx file with dark
│   │                        # theme as default variant.
│   │
│   └── dashboard/           # 27 feature components, organized by tab:
│        ├── Header.tsx          # Top bar with election badge, search, bell, user
│        ├── Sidebar.tsx         # 21-item nav, role-filtered, section headers
│        ├── OverviewTab.tsx     # KPI grid + summary charts
│        ├── SituationRoomTab.tsx # Hierarchical geographic drill-down
│        ├── MapTab.tsx          # Leaflet map with polling unit markers
│        ├── LiveFeedTab.tsx     # Real-time incident feed
│        ├── AlertsTab.tsx       # Filterable alert triage
│        ├── KPICard.tsx         # Reusable KPI card component
│        ├── IncidentFeedItem.tsx # Single feed item (severity bar, badges, expand)
│        ├── DataTable.tsx       # Reusable data table wrapper
│        ├── ... (remaining 16 components)
│        └── ... (form components for field agents)
│
└── lib/
    └── utils.ts             # cn() utility — merges Tailwind classes with
                             # clsx + tailwind-merge. Used in every component
                             # for conditional class application.
```

**Key Conventions:**
- All components use the `cn()` utility for conditional class names. Never concatenate strings or use template literals for Tailwind classes — always use `cn("base-class", condition && "conditional-class")`.
- Components accept a `className` prop for parent-level overrides.
- Dark theme colors are hardcoded (not using `dark:` prefix) because dark is the only mode. This avoids unnecessary class complexity.
- The emerald accent is referenced as `emerald-500` / `emerald-600` directly. A future design token migration would replace these with a single `--color-accent` variable.

---

## Appendix: Quick Reference

### Color Usage Summary

| Context                | Color         | Tailwind         |
|------------------------|---------------|------------------|
| App background         | Near-black    | `bg-zinc-950`    |
| Card surface           | Dark gray     | `bg-zinc-900`    |
| Elevated surface       | Medium gray   | `bg-zinc-800`    |
| Primary text           | Near-white    | `text-zinc-100`  |
| Secondary text         | Medium gray   | `text-zinc-400`  |
| Muted text             | Dark gray     | `text-zinc-500`  |
| Accent / Active / CTA  | Emerald       | `emerald-500`    |
| Borders                | Dark gray     | `border-zinc-800`|
| CRITICAL / SOS         | Red           | `red-500/600`    |
| HIGH / WARNING         | Amber         | `amber-500/400`  |
| INFO                   | Blue          | `blue-500`       |
| SUCCESS                | Green         | `green-500`      |

### Spacing Summary

| Element           | Padding  | Gap   | Border Radius |
|-------------------|----------|-------|---------------|
| Compact card      | `p-4`    | —     | `rounded-lg`  |
| Standard card     | `p-6`    | —     | `rounded-lg`  |
| Grid gap          | —        | `gap-4` | —           |
| Section spacing   | —        | `gap-6` | —           |
| Input field       | `p-2`    | —     | `rounded-md`  |
| Button            | `px-4 py-2` | — | `rounded-md`  |
| Badge / Pill      | `px-2 py-0.5` | — | `rounded-full` |

### Font Size Summary

| Element          | Size        | Weight   | Additional         |
|------------------|-------------|----------|--------------------|
| KPI Value        | `text-3xl`  | `bold`   | `font-mono` optional |
| Page Title       | `text-2xl`  | `bold`   | `text-zinc-100`    |
| Section Title    | `text-lg`   | `semibold` | `text-zinc-100`  |
| Card Title       | `text-sm`   | `medium` | `text-zinc-100`    |
| Body Text        | `text-sm`   | `normal` | `text-zinc-400`    |
| Label / Caption  | `text-xs`   | `medium` | `text-zinc-500 uppercase tracking-wide` |
| Data / Numbers   | `text-sm`   | `normal` | `font-mono text-zinc-300` |