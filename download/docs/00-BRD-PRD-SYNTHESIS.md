# OmniVote Monitor v2.1 — BRD & PRD Synthesis

**Document ID:** OVM-BRD-PRD-001  
**Version:** 2.1.0  
**Classification:** Internal — Confidential  
**Status:** Active  
**Last Updated:** 2025-07-11

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Context](#2-business-context)
3. [Stakeholders](#3-stakeholders)
4. [Business Objectives](#4-business-objectives)
5. [Scope](#5-scope)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Constraints & Assumptions](#7-constraints--assumptions)
8. [Functional Requirements](#8-functional-requirements)
9. [Data Model Summary](#9-data-model-summary)
10. [API Architecture](#10-api-architecture)
11. [User Stories](#11-user-stories)
12. [Acceptance Criteria](#12-acceptance-criteria)
13. [Risk Register](#13-risk-register)
14. [Future Roadmap](#14-future-roadmap)

---

# PART I — BUSINESS REQUIREMENTS DOCUMENT (BRD)

## 1. Executive Summary

OmniVote Monitor v2.1 is a **multi-tenant, real-time adversarial election monitoring platform** designed for deployment across Nigeria's three election tiers: **Presidential**, **Governorship**, and **Local Government** elections. The platform provides civil society organizations (CSOs) with an integrated suite of tools for parallel vote tabulation (PVT), incident reporting, open-source intelligence (OSINT) monitoring, disinformation tracking, evidence chain-of-custody verification, and field agent safety management.

The system operates under a **five-tier Role-Based Access Control (RBAC)** model serving the following roles:

| Role | Description |
|---|---|
| `SUPER_ADMIN` | Full platform control; manages tenants, system configuration, and security policies |
| `TENANT_ADMIN` | Manages a single tenant organization's users, configuration, and data |
| `ANALYST` | Reviews incidents, OSINT feeds, PVT data; generates insights and reports |
| `TRUST_SAFETY` | Handles evidence verification, C2PA validation, steganography analysis, content moderation |
| `FIELD_AGENT` | Submits incident reports, result data, and media from polling units |

The platform supports **three independent tenant organizations**, each with full data isolation, enabling parallel civil society deployments without cross-tenant visibility. Core capabilities include:

- **Real-time incident reporting** with 14 incident types and GPS anomaly detection
- **OSINT monitoring** across 8 platforms with CIB scoring and bot detection
- **Parallel vote tabulation (PVT)** with SHA256 verification hashes and official result comparison
- **Evidence chain of custody** using C2PA digital signing and steganography detection
- **Flashpoint forecasting** with 7-day risk prediction using ensemble AI models
- **Wargame simulation** for red/blue team adversarial scenario planning
- **Honeypot polling units** with ghost unit, tamper trap, and replay detector strategies
- **Geofencing** with dead-man's switch escalation and auto-SOS triggers
- **Biometric profiling** via typing cadence, touch pressure, gyro pattern, and device trust scores
- **WhatsApp integration** through a Go bridge service for field agent communication
- **Campaign monitoring** with tone analysis and hate speech flagging
- **Voter suppression tracking** with verification workflows

## 2. Business Context

### 2.1 Nigeria's Electoral Integrity Landscape

Nigeria's democratic process faces persistent and evolving threats to electoral integrity. Historical and contemporary challenges include:

- **Ballot stuffing**: Systematic inflation of vote counts through pre-filled ballot papers or multiple voting
- **Voter intimidation**: Physical or psychological coercion at or near polling units, particularly in conflict-prone regions
- **Results manipulation**: Alteration of collated results at ward, LGA, or state levels before official announcement
- **Disinformation**: Coordinated campaigns spreading false information about voting dates, locations, procedures, or outcomes
- **Coordinated Inauthentic Behavior (CIB)**: Organized networks of fake accounts amplifying divisive narratives or suppressing turnout
- **Deepfakes**: AI-generated audio or video content impersonating candidates, officials, or election observers
- **Voter suppression**: Systematic disenfranchisement through false polling information, ID blocking, or material withholding

Multiple civil society organizations independently conduct parallel vote tabulation (PVT) to provide an independent verification layer against official results. These organizations require dedicated, isolated platforms that prevent data cross-contamination while maintaining operational parity.

### 2.2 Regulatory & Operational Environment

- Nigeria operates a three-tier election system (Federal, State, Local Government) under INEC (Independent National Electoral Commission)
- The country is divided into 6 geo-political zones, 36 states + FCT, 774 Local Government Areas (LGAs), and approximately 176,846 polling units
- Civil society observation is legally protected but faces operational risks including agent harassment and communication blackouts
- WhatsApp is the primary communication channel for field agents due to its ubiquity and end-to-end encryption

## 3. Stakeholders

### 3.1 Primary Stakeholders

| Stakeholder Group | Role in Platform | Key Needs |
|---|---|---|
| Civil Society Organizations (CSOs) | Tenant Administrators | Independent data isolation, configurable workflows, exportable reports |
| Election Observers | Analysts | Real-time dashboards, hierarchical drill-down, pattern detection, trend analysis |
| Field Agents / Poll Monitors | Field Agents | Simple report submission, GPS capture, media upload, safety features |
| Trust & Safety Teams | Trust & Safety Officers | Evidence verification, manipulation detection, C2PA validation |
| Security Operations | Super Admins | Agent safety monitoring, geofencing alerts, dead-man's switch management |
| IT Administrators | Super Admins | System health, tenant management, user provisioning, policy configuration |

### 3.2 Secondary Stakeholders

- **International observer missions** requiring verified data exports
- **Media organizations** seeking validated incident data
- **Legal teams** requiring chain-of-custody documentation for election tribunals
- **Donor organizations** monitoring platform effectiveness and coverage metrics

## 4. Business Objectives

| # | Objective | Success Metric | Priority |
|---|---|---|---|
| BO-01 | Detect election incidents in real-time | Incident report-to-dashboard latency ≤ 30 seconds | Critical |
| BO-02 | Maintain parallel vote tabulation accuracy | PVT delta detection threshold at >5% deviation | Critical |
| BO-03 | Preserve evidence integrity | All evidence C2PA-signed; steganography scan completion rate 100% | Critical |
| BO-04 | Track and flag disinformation campaigns | CIB scoring coverage across 8 OSINT platforms | High |
| BO-05 | Ensure field agent safety | Dead-man's switch escalation within 4 levels; geofence breach detection <60s | High |
| BO-06 | Document voter suppression incidents | Suppression report verification workflow completion rate | High |
| BO-07 | Forecast electoral violence flashpoints | 7-day prediction with confidence scoring | Medium |
| BO-08 | Enable multi-tenant operations | Full data isolation across 3+ independent tenants | Critical |
| BO-09 | Support three election tiers | Tier-aware aggregation across Presidential, Governorship, LGA | High |
| BO-10 | Provide campaign monitoring intelligence | Real-time event tracking with tone and crowd analysis | Medium |

## 5. Scope

### 5.1 In Scope

The v2.1 release encompasses the following operational scope:

- **23 database models** implemented via Prisma ORM, covering incidents, agents, evidence, OSINT feeds, PVT data, geofences, campaigns, suppression reports, messages, honeypots, biometric profiles, security events, and system health
- **28 API routes** organized under a REST architecture with query-based tenant identification
- **10+ dashboard tabs per role**, each rendering role-appropriate modules and data views
- **5 RBAC levels** with role-filtered navigation and data access
- **3 election tiers** (Presidential, Governorship, Local Government) with tier-aware data aggregation
- **Multi-tenant isolation** ensuring zero data leakage between tenant organizations
- **Hierarchical geographic drill-down**: National → 6 Geo-Political Zones → 36 States → 774 LGAs → Wards → Polling Units
- **WhatsApp Bridge integration** via an external Go service for field communication

### 5.2 Out of Scope (v2.1)

- Native mobile applications (mobile-responsive web only)
- Real-time WebSocket connections (30-second polling instead)
- Production-grade authentication and authorization
- Real AI/ML model inference (simulated responses)
- End-to-end encryption for data at rest
- Multi-database or distributed database support
- International deployment outside Nigeria

### 5.3 Module Inventory

| Module | Description |
|---|---|
| Situation Room | Hierarchical geographic dashboard with tier-aware aggregation |
| Incident Management | 14-type incident lifecycle with AI summarization and auto-alerts |
| Geographic Map | Leaflet/OpenStreetMap with CARTO dark tiles and PU status markers |
| OSINT Monitoring | 8-platform social media and news monitoring with CIB scoring |
| AI Insights | Security event classification and pattern detection |
| PVT / Quick Count | Parallel vote tabulation with SHA256 verification and Sankey diagrams |
| Evidence Management | C2PA signing, steganography detection, manipulation type classification |
| Flashpoint Forecasting | 7-day ensemble risk prediction across 4 risk categories |
| Wargame Simulator | Red/blue team adversarial scenario planning and execution |
| Honeypot Units | 3 trap-type decoy polling units with deviation detection |
| Biometric Profiling | Behavioral biometrics and device trust scoring |
| Geofencing | Zone-based check-ins with dead-man's switch escalation |
| Campaign Monitoring | 5-type event tracking with tone analysis and party affiliation |
| Voter Suppression | 5-type suppression reporting with 3-level severity and verification |
| WhatsApp Integration | Go bridge service, QR linking, template messaging |
| Mobilization Engine | 128 templates across 14 categories with WABA compliance |
| Agent Engagement | Idle detection, offline tracking, infraction management |
| Security Center | Event monitoring, trust scoring, policy management, audit logging |
| Field Agent Tools | Report submission, GPS auto-fill, media attachments |
| Multi-Tenant Admin | Tenant CRUD, user management, cascading data operations |
| System Health | Service monitoring, API latency, database health (simulated) |

## 6. Non-Functional Requirements

| NFR ID | Category | Requirement | Target |
|---|---|---|---|
| NFR-01 | Performance | Dashboard data refresh interval | ≤ 30 seconds (polling) |
| NFR-02 | Security | Data encryption (at rest) | AES-256 (currently cosmetic) |
| NFR-03 | Security | Multi-tenant data isolation | Query-based tenant filtering on all routes |
| NFR-04 | Usability | Mobile-responsive design | All dashboards functional on 375px+ viewports |
| NFR-05 | Accessibility | Keyboard navigation | All interactive elements reachable via Tab/Enter |
| NFR-06 | Visual Design | Dark theme | System-wide dark color scheme as default |
| NFR-07 | Reliability | Single-file database | SQLite with atomic writes |
| NFR-08 | Deployment | Reverse proxy | Caddy with automatic HTTPS |
| NFR-09 | Runtime | JavaScript runtime | Bun (not Node.js) |
| NFR-10 | Interoperability | WhatsApp integration | Go service bridge on port 9090 |

## 7. Constraints & Assumptions

### 7.1 Technical Constraints

| Constraint | Impact | Mitigation (Future) |
|---|---|---|
| **SQLite database** (single file) | No concurrent write scaling; no full-text search; limited JSON operations | Migrate to PostgreSQL |
| **Bun runtime** | Potential compatibility issues with some Node.js ecosystem packages | Monitor Bun compatibility; fallback to Node if needed |
| **Caddy reverse proxy** | Limited advanced routing compared to Nginx | Sufficient for single-service deployment |
| **WhatsApp Bridge (Go service at :9090)** | External service dependency; no native integration | Monitor bridge health; implement retry logic |
| **No real authentication** | Email-only identification stored in-memory; no JWT, no session management | Implement JWT + bcrypt in future release |
| **30-second polling (no WebSocket)** | Not true real-time; higher server load at scale | Implement WebSocket/SSE in future release |
| **Simulated AI/ML** | All AI insights, steganography detection, CIB scoring, and flashpoint forecasting return mock data | Integrate real model endpoints in future release |

### 7.2 Assumptions

- Each tenant organization has a designated TENANT_ADMIN responsible for user provisioning
- Field agents have access to smartphones with GPS capabilities and WhatsApp
- Internet connectivity is available (though intermittent in some regions)
- The platform operates within a single geographic region (Nigeria) with no multi-language requirements
- A maximum of approximately 500 concurrent users per tenant is expected

---

# PART II — PRODUCT REQUIREMENTS DOCUMENT (PRD)

## 8. Functional Requirements

### 8.1 Incident Management (IM)

**FR-IM-001: Incident Type Classification**

The system shall support 14 incident types for categorization:

| # | Incident Type | Code |
|---|---|---|
| 1 | Ballot Stuffing | `BALLOT_STUFFING` |
| 2 | Voter Intimidation | `VOTER_INTIMIDATION` |
| 3 | BVAS Malfunction | `BVAS_MALFUNCTION` |
| 4 | Vote Buying | `VOTE_BUYING` |
| 5 | Underage Voting | `UNDERAGE_VOTING` |
| 6 | Multiple Voting | `MULTIPLE_VOTING` |
| 7 | Violence | `VIOLENCE` |
| 8 | Snatching of Materials | `MATERIALS_SNATCHED` |
| 9 | Late Arrival of Materials | `LATE_MATERIALS` |
| 10 | Polling Unit Change | `PU_CHANGE` |
| 11 | Accreditation Issues | `ACREDITATION_ISSUE` |
| 12 | Collation Irregularity | `COLLATION_IRREGULARITY` |
| 13 | Political Thugs | `POLITICAL_THUGS` |
| 14 | Security Personnel Misconduct | `SECURITY_MISCONDUCT` |

**FR-IM-002: Severity Levels**

All incidents shall be assigned one of four severity levels:

| Severity | Description | Auto-Alert |
|---|---|---|
| `LOW` | Minor procedural irregularity | No |
| `MEDIUM` | Moderate violation affecting process integrity | No |
| `HIGH` | Serious violation requiring immediate attention | Yes |
| `CRITICAL` | Severe threat to life or electoral integrity | Yes |

**FR-IM-003: Incident Status Lifecycle**

Incidents shall progress through 5 statuses:

```
PENDING → VERIFIED → INVESTIGATING → RESOLVED → DISMISSED
```

- `PENDING`: Newly reported, awaiting review
- `VERIFIED`: Confirmed by analyst or trust & safety team
- `INVESTIGATING`: Under active review
- `RESOLVED`: Closed with outcome documented
- `DISMISSED`: Determined to be false or duplicate

**FR-IM-004: GPS Anomaly Detection**

The system shall flag incident reports where the submitted GPS coordinates deviate by more than **5%** from the expected polling unit location. Flagged incidents shall display a warning badge and be queued for analyst review.

**FR-IM-005: AI Summarization**

Each incident shall include an AI-generated summary field. In v2.1, this is populated with simulated text. The summary shall distill the incident description, type, severity, and location into a concise briefing paragraph.

**FR-IM-006: Quarantine Flagging**

Analysts shall be able to quarantine incidents suspected of being false reports, duplicates, or test data. Quarantined incidents are excluded from aggregate statistics and dashboard counts.

**FR-IM-007: C2PA Verification Integration**

Incidents with attached media shall reference C2PA verification status. The evidence management module provides the verification result, which is displayed on the incident detail view.

**FR-IM-008: Auto-Alert Generation**

When an incident is created or updated to `HIGH` or `CRITICAL` severity, the system shall automatically generate an alert visible in the Situation Room and triggered to relevant TENANT_ADMIN and ANALYST users.

---

### 8.2 Situation Room (SR)

**FR-SR-001: Hierarchical Drill-Down**

The Situation Room shall provide a hierarchical geographic navigation structure:

```
National
├── North Central (6 states)
├── North East (6 states)
├── North West (7 states)
├── South East (5 states)
├── South South (6 states)
└── South West (6 states)
    └── [State]
        └── [LGA]
            └── [Ward]
                └── [Polling Unit]
```

Each level shall display aggregate metrics for the selected geographic scope.

**FR-SR-002: Tier-Aware Aggregation**

All Situation Room statistics shall filter based on the active election tier (Presidential, Governorship, or Local Government). Selecting a different tier recalculates all displayed metrics without page reload.

**FR-SR-003: KPI Cards**

The Situation Room shall display the following KPI cards at each geographic level:

- Total polling units monitored
- Polling units with reported incidents
- Active (unresolved) incidents
- PVT coverage percentage
- Average voter turnout
- Critical severity incident count

---

### 8.3 Geographic Map (GM)

**FR-GM-001: Map Engine**

The geographic map shall use **Leaflet** with **OpenStreetMap** base tiles, styled using the **CARTO dark** tile layer (`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`).

**FR-GM-002: Polling Unit Markers**

Each polling unit shall be represented by a marker colored by its operational status:

| Status | Marker Color |
|---|---|
| `OPEN` | Green |
| `CLOSED` | Gray |
| `FLAGGED` | Red |
| `PENDING` | Yellow/Amber |

**FR-GM-003: Turnout-Based Color Coding**

Markers shall optionally overlay a secondary color gradient based on voter turnout percentage, enabling visual identification of high-traffic or low-turnout areas.

**FR-GM-004: Marker Popups**

Clicking a polling unit marker shall display a popup containing:

- Polling unit name and code
- Ward, LGA, and State
- Current status
- Incident count
- Last reported timestamp

---

### 8.4 OSINT Monitoring (OM)

**FR-OM-001: Platform Coverage**

The OSINT module shall monitor 8 source platforms:

| # | Platform | Monitoring Method |
|---|---|---|
| 1 | X (Twitter) | API/search |
| 2 | Facebook | Public page/group monitoring |
| 3 | YouTube | Video metadata and comments |
| 4 | TikTok | Video metadata and engagement |
| 5 | Instagram | Post and story monitoring |
| 6 | WhatsApp Channels | Bridge service integration |
| 7 | News Outlets | RSS feed aggregation |
| 8 | RSS Feeds | Custom feed ingestion |

**FR-OM-002: Sentiment Analysis**

Each monitored post/item shall receive a sentiment classification: `POSITIVE`, `NEGATIVE`, `NEUTRAL`, or `MIXED`. In v2.1, sentiment is simulated.

**FR-OM-003: CIB Scoring**

Each monitored item shall receive a Coordinated Inauthentic Behavior (CIB) score from **0.0 to 1.0**, where:

- `0.0–0.3`: Low risk — likely organic
- `0.3–0.6`: Medium risk — suspicious patterns
- `0.6–1.0`: High risk — probable coordinated campaign

**FR-OM-004: Bot Detection**

Each source account shall receive a bot probability score. Accounts exceeding a configurable threshold (default 0.7) shall be flagged as probable bots.

**FR-OM-005: Virality Scoring**

Each monitored item shall receive a virality score based on engagement rate, amplification velocity, and network reach.

**FR-OM-006: Fake News Flagging**

Items meeting configurable criteria (low source credibility + high CIB score + high virality) shall be automatically flagged as potential disinformation.

---

### 8.5 AI Insights (AI)

**FR-AI-001: Security Event Classification**

The AI Insights module shall classify security events into 6 categories:

| Category | Code | Description |
|---|---|---|
| Computer Vision | `CV` | Image/video analysis for manipulation detection |
| Natural Language Processing | `NLP` | Text analysis for sentiment, threat detection |
| Geospatial | `GEO` | Location-based pattern analysis |
| Authentication | `AUTH` | Login anomaly and access pattern detection |
| C2PA Verification | `C2PA` | Content provenance and authenticity checks |
| Security | `SEC` | General security event classification |

**FR-AI-002: Pattern Detection**

The module shall surface detected patterns including geographic clustering of incidents, temporal spikes in report volume, and correlation between OSINT activity and field reports.

**FR-AI-003: Recommendations**

Based on classified events, the system shall generate actionable recommendations for analysts and tenant admins. In v2.1, these are simulated.

---

### 8.6 PVT / Quick Count (PVT)

**FR-PVT-001: Parallel Vote Tabulation**

The PVT module shall accept field agent result submissions per polling unit, capturing:

- Polling unit identifier
- Election tier
- Votes per candidate/party
- Total accredited voters
- Total votes cast
- Rejected ballots
- Timestamp of submission

**FR-PVT-002: SHA256 Verification Hash**

Each PVT submission shall generate a SHA256 hash from the vote data, providing a tamper-evident verification mechanism. The hash shall be displayed alongside the submission record.

**FR-PVT-003: Official Result Comparison**

The system shall support manual entry of official INEC results for comparison against PVT data. A delta calculation shall be performed per polling unit.

**FR-PVT-004: Anomaly Detection**

PVT entries where the delta between reported and official results exceeds **5%** shall be automatically flagged for analyst review.

**FR-PVT-005: Sankey Diagram Visualization**

The PVT module shall display a Sankey diagram showing the flow of votes from accreditation through casting to tabulation, enabling visual identification of vote attrition at each stage.

---

### 8.7 Evidence Management (EM)

**FR-EM-001: C2PA Digital Signing**

All uploaded evidence (images, videos, documents) shall be assigned a C2PA digital signature record. In v2.1, this is simulated with generated provenance metadata including:

- Content hash
- Signing timestamp
- Device/app identifier
- Chain of custody entries

**FR-EM-002: Steganography Scan**

Each uploaded media file shall undergo steganography analysis using three techniques:

| Technique | Description |
|---|---|
| Error Level Analysis (ELA) | Detects compression inconsistencies indicating tampering |
| Noise Analysis | Identifies unnatural noise patterns from embedding |
| Metadata Diff | Compares embedded metadata against expected norms |

**FR-EM-003: Manipulation Type Classification**

When steganography or tampering is detected, the system shall classify the manipulation into one of 5 types:

| Type | Code | Detection Method |
|---|---|---|
| LSB Embedding | `LSB_EMBEDDING` | Statistical analysis of least-significant bits |
| EXIF Tampering | `EXIF_TAMPER` | Metadata inconsistency detection |
| Audio Steganography | `AUDIO_STEGO` | Spectral analysis of audio files |
| Deepfake Face | `DEEPFAKE_FACE` | Facial landmark inconsistency analysis |
| Clone Stamp | `CLONE_STAMP` | Frequency domain analysis for copied regions |

---

### 8.8 Flashpoint Forecasting (FF)

**FR-FF-001: 7-Day Risk Prediction**

The Flashpoint Forecasting module shall generate 7-day forward-looking risk predictions across 4 categories:

| Risk Category | Description |
|---|---|
| Violence | Physical confrontation, arson, armed groups |
| Intimidation | Threats, coercion, gang presence |
| Logistics | Material delivery failures, BVAS issues, staffing |
| Overall | Composite risk score across all categories |

**FR-FF-002: Ensemble AI Model**

Predictions shall be attributed to an "ensemble AI model." In v2.1, all predictions are simulated with plausible distributions.

**FR-FF-003: Confidence Scores**

Each prediction shall include a confidence score (0–100%) indicating the model's certainty level.

**FR-FF-004: Geographic Granularity**

Predictions shall be available at the state level minimum, with drill-down to LGA where data permits.

---

### 8.9 Wargame Simulator (WS)

**FR-WS-001: Red/Blue Team Roles**

The Wargame Simulator shall support two adversarial team roles:

- **Red Team**: Simulates election adversaries (vote manipulators, disinformation operators, violent actors)
- **Blue Team**: Simulates election defenders (observers, security forces, CSO response teams)

**FR-WS-002: Step-by-Step Scenario Execution**

Wargame scenarios shall execute in discrete steps, with each step representing a tactical action by either team. The system shall track the sequence, allow branching decisions, and record outcomes.

**FR-WS-003: Scoring**

Each wargame session shall produce a score evaluating the effectiveness of both teams based on predefined success criteria.

---

### 8.10 Honeypot Units (HU)

**FR-HU-001: Trap Types**

The Honeypot module shall support 3 trap types:

| Trap Type | Code | Purpose |
|---|---|---|
| Ghost Unit | `GHOST_UNIT` | Non-existent polling unit to detect fabricated result submissions |
| Tamper Trap | `TAMPER_TRAP` | Marked polling unit to detect result manipulation attempts |
| Replay Detector | `REPLAY_DETECTOR` | Duplicate submission detection using result pattern matching |

**FR-HU-002: Deviation Detection**

The system shall compare submissions to honeypot units against expected baselines and flag deviations exceeding configurable thresholds.

**FR-HU-003: Auto-Alerting**

Honeypot triggers shall automatically generate alerts to TENANT_ADMIN and TRUST_SAFETY roles with full deviation details.

---

### 8.11 Biometric Profiling (BP)

**FR-BP-001: Behavioral Biometrics**

The Biometric Profiling module shall capture and analyze 3 behavioral signals:

| Signal | Data Source | Purpose |
|---|---|---|
| Typing Cadence | Keystroke timing patterns | Continuous authentication |
| Touch Pressure | Touchscreen pressure sensors | Device user verification |
| Gyro Pattern | Device gyroscope/accelerometer | Movement pattern profiling |

**FR-BP-002: Device Trust Score**

Each device shall receive a trust score from **0 to 100**, where:

- `0–25`: Untrusted — new or suspicious device
- `26–50`: Low trust — limited history
- `51–75`: Moderate trust — established pattern
- `76–100`: High trust — consistent verified behavior

**FR-BP-003: Biometric Risk Score**

Each user session shall receive a biometric risk score from **0.0 to 1.0**, indicating the likelihood that the current session operator differs from the registered user.

---

### 8.12 Geofencing (GF)

**FR-GF-001: Zone-Based Check-Ins**

Field agents shall be required to check in to designated geofence zones at configurable intervals. Each check-in captures GPS coordinates and timestamp.

**FR-GF-002: Dead-Man's Switch**

The geofencing system shall implement a dead-man's switch with **4 escalation levels**:

| Level | Condition | Action |
|---|---|---|
| 0 | Agent checked in on time | No action |
| 1 | Check-in overdue by 1 interval | Notification to agent |
| 2 | Check-in overdue by 2 intervals | Alert to TENANT_ADMIN |
| 3 | Check-in overdue by 3+ intervals | Auto-SOS trigger; alert all admins |

**FR-GF-003: Auto-SOS Trigger**

At escalation level 3, the system shall automatically trigger an SOS alert, broadcasting the agent's last known location to all TENANT_ADMIN and SUPER_ADMIN users.

---

### 8.13 Campaign Monitoring (CM)

**FR-CM-001: Event Types**

The Campaign Monitoring module shall track 5 event types:

| Event Type | Code |
|---|---|
| Rally | `RALLY` |
| Town Hall | `TOWN_HALL` |
| Debate | `DEBATE` |
| Press Conference | `PRESS_CONF` |
| Door-to-Door | `DOOR_TO_DOOR` |

**FR-CM-002: Party Tracking**

Events shall be tagged with the organizing political party from the following set:

- APC (All Progressives Congress)
- PDP (Peoples Democratic Party)
- LP (Labour Party)
- NNPP (New Nigeria Peoples Party)
- Other / Independent

**FR-CM-003: Tone Analysis**

Each monitored campaign event shall receive a tone classification (e.g., conciliatory, aggressive, divisive, neutral). In v2.1, this is simulated.

**FR-CM-004: Crowd Estimates**

Campaign events shall include crowd size estimates (minimum, maximum, and agent-reported actual) for resource planning and security assessment.

**FR-CM-005: AI Flagging**

The system shall automatically flag campaign events where AI detects:

- Hate speech or incitement
- Use of state resources (government facilities, public servants)
- Violations of campaign finance regulations

---

### 8.14 Voter Suppression (VS)

**FR-VS-001: Report Types**

The Voter Suppression module shall accept 5 suppression report types:

| # | Report Type | Code |
|---|---|---|
| 1 | False Polling Information | `FALSE_POLLING_INFO` |
| 2 | Voter Intimidation | `INTIMIDATION` |
| 3 | Voter ID Blocked | `VOTER_ID_BLOCKED` |
| 4 | Materials Withheld | `MATERIALS_WITHHELD` |
| 5 | Fake Schedule Dissemination | `FAKE_SCHEDULE` |

**FR-VS-002: Severity Levels**

Suppression reports shall be classified into 3 severity levels:

| Severity | Description |
|---|---|
| `LOW` | Isolated incident, minimal impact |
| `MEDIUM` | Pattern emerging, affects multiple voters |
| `HIGH` | Systematic suppression, affects large voter population |

**FR-VS-003: Verification Workflow**

Suppression reports shall follow a verification workflow:

```
REPORTED → VERIFIED → ESCALATED → RESOLVED
```

Each transition shall be timestamped and attributed to the acting user.

---

### 8.15 WhatsApp Integration (WI)

**FR-WI-001: Go Bridge Service**

The platform shall integrate with an external Go-based WhatsApp Bridge service running on port **9090**. Communication between the platform and the bridge shall use HTTP REST calls.

**FR-WI-002: QR Code Linking**

Field agents shall be able to link their WhatsApp account via QR code generated through the bridge service.

**FR-WI-003: Template Messaging**

The system shall support sending pre-defined message templates through WhatsApp, with variable substitution for personalization (agent name, polling unit, etc.).

**FR-WI-004: Delivery Tracking**

Message delivery status shall be tracked through the bridge service, recording:

- Sent timestamp
- Delivered timestamp
- Read timestamp
- Failed status and reason

---

### 8.16 Mobilization Engine (ME)

**FR-ME-001: Message Template Library**

The Mobilization Engine shall provide **128 message templates** organized across **14 categories**, including:

- Voter education
- Polling unit location reminders
- Incident reporting instructions
- Safety advisories
- Result reporting guidelines
- Emergency alerts
- Motivational messages
- Language-specific templates

**FR-ME-002: Contact List Segmentation**

Contacts shall be segmentable into 4 list types:

| Segment | Description |
|---|---|
| `ALL_AGENTS` | Every registered field agent |
| `ZONE_AGENTS` | Agents within a specific geo-political zone |
| `STATE_AGENTS` | Agents within a specific state |
| `CUSTOM` | User-defined segment based on filters |

**FR-ME-003: WABA Compliance**

All outbound messaging shall comply with WhatsApp Business API (WABA) requirements including:

- Opt-in consent tracking per contact
- Message template pre-approval
- Rate limiting (configurable messages per window)

**FR-ME-004: Rate Limiting**

The system shall enforce configurable rate limits to prevent WABA policy violations, tracking messages sent per time window per tenant.

---

### 8.17 Agent Engagement (AE)

**FR-AE-001: Idle Detection**

Agents who have not submitted a report or check-in for more than **30 minutes** shall be flagged as idle in the Agent Engagement dashboard.

**FR-AE-002: No-Data Agents**

Agents who have been registered but have never submitted any data shall be listed as "no-data agents" with their registration duration.

**FR-AE-003: Offline Agent Tracking**

Agents whose last known check-in exceeds the geofence interval shall be marked as offline. The duration of offline status shall be displayed.

**FR-AE-004: Infraction Tracking**

Agent infractions (missed check-ins, GPS anomalies, late submissions) shall be logged and aggregated into an infraction score per agent.

**FR-AE-005: Bulk Messaging**

TENANT_ADMIN users shall be able to send bulk messages to selected agent segments directly from the Agent Engagement module.

---

### 8.18 Security Center (SC)

**FR-SC-001: Event Types**

The Security Center shall track 10 event types:

| # | Event Type | Code |
|---|---|---|
| 1 | Login Attempt | `LOGIN_ATTEMPT` |
| 2 | Failed Login | `FAILED_LOGIN` |
| 3 | Permission Denied | `PERMISSION_DENIED` |
| 4 | Data Export | `DATA_EXPORT` |
| 5 | Configuration Change | `CONFIG_CHANGE` |
| 6 | User Created | `USER_CREATED` |
| 7 | User Modified | `USER_MODIFIED` |
| 8 | Suspicious Activity | `SUSPICIOUS_ACTIVITY` |
| 9 | Geofence Breach | `GEOFENCE_BREACH` |
| 10 | Dead Man Trigger | `DEAD_MAN_TRIGGER` |

**FR-SC-002: User Trust Scoring**

Each user shall maintain a trust score influenced by login regularity, device consistency, geofence compliance, and infraction history.

**FR-SC-003: Policy Management**

SUPER_ADMIN users shall be able to configure security policies:

| Policy | Options |
|---|---|
| Encryption | Enabled / Disabled (cosmetic in v2.1) |
| Two-Factor Authentication | Enabled / Disabled (not implemented in v2.1) |
| Session Timeout | 15 / 30 / 60 / 120 minutes |
| IP Whitelist | Comma-separated IP addresses |
| Data Retention | 30 / 60 / 90 / 365 days |

**FR-SC-004: User Lock/Unlock**

SUPER_ADMIN users shall be able to manually lock or unlock user accounts. Locked accounts shall be prevented from accessing any dashboard.

**FR-SC-005: Audit Logging**

All significant user actions shall be logged with:

- Timestamp
- User email and role
- Action type
- Resource affected
- IP address (simulated)

---

### 8.19 Field Agent Tools (FA)

**FR-FA-001: Report Submission**

Field agents shall be able to submit two report types from a unified interface:

1. **Incident Reports**: Select incident type, severity, description, attach media
2. **Result Reports**: Enter vote counts per candidate, accredited voters, rejected ballots

**FR-FA-002: GPS Auto-Fill**

The report submission form shall auto-populate GPS coordinates from the device's geolocation API. Manual override shall be permitted with a warning when coordinates deviate >5% from the assigned polling unit.

**FR-FA-003: Media Attachments**

Reports shall support attachment of photos, videos, and audio recordings. Each attachment shall be linked to the evidence management pipeline for C2PA signing and steganography scanning.

**FR-FA-004: Personal Report History**

Each field agent shall have access to their own report history, filtered and sorted by date, type, and status.

---

### 8.20 Multi-Tenant Admin (MTA)

**FR-MTA-001: Tenant CRUD**

SUPER_ADMIN users shall be able to:

- Create new tenant organizations with name, description, and configuration
- Read tenant details and aggregate statistics
- Update tenant configuration
- Delete tenants with cascading data removal

**FR-MTA-002: User Management Per Tenant**

TENANT_ADMIN and SUPER_ADMIN users shall be able to:

- Create users within their tenant
- Assign roles (ANALYST, TRUST_SAFETY, FIELD_AGENT for TENANT_ADMIN; all roles for SUPER_ADMIN)
- Update user details
- Deactivate users

**FR-MTA-003: Cascading Delete**

Deleting a tenant shall cascade the deletion across all **25 related database tables**, removing all tenant-associated data in a single transaction to prevent orphaned records.

---

### 8.21 System Health (SH)

**FR-SH-001: Service Monitoring**

The System Health dashboard shall display the operational status of platform services.

**FR-SH-002: API Latency**

Response time metrics for API routes shall be displayed, allowing SUPER_ADMIN users to identify performance bottlenecks.

**FR-SH-003: Database Health**

Database health metrics (size, row counts per table, last write) shall be displayed. In v2.1, most metrics are simulated rather than measured from actual SQLite internals.

---

## 9. Data Model Summary

The platform defines **23 Prisma models** with the following relationships and key fields:

| # | Model | Purpose | Key Relationships |
|---|---|---|---|
| 1 | `Tenant` | Organization isolation root | Has many Users, Incidents, Agents, etc. |
| 2 | `User` | Platform user accounts | Belongs to Tenant; has role enum |
| 3 | `PollingUnit` | Individual polling locations | Belongs to Ward; has many Incidents, PVT entries |
| 4 | `Ward` | Administrative subdivision | Belongs to LGA; has many PollingUnits |
| 5 | `LGA` | Local Government Area | Belongs to State; has many Wards |
| 6 | `State` | Nigerian state | Belongs to GeoZone; has many LGAs |
| 7 | `GeoZone` | Geo-political zone | Has many States |
| 8 | `Incident` | Election incident reports | Belongs to Tenant, PollingUnit, User |
| 9 | `Evidence` | Uploaded media evidence | Belongs to Incident; has C2PA metadata |
| 10 | `PvtEntry` | Parallel vote tabulation | Belongs to Tenant, PollingUnit, User |
| 11 | `OsintItem` | Monitored OSINT content | Belongs to Tenant |
| 12 | `Flashpoint` | Violence risk prediction | Belongs to Tenant, State |
| 13 | `Honeypot` | Decoy polling unit | Belongs to Tenant, PollingUnit |
| 14 | `GeofenceZone` | Agent check-in zone | Belongs to Tenant |
| 15 | `GeofenceCheckIn` | Agent check-in records | Belongs to GeofenceZone, User |
| 16 | `CampaignEvent` | Tracked campaign activity | Belongs to Tenant, State |
| 17 | `SuppressionReport` | Voter suppression incident | Belongs to Tenant, PollingUnit, User |
| 18 | `WhatsAppSession` | Agent WhatsApp link | Belongs to User |
| 19 | `MessageTemplate` | Mobilization templates | Belongs to Tenant |
| 20 | `MessageLog` | Sent message records | Belongs to Tenant, User, MessageTemplate |
| 21 | `AgentInfraction` | Agent violation records | Belongs to User |
| 22 | `SecurityEvent` | Security audit events | Belongs to Tenant, User |
| 23 | `BiometricProfile` | Behavioral biometric data | Belongs to User |

**Notable design decisions:**

- All tenant-scoped models include a `tenantId` field for query-based isolation
- Geographic hierarchy is modeled as `GeoZone → State → LGA → Ward → PollingUnit`
- The `User` model stores role as a Prisma enum (`SUPER_ADMIN`, `TENANT_ADMIN`, `ANALYST`, `TRUST_SAFETY`, `FIELD_AGENT`)
- Email serves as the unique identifier (no username field)

---

## 10. API Architecture

### 10.1 Design Principles

- **REST architecture** with JSON request/response bodies
- **Query-based tenant identification**: All tenant-scoped endpoints accept `?tenantId=xxx` as a query parameter (no JWT claims or headers)
- **Centralized `fetchJson` wrapper**: A shared utility function handles all API communication, including base URL resolution, error handling, and response parsing
- **Flat route structure**: All API routes exist under a single `/api/` prefix without nested resource routing

### 10.2 Route Inventory (28 Routes)

| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | GET | `/api/health` | System health check |
| 2 | GET | `/api/tenants` | List all tenants |
| 3 | POST | `/api/tenants` | Create tenant |
| 4 | GET | `/api/users` | List users (filtered by tenantId) |
| 5 | POST | `/api/users` | Create user |
| 6 | PATCH | `/api/users/[id]` | Update user |
| 7 | DELETE | `/api/users/[id]` | Delete user |
| 8 | GET | `/api/incidents` | List incidents |
| 9 | POST | `/api/incidents` | Create incident |
| 10 | PATCH | `/api/incidents/[id]` | Update incident |
| 11 | DELETE | `/api/incidents/[id]` | Delete incident |
| 12 | GET | `/api/pvt` | List PVT entries |
| 13 | POST | `/api/pvt` | Submit PVT entry |
| 14 | GET | `/api/osint` | List OSINT items |
| 15 | GET | `/api/evidence` | List evidence items |
| 16 | POST | `/api/evidence` | Upload evidence |
| 17 | GET | `/api/flashpoints` | List flashpoint predictions |
| 18 | GET | `/api/honeypots` | List honeypot units |
| 19 | POST | `/api/honeypots` | Create honeypot |
| 20 | GET | `/api/geofences` | List geofence zones |
| 21 | POST | `/api/geofences/checkin` | Submit check-in |
| 22 | GET | `/api/campaigns` | List campaign events |
| 23 | POST | `/api/campaigns` | Create campaign event |
| 24 | GET | `/api/suppression` | List suppression reports |
| 25 | POST | `/api/suppression` | Create suppression report |
| 26 | GET | `/api/security/events` | List security events |
| 27 | GET | `/api/security/policies` | Get security policies |
| 28 | PATCH | `/api/security/policies` | Update security policies |

### 10.3 Authentication & Authorization

> **⚠ Critical Gap**: In v2.1, there is **no authentication middleware**. All API routes are publicly accessible. The `tenantId` query parameter is the sole mechanism for data scoping, and it can be manipulated by any client. See Section 13 (Risk Register) for detailed security implications.

---

## 11. User Stories

### SUPER_ADMIN

| ID | As a... | I want to... | So that... |
|---|---|---|---|
| US-01 | Super Admin | create and manage tenant organizations | I can onboard new CSO partners independently |
| US-02 | Super Admin | view system health metrics | I can ensure platform availability during elections |
| US-03 | Super Admin | configure security policies | I can enforce organizational security standards |
| US-04 | Super Admin | lock compromised user accounts | I can respond to security incidents immediately |

### TENANT_ADMIN

| ID | As a... | I want to... | So that... |
|---|---|---|---|
| US-05 | Tenant Admin | manage users within my tenant | I can provision field agents and analysts as needed |
| US-06 | Tenant Admin | receive dead-man's switch alerts | I can coordinate emergency response for at-risk agents |
| US-07 | Tenant Admin | send bulk messages to agent segments | I can rapidly disseminate critical information |
| US-08 | Tenant Admin | view honeypot deviation alerts | I can detect coordinated result manipulation |

### ANALYST

| ID | As a... | I want to... | So that... |
|---|---|---|---|
| US-09 | Analyst | drill down from national to polling unit level | I can identify localized incident patterns |
| US-10 | Analyst | compare PVT results against official results | I can quantify result discrepancies |
| US-11 | Analyst | review OSINT feeds with CIB scoring | I can identify disinformation campaigns |
| US-12 | Analyst | run wargame simulations | I can prepare response strategies for anticipated threats |

### TRUST_SAFETY

| ID | As a... | I want to... | So that... |
|---|---|---|---|
| US-13 | Trust & Safety Officer | verify evidence C2PA signatures | I can confirm media authenticity for legal proceedings |
| US-14 | Trust & Safety Officer | run steganography scans on uploads | I can detect manipulated evidence |

### FIELD_AGENT

| ID | As a... | I want to... | So that... |
|---|---|---|---|
| US-15 | Field Agent | submit incident reports with GPS and media | I can document electoral violations from my polling unit |

---

## 12. Acceptance Criteria

### 12.1 Incident Management

- [x] System accepts incident reports with all 14 types
- [x] Severity assignment triggers auto-alert for HIGH and CRITICAL
- [x] GPS coordinates deviating >5% from PU location display warning
- [x] Analysts can quarantine and dismiss incidents
- [x] Incident status transitions follow the defined lifecycle

### 12.2 Situation Room

- [x] Hierarchical drill-down functions across all 5 geographic levels
- [x] Tier selection filters all aggregate statistics
- [x] KPI cards display accurate counts per selected scope

### 12.3 OSINT Monitoring

- [x] All 8 platforms are represented in the monitoring feed
- [x] CIB scores range from 0.0 to 1.0
- [x] Bot detection flags accounts above threshold
- [x] Sentiment classification applies to all monitored items

### 12.4 PVT / Quick Count

- [x] SHA256 hashes are generated per submission
- [x] Delta calculation flags entries >5% deviation
- [x] Sankey diagram renders vote flow visualization

### 12.5 Evidence Management

- [x] C2PA provenance metadata is generated for uploads
- [x] Steganography scan results include ELA, noise, and metadata analysis
- [x] Manipulation type is classified into one of 5 categories

### 12.6 Geofencing & Safety

- [x] Dead-man's switch escalates through all 4 levels
- [x] Auto-SOS triggers at level 3
- [x] Check-in records capture GPS and timestamp

### 12.7 Multi-Tenant Isolation

- [x] Data queries include tenantId filtering
- [x] Tenant deletion cascades across all related tables
- [x] Cross-tenant data access is not possible through the UI

---

## 13. Risk Register

### 13.1 Critical Security Gaps

| Risk ID | Risk | Severity | Likelihood | Impact | Current State |
|---|---|---|---|---|---|
| RSK-01 | **No authentication middleware** — All 28 API routes are publicly accessible without any authentication check | Critical | Certain | Complete data exposure; unauthorized CRUD operations | No auth layer exists |
| RSK-02 | **No JWT or session management** — User identity is stored in React state only;刷新 clears identity | Critical | Certain | Session hijacking; impersonation | In-memory email storage |
| RSK-03 | **No RBAC enforcement on API** — Role checks exist only on the frontend; backend routes accept any request | Critical | Certain | Privilege escalation; field agents accessing admin endpoints | Frontend-only role filtering |
| RSK-04 | **TenantId query parameter manipulation** — Any client can supply any tenantId to access other tenants' data | Critical | Certain | Complete multi-tenant data breach | Query parameter with no validation |
| RSK-05 | **SQLite single-file database** — No concurrent write support; file-level vulnerability | High | Moderate | Data corruption under load; file system attacks | Atomic writes mitigate some risk |
| RSK-06 | **AES-256 encryption is cosmetic** — Labeled as encrypted but no actual encryption is applied | High | Certain | False sense of security; data at rest is plaintext | UI label only |
| RSK-07 | **No input sanitization on API routes** — Raw user input passed to database queries | High | Moderate | SQL injection (mitigated by Prisma); XSS through stored data | Prisma parameterizes queries |
| RSK-08 | **No rate limiting on API** — Unlimited requests per client | Medium | High | DoS; brute force; data scraping | No middleware |
| RSK-09 | **Simulated AI/ML outputs** — All AI features return mock data | Medium | Certain | Misleading intelligence; false confidence in predictions | Hardcoded responses |
| RSK-10 | **No WebSocket real-time** — 30-second polling creates latency and server load | Low | Certain | Delayed alerting under high load; unnecessary requests | Acceptable for current scale |

### 13.2 Operational Risks

| Risk ID | Risk | Mitigation |
|---|---|---|
| RSK-11 | WhatsApp Bridge service failure | Health check monitoring; fallback to manual communication |
| RSK-12 | GPS spoofing by field agents | GPS anomaly detection (>5% deviation flag) |
| RSK-13 | False incident reports flooding the system | Quarantine flagging; analyst verification workflow |
| RSK-14 | Single point of failure (SQLite + Bun on one server) | Regular backups; future migration to PostgreSQL |

---

## 14. Future Roadmap

### 14.1 v2.2 — Security Hardening (Immediate Priority)

| Feature | Description |
|---|---|
| **JWT Authentication** | Implement JSON Web Token issuance, validation, and refresh |
| **bcrypt Password Hashing** | Replace email-only auth with email + hashed password |
| **API Middleware** | Add authentication and RBAC middleware to all 28 routes |
| **Server-Side Tenant Validation** | Validate tenantId against authenticated user's tenant |
| **Rate Limiting** | Implement per-IP and per-user rate limiting |
| **CORS Configuration** | Restrict API access to authorized origins |

### 14.2 v3.0 — Platform Evolution

| Feature | Description |
|---|---|
| **PostgreSQL Migration** | Replace SQLite with PostgreSQL for concurrent writes, full-text search, and JSONB support |
| **WebSocket Real-Time** | Implement Socket.IO or native WebSocket for true real-time updates |
| **Real AI/ML Integration** | Connect to actual model endpoints for steganography, CIB scoring, flashpoint forecasting, and NLP |
| **Native Mobile Apps** | React Native or Flutter applications for field agents with offline-first architecture |
| **End-to-End Encryption** | Implement E2E encryption for evidence files and sensitive communications |
| **Advanced Audit Logging** | Immutable audit trail with cryptographic signing |
| **Multi-Region Deployment** | Support for election monitoring outside Nigeria |
| **Email/SSO Authentication** | Support for Google, Microsoft SSO and email-based magic links |
| **Automated Reporting** | PDF/DOCX report generation with scheduled delivery |
| **Data Export API** | Structured data export for integration with external analysis tools |

### 14.3 Long-Term Vision (v4.0+)

- Satellite imagery integration for polling unit verification
- Blockchain-based evidence storage for tamper-proof chain of custody
- Machine learning models trained on Nigerian election data
- Real-time collaboration (multiple analysts on same incident)
- Public-facing transparency dashboard (anonymized data)
- Integration with INEC's official result transmission system
- Predictive analytics for voter turnout modeling

---

## Appendix A: Glossary

| Term | Definition |
|---|---|
| BVAS | Bimodal Voter Accreditation System — INEC's device for biometric voter verification |
| C2PA | Coalition for Content Provenance and Authenticity — standard for digital content provenance |
| CIB | Coordinated Inauthentic Behavior — organized manipulation campaigns using fake accounts |
| CSO | Civil Society Organization |
| ELA | Error Level Analysis — image forensics technique |
| INEC | Independent National Electoral Commission — Nigeria's election management body |
| LGA | Local Government Area |
| OSINT | Open-Source Intelligence |
| PVT | Parallel Vote Tabulation |
| RBAC | Role-Based Access Control |
| WABA | WhatsApp Business API |

---

## Appendix B: Document Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0.0 | 2025-01-15 | Platform Team | Initial BRD/PRD creation |
| 2.0.0 | 2025-04-01 | Platform Team | Added honeypot, wargame, biometric modules |
| 2.1.0 | 2025-07-11 | Platform Team | Synthesized BRD/PRD; added risk register; documented security gaps; updated roadmap |

---

*This document is auto-synthesized from the OmniVote Monitor v2.1 codebase analysis. All functional requirements reflect the implemented state of the system as of the v2.1 release, including simulated features and known security gaps documented in Section 13.*