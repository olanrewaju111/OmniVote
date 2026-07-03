# UX Research & Evaluation Guide — OmniVote Monitor v2.1

**Document ID:** 13-UX
**Role:** Senior User Experience Specialist
**Version:** 2.1
**Classification:** Internal — UX Research & Evaluation
**Last Updated:** 2025-07-11

---

## Overview

This document serves as the definitive UX research and evaluation guide for OmniVote Monitor v2.1 — a dark-themed election monitoring dashboard featuring 21 tabs, 5 RBAC roles, and a user base that spans from tech-savvy operations center analysts to field agents on low-end smartphones in rural Nigeria with intermittent connectivity. It provides a structured framework for user research, heuristic evaluation, critical journey mapping, information architecture assessment, mobile-specific analysis, cognitive load evaluation, usability testing protocols, and prioritized UX recommendations.

---

## 1. User Research Framework

### 1.1 User Segments & Contexts

OmniVote Monitor serves five distinct user segments, each with fundamentally different environmental constraints, technical proficiencies, and task goals. Understanding these segments is the foundation of all UX work on this platform.

| Segment | Devices | Connectivity | Tech Literacy | Primary Need |
|---|---|---|---|---|
| **Operations Center Analysts** | Large monitors (27"+), dual-screen setups | Fast fiber/WiFi, always-on | High | Maximum information density, speed, multi-tab monitoring |
| **Field Agents (Urban)** | Mid-range smartphones (Samsung Galaxy A-series, Redmi) | 4G/5G, stable | Moderate | Speed and simplicity, quick incident submission |
| **Field Agents (Rural)** | Low-end smartphones (Tecno, Itel), Android Go | 2G/3G, intermittent, frequent dropouts | Low | Offline capability, minimal data usage, bulletproof simplicity |
| **Organization Leaders** | Tablets (iPad) and laptops | Moderate to good, occasional travel | Moderate | Executive summaries, escalation tools, big-picture awareness |
| **Trust & Safety Officers** | Desktop workstations, large screens | Fast, stable | High | Deep analysis, evidence verification, detail-oriented tools |

**Key environmental factors:**

- **Nigerian election context**: Election day is high-stress, time-critical, and emotionally charged. Users operate under pressure with real-world consequences for delays or errors.
- **Infrastructure reality**: Power outages are common. Network coverage is uneven — urban centers have 4G/5G, but rural areas in the North and South-South may only have 2G EDGE (60-120 kbps) with 500-1000ms RTT.
- **Language diversity**: Nigeria has over 500 languages. The three major ones (Hausa, Yoruba, Igbo) are not currently supported — English only.
- **Device diversity**: The platform must render correctly on everything from a 27" 4K monitor to a 5" 720p budget phone.

### 1.2 Research Methods

A mixed-methods research plan ensures both qualitative depth and quantitative rigor.

**Qualitative Methods:**

- **Contextual Inquiry**: Observe 3-5 analysts per role during mock election day scenarios. Watch how they navigate, what they ignore, where they hesitate, and what shortcuts they invent. Conduct in-the-moment "think aloud" protocols.
- **Usability Testing**: 5 users per role × 3 rounds = 75 total test sessions. Each session includes 5-8 tasks with task completion, time-on-task, and error rate metrics. Sessions recorded with screen + webcam.
- **Card Sorting**: Open card sorting with 20+ participants to validate the information architecture of 21 tabs. Follow up with closed card sorting using the proposed IA structure.
- **Tree Testing**: Validate navigation findability — can users locate specific features? Measure success rate, directness, and time.
- **Post-Election Debrief Interviews**: Semi-structured interviews with 15-20 users after live election events to capture real-world pain points and workarounds.

**Quantitative Methods:**

- **Post-Experience Survey**: Likert-scale survey (1-7) covering perceived usability, trust, confidence, and satisfaction. Deployed after each election event.
- **Product Analytics**: Heatmaps (Hotjar/FullStory), click tracking, session recording, funnel analysis for critical flows (incident submission, alert response, evidence verification).
- **Performance Monitoring**: Real User Monitoring (RUM) to capture actual load times, time-to-interactive, and network latency by user segment and geography.
- **A/B Testing**: Compare design variants for critical flows — e.g., incident submission form layouts, alert notification designs, mobile navigation patterns.

### 1.3 Key Research Questions

These questions drive all research activities and serve as success metrics:

1. **Speed**: Can a field agent on a 2G connection submit an incident report in under 60 seconds from app open to confirmation?
2. **Awareness**: Can an operations center analyst identify a CRITICAL incident within 5 seconds of it appearing in the system?
3. **Findability**: Can a tenant administrator navigate to any feature within 3 clicks from any starting position?
4. **Resilience**: How does the platform perform on a 2G EDGE connection (60-120 kbps, 500-1000ms RTT)? What is the perceived performance?
5. **Cognitive Load**: What is the cognitive load of monitoring 21 tabs simultaneously during peak election activity? Are users missing important information?
6. **Trust**: Do users trust the AI-generated insights (flashpoint scores, stego analysis, CIB detection)? What would increase trust?
7. **Error Recovery**: When users make mistakes (wrong incident type, wrong severity), how quickly and confidently can they recover?
8. **Mobile Viability**: Is the responsive web experience sufficient for field agents, or is a native app required?

---

## 2. Usability Heuristic Evaluation

Nielsen's 10 Usability Heuristics applied systematically to OmniVote Monitor v2.1. Each heuristic is evaluated with specific findings, categorized as strengths (pass) or issues (fail).

### 2.1 Visibility of System Status

The system should always keep users informed about what is going on through appropriate feedback within reasonable time.

| Finding | Status | Detail |
|---|---|---|
| Loading states present | ✅ Pass | Spinners displayed during data fetching |
| Online agent count in header | ✅ Pass | Real-time count visible in top bar |
| Alert count badge on bell icon | ✅ Pass | Unread count displayed prominently |
| Progress indicators for long operations | ❌ Fail | No progress bars for stego scans, bulk operations, or report generation |
| Real-time status updates | ❌ Fail | 30-second polling interval means status can be up to 30s stale. Users may act on outdated information |
| Connection status indicator | ❌ Fail | No visual indicator when the user goes offline. Requests may silently fail |

**Risk**: High. During election day, a 30-second delay in CRITICAL alert visibility could mean the difference between intervention and escalation. Offline agents have no feedback that their submissions are queued or failed.

### 2.2 Match Between System and Real World

The system should speak the users' language, with words, phrases, and concepts familiar to the user.

| Finding | Status | Detail |
|---|---|---|
| Election terminology | ✅ Pass | Terms like "Polling Unit," "Collation Center," "INEC," "Result Sheet" are familiar to Nigerian users |
| Geographic hierarchy | ✅ Pass | Nigerian states, LGAs, and wards hierarchy is correctly implemented |
| Political party representation | ✅ Pass | APC, PDP, LP, NNPP and other registered parties are represented |
| Technical jargon | ❌ Fail | Terms like C2PA (Content Credentials), CIB (Collaborative Intelligence Benchmark), ELA (Error Level Analysis), Stego (Steganography) have no in-context explanation |
| Language support | ❌ Fail | English only. No Hausa, Yoruba, or Igbo — excluding users who are more comfortable in their native language |

**Risk**: Medium-High. Field agents with lower literacy may not understand technical verification terminology. Language barrier could reduce adoption among rural agents.

### 2.3 User Control and Freedom

Users often choose system functions by mistake and need a clearly marked "emergency exit" to leave the unwanted state without having to go through an extended dialogue.

| Finding | Status | Detail |
|---|---|---|
| Mark-as-read for alerts | ✅ Pass | Users can dismiss alerts |
| Clear search | ✅ Pass | Search can be cleared |
| Logout | ✅ Pass | Prominent logout option |
| Undo for destructive actions | ❌ Fail | No undo for deleting reports, quarantining evidence, or changing incident severity |
| Recall submitted incidents | ❌ Fail | Once submitted, incidents cannot be edited or recalled by the original reporter |
| Cancel ongoing campaigns | ❌ Fail | Campaigns and wargame scenarios cannot be cancelled once initiated |

**Risk**: High. An analyst who accidentally marks evidence as QUARANTINED or an agent who submits an incident with wrong details has no recovery path. This creates anxiety and may lead to under-reporting.

### 2.4 Consistency and Standards

Users should not have to wonder whether different words, situations, or actions mean the same thing.

| Finding | Status | Detail |
|---|---|---|
| Consistent dark theme | ✅ Pass | Uniform dark color scheme across all tabs |
| Consistent severity color coding | ✅ Pass | Red (CRITICAL), Amber (HIGH), Green (LOW), Blue (INFO) used consistently |
| Consistent component library | ✅ Pass | shadcn/ui components used throughout |
| Form layout consistency | ❌ Fail | Form layouts differ between tabs — some use single-column, others multi-column, with varying label positions |
| Data display consistency | ❌ Fail | Some tabs use tables for list data, others use cards for the same type of data (e.g., agent lists vs. alert lists) |
| Empty state designs | ❌ Fail | Empty states are inconsistent — some show illustrations, some show text, some show nothing |

**Risk**: Medium. Inconsistency increases learning time and cognitive load, particularly for less tech-savvy users.

### 2.5 Error Prevention

Even better than good error messages is a careful design which prevents a problem from occurring in the first place.

| Finding | Status | Detail |
|---|---|---|
| Zod validation on forms | ✅ Pass | Client-side validation present on some forms |
| Confirmation for critical actions | ❌ Fail | No confirmation dialog before quarantining evidence, changing incident severity, or escalating alerts |
| Rate limiting on submissions | ❌ Fail | No client-side debounce or rate limiting — a user could accidentally submit the same report multiple times |
| Conflict detection | ❌ Fail | Two users can edit the same incident simultaneously without awareness, leading to data loss |

**Risk**: High. Absence of conflict detection is particularly dangerous when multiple analysts are reviewing the same incident during a crisis.

### 2.6 Recognition Over Recall

Minimize the user's memory load by making objects, actions, and options visible.

| Finding | Status | Detail |
|---|---|---|
| Icons on sidebar navigation | ✅ Pass | Each tab has a Lucide icon |
| Labels on all form fields | ✅ Pass | All form inputs have visible labels |
| Tab count exceeds cognitive capacity | ❌ Fail | 21 tabs far exceed Miller's Law (7±2 items). Users cannot recognize what they need among 21 options |
| Recently visited tabs | ❌ Fail | No "recent" or "frequent" tabs section to reduce recall burden |
| Navigation search | ❌ Fail | No way to search within navigation (Cmd+K opens global search, but it searches content, not navigation) |

**Risk**: Medium-High. 21 tabs in a sidebar create significant recognition overload, particularly on mobile where the sidebar may be collapsed or behind a hamburger menu.

### 2.7 Flexibility and Efficiency of Use

Accelerators — unseen by the novice user — may often speed up the interaction for the experienced user.

| Finding | Status | Detail |
|---|---|---|
| Global search with keyboard shortcut | ✅ Pass | Ctrl/Cmd+K opens global search — excellent for power users |
| Bulk actions | ✅ Pass | "Mark all read" and "bulk engage" available in alerts |
| Keyboard shortcuts for common actions | ❌ Fail | No keyboard shortcuts for frequent actions like submit report, mark critical, escalate |
| Customizable dashboard | ❌ Fail | The Overview tab is static — users cannot rearrange, add, or remove widgets |
| Saved filters or views | ❌ Fail | Users must re-apply filters every session. No saved filter presets |

**Risk**: Medium. Operations center analysts working 12-hour shifts would benefit enormously from keyboard shortcuts and saved views.

### 2.8 Aesthetic and Minimalist Design

Dialogues should not contain information which is irrelevant or rarely needed.

| Finding | Status | Detail |
|---|---|---|
| Dark theme reduces eye strain | ✅ Pass | Appropriate for 12+ hour monitoring shifts |
| Information-dense layout | ✅ Pass | Appropriate for operations center analysts who need maximum data visibility |
| Tab clutter (OSINT Monitor) | ❌ Fail | OSINT Monitor tab is 873 lines with multiple embedded components — visually overwhelming |
| Data overload on screens | ❌ Fail | Some screens show too many metrics simultaneously, making it hard to identify what matters |
| Redundant information | ❌ Fail | Some data appears in multiple places (e.g., agent count in header AND overview AND agents tab) without clear indication of which is authoritative |

**Risk**: Medium. While information density is valuable for analysts, it becomes a liability for field agents and organization leaders who need curated, focused views.

### 2.9 Help Users Recognize, Diagnose, and Recover from Errors

Error messages should be expressed in plain language (no codes), precisely indicate the problem, and constructively suggest a solution.

| Finding | Status | Detail |
|---|---|---|
| Toast notifications for mutations | ✅ Pass | Success/error toasts appear after form submissions |
| fetchJson throws errors with messages | ✅ Pass | API errors surface with descriptive messages |
| Error recovery guidance | ❌ Fail | Error messages say what went wrong but not how to fix it (e.g., "Network error" with no suggestion to check connection or retry) |
| Retry mechanism on error states | ❌ Fail | Some error states (empty data, failed fetch) have no "try again" button — users must refresh the page |
| Technical error messages | ❌ Fail | Some error messages expose technical details (API error codes, stack traces) that are meaningless to non-technical users |

**Risk**: Medium. Field agents encountering errors during critical moments may panic or abandon the task rather than troubleshoot.

### 2.10 Help and Documentation

Even though it is better if the system can be used without documentation, it may be necessary to provide help and documentation.

| Finding | Status | Detail |
|---|---|---|
| In-app help | ❌ Fail | No help center, FAQ, or support link within the application |
| Tooltips on complex features | ❌ Fail | Technical terms (C2PA, CIB, ELA, Stego) have no hover tooltips or info icons |
| Onboarding flow | ❌ Fail | No first-time user onboarding — new users see the full dashboard immediately with no guidance |
| User manual | ❌ Fail | No user documentation available within the app or linked from it |
| Contextual help | ❌ Fail | No contextual help panels that explain what a screen does, what the data means, or what actions are available |

**Risk**: High. The combination of no onboarding, no tooltips, and no documentation means new users — particularly field agents with low tech literacy — must rely entirely on training sessions, which may have occurred weeks before election day.

---

## 3. Critical User Journeys

### 3.1 Journey 1: Field Agent Submits Incident Report

**Target**: < 60 seconds from app open to submission confirmation

**Current Flow**:
1. Open app on mobile browser
2. Navigate to "Submit Report" tab (may require expanding sidebar)
3. Select incident type from dropdown (14 options)
4. Select severity level (4 options)
5. Write or dictate description
6. Optionally attach media
7. Tap Submit

**Pain Points**:
- On mobile, the sidebar with 21 tabs requires scrolling to find "Submit Report"
- No offline queue — if connectivity drops mid-submission, the report is lost
- GPS location may not auto-fill, requiring manual entry of PU code
- 14 incident types with no descriptions may cause decision paralysis
- No confirmation preview before submission

**Measurement Protocol**: Record screen during test. Measure time from app launch to "Report submitted successfully" toast. Segment by connection speed (2G vs 4G) and device tier.

### 3.2 Journey 2: Analyst Reviews CRITICAL Alert

**Target**: < 5 seconds from alert creation to analyst viewing incident detail

**Current Flow**:
1. Alert count badge updates (up to 30s delay due to polling)
2. Analyst notices badge change (depends on attention)
3. Click bell icon
4. See alert in dropdown
5. Click alert to navigate to Alerts tab
6. Find and click the specific CRITICAL alert
7. View incident detail

**Pain Points**:
- 30-second polling delay means the alert may already be 30+ seconds old before the badge even updates
- No push notification — if the analyst is looking at a different tab or application, they may not notice for minutes
- Multiple clicks required to go from awareness to detail view
- No visual differentiation between CRITICAL and HIGH alerts in the badge

**Measurement Protocol**: Simulate CRITICAL alert creation. Measure time from creation to analyst clicking into the incident detail view. Test with and without analyst's attention on the dashboard.

### 3.3 Journey 3: Admin Checks Election Coverage

**Target**: < 30 seconds to answer "What percentage of Polling Units have agents checked in?"

**Current Flow**:
1. Open Overview tab — see aggregate numbers
2. Navigate to Map tab — see geographic distribution
3. Navigate to Situation Room tab — see per-state breakdown
4. Mentally synthesize information across tabs

**Pain Points**:
- No single view answers this question — information is spread across 3+ tabs
- Overview shows totals but not percentage
- Map shows geography but not summary statistics
- Situation Room requires drilling down by state to find gaps
- No bookmark or saved view for "coverage check"

**Measurement Protocol**: Ask admin the coverage question. Measure time to a confident answer. Track which tabs they visit and in what order.

### 3.4 Journey 4: Trust & Safety Officer Verifies Evidence

**Target**: < 2 minutes from dossier selection to certification decision

**Current Flow**:
1. Navigate to Evidence tab
2. Search or browse for target dossier
3. Review each evidence item (image, video, document)
4. Click "Run Stego Scan" on suspicious items
5. Wait for simulated stego results
6. Review metadata and analysis
7. Make certification decision (Certified / Quarantined)

**Pain Points**:
- No batch operations — each evidence item must be reviewed individually
- Stego scan is simulated and may confuse users about what it's actually checking
- No side-by-side comparison view for related evidence items
- No certification checklist or guided review process
- Once certified/quarantined, no undo option

**Measurement Protocol**: Provide a dossier with 5 evidence items, 2 of which have been flagged. Measure time from dossier open to certification decision. Track hesitation points.

---

## 4. Information Architecture Evaluation

### 4.1 Current IA Problems

The current sidebar organizes 21 tabs into 6 sections:

1. **Overview**: Dashboard
2. **Operations**: Situation Room, Map, Live Feed, Alerts, Field Safety
3. **Field**: Submit Report, My Reports, Agents, Engagement
4. **Analytics**: PVT, Evidence, Flashpoint, Honeypot
5. **Administration**: System Health, Tenants, Security, Users
6. **Planning**: Campaigns, OSINT, Wargame, Mobilization

**Identified Problems**:

- **Sections not visually distinct**: The sidebar uses collapsible section headers, but the visual differentiation is minimal — all sections look the same at a glance.
- **Misplaced items**: "System Health" is under Administration, but it's primarily an operations concern during election day. Analysts need it, not just admins.
- **Cross-cutting concerns**: "My Reports" under Field is also relevant to analysts reviewing field submissions. "Alerts" under Operations is relevant to all roles.
- **No temporal grouping**: The current IA doesn't reflect the election lifecycle. Users think in terms of "before election," "during election," and "after election" — the IA doesn't support this mental model.
- **Mixed paradigms**: The "Analytics" section mixes real-time monitoring (Flashpoint) with deep analysis (Evidence, PVT), which serve different user needs and urgency levels.

### 4.2 Proposed Alternative IA

Grouping by **workflow phase** aligns with how users think about election monitoring:

**Pre-Election Phase**:
- Campaigns — Track deployment and training campaigns
- OSINT Monitor — Monitor social media and open-source intelligence
- Flashpoint Tracker — Identify and track potential conflict zones
- Wargame Simulator — Run scenario planning exercises
- Mobilization — Track agent deployment and readiness

**Election Day (Live Operations)**:
- Overview — Executive dashboard with KPIs
- Situation Room — Real-time operational picture
- Map — Geographic visualization of incidents and agents
- Live Feed — Streaming updates and communications
- Alerts — Incident management and escalation
- Field Safety — Agent welfare and SOS management
- Agents — Agent tracking and status
- Engagement — Stakeholder communication

**Post-Election Phase**:
- PVT — Parallel Vote Tabulation analysis
- Results — Official and unofficial result tracking
- Evidence — Evidence dossiers and verification
- Reports — Generated reports and analytics

**Administration** (always accessible):
- System Health — Platform performance and monitoring
- Tenants — Multi-tenant management
- Security — Audit logs and security settings
- Users — User and role management
- Submit Report — Quick access (pinned)

This reduces visible tabs to ~5-7 per section (within Miller's Law), provides temporal context, and aligns with user mental models.

---

## 5. Mobile UX Specifics

### 5.1 Field Agent Mobile Experience

**Current State**: Responsive web application with no native mobile features.

**Critical Gaps**:

| Feature | Current Status | Impact |
|---|---|---|
| Push notifications | Not implemented | CRITICAL alerts may go unnoticed for minutes |
| Offline support | Not implemented | Reports lost when connectivity drops |
| Camera integration | Not available | Agents cannot capture and attach photos/videos directly |
| GPS auto-fill | Partial | PU code may require manual entry |
| Background location | Not available | Agent tracking requires active app usage |
| Data compression | Not implemented | Full data payloads on 2G are slow |
| Progressive loading | Partial | Some tabs load all data at once |

**Network Considerations**:

- **2G EDGE**: 60-120 kbps downlink, 500-1000ms RTT. A typical OmniVote API response (~50KB JSON) takes 4-7 seconds. The current 30-second polling interval means the app is constantly requesting data it can't load in time.
- **3G HSPA+:** 1-5 Mbps downlink, 100-300ms RTT. Acceptable for basic operations but slow for media uploads.
- **Recommended**: Implement adaptive polling — 60-120 second intervals on 2G, 15-30 seconds on 3G, 5-10 seconds on 4G+. Use WebSocket for desktop/fast connections only.

**Screen Considerations**:

- Minimum target: 5" display, 375×667px viewport (iPhone SE / Tecno Spark)
- Current sidebar collapses to hamburger menu — this means 21 tabs are behind a tap, behind scroll, behind another tap
- Bottom navigation bar should be considered for the 5 most common field agent actions: Submit Report, My Reports, Alerts, Map, Safety

### 5.2 Touch Target Analysis

WCAG 2.5.8 (Level AAA) and Apple/Google HIG recommend minimum 44×44px touch targets with 8px minimum spacing.

**Areas Requiring Audit**:

- **Sidebar items**: When expanded on tablet, items must meet 44×44px. When collapsed on mobile (hamburger), the menu items must be large enough for fat-finger tapping.
- **Action buttons**: Primary actions (Submit, Approve, Escalate) must be large and prominent. Secondary actions can be smaller but still ≥ 44×44px.
- **Form inputs**: Dropdown selectors for incident type (14 options), severity (4 options), and state/LGA/ward hierarchies must have adequate tap targets. Consider using native mobile selects for better usability.
- **Table rows**: On mobile, data tables must either convert to card layouts or have tappable rows with adequate height (≥ 48px).
- **Alert items**: Each alert in the alert list must be tappable with adequate spacing between items to prevent accidental taps.

---

## 6. Cognitive Load Assessment

### 6.1 Information Density

The dashboard is designed for maximum information density — appropriate for operations center analysts with large monitors. However, this same density is presented to field agents on 5" screens and organization leaders who only need high-level summaries. The cognitive load scales inversely with screen size and directly with information density.

**Assessment**: **Overloaded for 3 of 5 user segments**. Only Operations Center Analysts and Trust & Safety Officers benefit from the current density. Field agents, rural agents, and organization leaders are overwhelmed.

### 6.2 Decision Fatigue

The incident submission flow requires users to make several decisions:
- **Incident type**: 14 options (Ballot Snatching, Voter Intimidation, Vote Buying, BVAS Failure, Violence, Underage Voting, Multiple Voting, Vote Manipulation, Results Manipulation, Bribery, Thuggery, Disruption, Late Arrival of Materials, Other)
- **Severity**: 4 levels (CRITICAL, HIGH, MODERATE, LOW)
- **Status**: 5 states (PENDING, INVESTIGATING, RESOLVED, FALSE_ALARM, ESCALATED)

A field agent under stress, possibly in a tense situation, facing 14 incident type options with no descriptions is likely to either select the wrong type or abandon the submission. **Decision fatigue is a significant risk**.

**Recommendation**: Reduce to 5-7 high-frequency incident types with an "Other" option. Add brief descriptions to each. Consider a "quick submit" flow with just type + severity + location for the most common incidents.

### 6.3 Alert Fatigue

During peak election activity, the system may generate hundreds of alerts per hour. If every alert triggers the same notification pattern, analysts will experience alert fatigue and begin ignoring them — including CRITICAL ones.

**Mitigation Strategies**:
- Distinct visual and auditory patterns for CRITICAL/SOS vs. routine alerts
- Alert grouping and batching for non-critical items
- Smart alert prioritization based on context (location, agent, type)
- Configurable alert thresholds per user

### 6.4 Navigation Complexity

21 tabs significantly exceed Miller's Law (7±2 items). While grouped into 6 sections, the sections themselves add cognitive overhead. Users must first identify the correct section, then scan for the correct tab.

**Assessment**: **High navigation complexity**. The proposed IA (Section 4.2) would reduce this to 5-8 items per section, within cognitive capacity.

### 6.5 Color Coding

The system uses 5+ color meanings:
- Red: CRITICAL severity
- Amber: HIGH severity
- Green: LOW severity / online status
- Blue: INFO severity / UI elements
- Purple: PLANNING phase
- Gray: Inactive / disabled

While color coding supports pre-attentive processing (good), 6+ color meanings approach the limit of what users can reliably distinguish, especially on low-quality mobile screens with poor color reproduction.

**Recommendation**: Limit functional color coding to 4-5 meanings. Use shape/pattern/icon in addition to color for critical distinctions.

---

## 7. Usability Testing Plan

### 7.1 Test Protocol

**Participants**: 5 per role × 5 roles = 25 participants per round, recruited from actual election monitoring organizations.

**Rounds**:

| Round | Timing | Focus | Deliverable |
|---|---|---|---|
| 1 — Exploratory | Early development | Navigation, IA, first impressions | IA revision, priority UX issues |
| 2 — Assessment | Mid-development | Critical journeys, mobile experience | Journey optimization, mobile fixes |
| 3 — Validation | Pre-launch | End-to-end election day simulation | Sign-off on UX readiness |

**Tasks per Session (8-10 minutes each)**:
1. Submit an incident report (Journey 1)
2. Find and review a CRITICAL alert (Journey 2)
3. Check election coverage percentage (Journey 3)
4. Verify an evidence dossier (Journey 4)
5. Send a message to field agents
6. Find a specific agent's status
7. Export or generate a report

**Metrics Collected**:
- **Task completion rate**: Binary (completed / not completed)
- **Time on task**: Seconds from task start to completion
- **Error rate**: Wrong actions, abandoned tasks, misclicks
- **Satisfaction**: System Usability Scale (SUS) questionnaire post-session
- **Critical incidents**: Any moment where the user expresses frustration, confusion, or inability to proceed

### 7.2 Success Criteria

| Metric | Target | Rationale |
|---|---|---|
| Task completion rate | > 90% | Below 90% indicates significant usability barriers |
| Time on task | Within journey targets | 60s (submit), 5s (alert), 30s (coverage), 120s (evidence) |
| Error rate | < 10% per task | Higher error rates indicate design confusion |
| SUS score | > 68 | Above average; 68 is the global average for software |
| Critical incidents | 0 per session | Any critical incident is a blocking UX issue |

### 7.3 Recruitment Criteria

- **Analysts**: Currently employed in election monitoring operations centers, minimum 2 election cycles experience
- **Field Agents**: Have participated in at least 1 election monitoring deployment as a field reporter
- **Organization Leaders**: Currently in leadership roles at CSOs or election observation organizations
- **Trust & Safety**: Have experience with digital forensics, fact-checking, or evidence verification

Participants should NOT have been involved in the development of OmniVote Monitor to ensure unbiased feedback.

---

## 8. UX Recommendations (Prioritized)

Prioritized using a modified MoSCoW framework with P0 (must-have before launch) through P3 (future enhancement).

### P0 — Must Have (Before Election Day Launch)

**1. Implement Onboarding Flow for First-Time Users**
- Role-based onboarding that highlights the 5-7 most relevant tabs
- Interactive walkthrough of the incident submission flow
- Glossary of technical terms (C2PA, CIB, ELA, Stego) accessible from onboarding
- Estimated effort: 2-3 sprints

**2. Implement Offline Report Queuing for Field Agents**
- Service Worker with IndexedDB for offline storage
- Visual queue indicator showing pending submissions
- Automatic retry with exponential backoff when connectivity returns
- Conflict resolution for duplicate submissions
- Estimated effort: 3-4 sprints

**3. Add Confirmation Dialogs for Destructive Actions**
- Confirmation modal before: quarantining evidence, escalating alerts, deleting reports, changing severity
- Clear action wording: "This will mark this evidence as QUARANTINED. This action cannot be undone. Continue?"
- Estimated effort: 1 sprint

**4. Add Connection Status Indicator**
- Persistent visual indicator in header: green (online), yellow (degraded), red (offline)
- Offline banner: "You are offline. Reports will be queued and submitted when connectivity returns."
- Estimated effort: 1 sprint

### P1 — Should Have (Within First Month Post-Launch)

**5. Reduce 21 Tabs to 7-10 with Progressive Disclosure**
- Implement the proposed IA (Section 4.2) with workflow phase grouping
- Use progressive disclosure: show primary actions, reveal secondary on demand
- Add "frequently used" and "recently visited" sections in navigation
- Estimated effort: 2-3 sprints

**6. Add Contextual Help Tooltips for Technical Terms**
- Info icon (ⓘ) next to terms: C2PA, CIB, ELA, Stego, Honeypot, PVT
- Hover/click tooltip with plain-language explanation
- Example: "CIB (Collaborative Intelligence Benchmark): An AI score (0-100) indicating how likely this media is authentic based on multiple verification signals."
- Estimated effort: 1 sprint

**7. Implement Push Notifications for CRITICAL/SOS Alerts**
- Web Push API for desktop browsers
- Consider PWA with push notification support for mobile
- Distinct sound and visual pattern for CRITICAL vs. routine alerts
- Estimated effort: 2 sprints

**8. Simplify Incident Submission for Field Agents**
- Reduce primary incident types to 5-7 with "More options" expandable
- Add brief descriptions to each type
- Implement "quick submit" with auto-GPS and minimal fields
- Progressive form: start with type + severity, add details on next screen
- Estimated effort: 2 sprints

### P2 — Nice to Have (Within 3 Months)

**9. Add Customizable Dashboard Widgets**
- Allow users to add/remove/rearrange widgets on Overview tab
- Role-based default widget sets
- Persist preferences per user
- Estimated effort: 3-4 sprints

**10. Implement Adaptive Polling Strategy**
- Desktop/WebSocket: Real-time updates via WebSocket connection
- Mobile/4G: 15-30 second polling
- Mobile/3G: 30-60 second polling
- Mobile/2G: 60-120 second polling with manual refresh
- Network Quality API for automatic adaptation
- Estimated effort: 2 sprints

**11. Add Multi-Language Support (Hausa, Yoruba, Igbo)**
- i18n framework (next-intl or similar)
- Translation of UI labels, form options, and error messages
- Language selector in user profile
- Priority: Hausa first (largest speaker base in northern conflict zones)
- Estimated effort: 4-5 sprints

**12. Add Undo/Recall for Submitted Incidents**
- 60-second undo window after submission
- Edit capability within that window
- Clear indication of undo availability
- Estimated effort: 1-2 sprints

### P3 — Future Enhancement (Next Version)

**13. Design and Build Native Mobile App for Field Agents**
- React Native or Flutter
- Native push notifications
- Native camera integration for evidence capture
- Background GPS tracking
- Offline-first architecture
- Estimated effort: 8-12 sprints

**14. Add Keyboard Shortcuts Panel**
- Accessible via `?` key (like GitHub, Linear)
- Shortcuts for: submit report, mark critical, next alert, search, navigate
- Customizable per user
- Estimated effort: 1-2 sprints

**15. Implement Conflict Detection for Collaborative Editing**
- Real-time awareness of other users viewing/editing the same incident
- Lock mechanism or last-write-wins with diff display
- Estimated effort: 3-4 sprints

**16. Design Coverage Summary View**
- Single view answering: "% of PUs with checked-in agents, by state/LGA"
- Combines data currently spread across Overview, Map, and Situation Room
- Configurable thresholds and alerts for coverage gaps
- Estimated effort: 2-3 sprints

---

## Appendix A: UX Research Calendar

| Phase | Timing | Activities |
|---|---|---|
| Discovery | Weeks 1-2 | Stakeholder interviews, competitive analysis, existing analytics review |
| IA Research | Weeks 2-3 | Card sorting (open), tree testing, IA workshop |
| Round 1 Testing | Week 4 | Exploratory usability testing with prototype |
| IA Iteration | Week 5 | IA revision based on Round 1 findings |
| Round 2 Testing | Week 7 | Assessment testing on functional build |
| Mobile Audit | Week 8 | Touch target audit, 2G performance testing, field simulation |
| Round 3 Testing | Week 10 | Validation testing — full election day simulation |
| Launch Readiness | Week 11 | UX sign-off, P0 items verified, documentation complete |
| Post-Launch | Ongoing | Analytics monitoring, survey deployment, iterative improvements |

## Appendix B: Heuristic Evaluation Summary

| Heuristic | Score (1-5) | Status |
|---|---|---|
| 1. Visibility of System Status | 3 | Partial |
| 2. Match Between System and Real World | 3 | Partial |
| 3. User Control and Freedom | 2 | Needs Work |
| 4. Consistency and Standards | 3 | Partial |
| 5. Error Prevention | 2 | Needs Work |
| 6. Recognition Over Recall | 2 | Needs Work |
| 7. Flexibility and Efficiency of Use | 3 | Partial |
| 8. Aesthetic and Minimalist Design | 3 | Partial |
| 9. Error Recovery | 2 | Needs Work |
| 10. Help and Documentation | 1 | Critical Gap |
| **Overall** | **2.4 / 5.0** | **Needs Significant Improvement** |

**Interpretation**: A score of 2.4/5.0 indicates the platform has a solid foundation (consistent theming, good component library, appropriate terminology) but has critical gaps in user control, error handling, navigation cognitive load, and documentation. The P0 recommendations address the most urgent of these gaps.

---

*This document is a living artifact. Update after each research round, usability test, and major design iteration. All recommendations should be validated with users before implementation.*