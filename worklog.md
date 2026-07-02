---
Task ID: 1
Agent: Main
Task: Implement 14+ Election Day Operations features, Security Hardening, Geofencing & Dead-Man's Switch

Work Log:
- Read full codebase: Prisma schema (15→23 models), all API routes, all UI components, store, sidebar, page.tsx
- Added 8 new Prisma models: PvtSubmission, ResultComparison, EvidenceDossier, StegoScanResult, HoneypotUnit, FlashpointForecast, WargameScenario, AccessibilityReport
- Updated Tenant and PollingUnit models with reverse relations
- Ran Prisma migration (init after DB reset due to corrupted DB)
- Built 4 new API routes in parallel via subagents:
  - /api/pvt — PVT submission CRUD, auto-comparison generation, Sankey data aggregation
  - /api/evidence — Evidence dossier CRUD, stego scan simulation, EC portal status
  - /api/flashpoint — Flashpoint forecast CRUD, wargame scenario management, heatmap data
  - /api/honeypot — Honeypot CRUD with deviation detection, biometrics summary, accessibility reports
- Built 4 new UI components in parallel via subagents:
  - pvt-quick-count.tsx — Custom SVG Sankey diagram, party bar chart, anomaly table, coverage stats
  - evidence-dossier.tsx — 3 tabs (Dossiers, Stego Analysis, EC Portal), C2PA badges, stego scan results
  - flashpoint-wargame.tsx — 2 tabs (Risk Forecast with CSS grid heatmap, Wargame Simulator with timeline)
  - honeypot-biometrics.tsx — 3 tabs (Honeypot Stations, Biometrics, PWD/Accessibility), deviation detection UI
- Updated store/dashboard.ts: Added 'pvt', 'evidence', 'flashpoint', 'honeypot' to ViewTab union and ROLE_TABS
- Updated sidebar.tsx: Added 4 new nav items with icons (BarChart3, FileText, Activity, Eye)
- Updated page.tsx: Added imports and rendering for 4 new tab components
- Created seed-election-day.ts: Comprehensive seed for all 8 new models (40 PVT submissions, comparisons, 36 dossiers + stego scans, 45 honeypots, 21 forecasts, 9 wargame scenarios, 75 accessibility reports, 60 security events, 15 geofence zones with check-ins)
- Fixed seed-modules.ts to use dynamic tenant lookup (old hardcoded IDs broke after DB reset)
- Verified: `next build` succeeds with 0 errors, all 27 routes registered
- Verified: All 5 new APIs return correct data (PVT: 40 submissions, Evidence: 12 dossiers, Flashpoint: 7 forecasts, Honeypot: 15 units, Geofence: 5 zones)

Stage Summary:
- 8 new Prisma models added and migrated
- 4 new API routes built with full CRUD + aggregation
- 4 new UI components built (~4500+ lines total) with interactive visualizations
- All wired into sidebar, store, and page routing with RBAC
- Full seed data created for all new modules across 3 tenants
- Production build verified with zero compilation errors