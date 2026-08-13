const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel,
  PageBreak, PageNumber, SectionType, TableOfContents,
  Table, TableRow, TableCell, WidthType, TableLayoutType,
  ShadingType, BorderStyle, Header, Footer, TabStopType, TabStopPosition
} = require('docx');

// ═══════════════════════════════════════════════════════════════
// LIGHT THEME PALETTE & CONSTANTS
// ═══════════════════════════════════════════════════════════════
const palette = {
  cover: {
    bg: "FFFFFF",
    titleColor: "0F2B1C",
    subtitleColor: "3D6B52",
    metaColor: "5A7D68",
    footerColor: "8FA89A",
    accent: "007847",
  },
  body: "1F2937",
  primary: "0F2B1C",
  secondary: "5A7D68",
  accent: "007847",
  surface: "F0FDF4",
  table: {
    headerBg: "007847",
    headerText: "FFFFFF",
    accentLine: "007847",
    innerLine: "C6E9D5",
    surface: "F0FDF4",
  },
};

const c = (hex) => hex.replace("#", "");
const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

// ═══════════════════════════════════════════════════════════════
// COVER: R1 Light Theme with APC Green accent
// ═══════════════════════════════════════════════════════════════

function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const charWidth = (pt) => pt * 11;
  const preferredWidth = charWidth(preferredPt);
  const lines = [];
  let remaining = title;
  while (remaining.length > 0) {
    const maxChars = Math.floor(maxWidthTwips / preferredWidth);
    if (remaining.length <= maxChars) { lines.push(remaining); remaining = ""; }
    else {
      let breakAt = remaining.lastIndexOf(' ', maxChars);
      if (breakAt < maxChars * 0.5) breakAt = maxChars;
      lines.push(remaining.substring(0, breakAt).trim());
      remaining = remaining.substring(breakAt).trim();
    }
  }
  return { titlePt: preferredPt, titleLines: lines };
}

function calcCoverSpacing(params) {
  const { titleLineCount = 1, titlePt = 36, hasSubtitle = false, hasEnglishLabel = false, metaLineCount = 0, fixedHeight = 800, pageHeight = 16838, marginTop = 0, marginBottom = 0 } = params;
  const SAFETY = 1200;
  const usableHeight = pageHeight - marginTop - marginBottom - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (12 * 23 + 600) : 0;
  const englishLabelHeight = hasEnglishLabel ? (9 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const implicitParaHeight = 3 * 300;
  const contentHeight = titleHeight + subtitleHeight + englishLabelHeight + metaHeight + fixedHeight + implicitParaHeight;
  const remainingSpace = usableHeight - contentHeight;
  const safeRemaining = Math.max(remainingSpace, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.45);
  const rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  return { topSpacing, midSpacing: 0, bottomSpacing };
}

function buildCoverR1(config) {
  const P = config.palette;
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 40, 24);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length, fixedHeight: 400,
  });
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };
  const accentBottom = { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 };
  const children = [];
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing }, children: [new TextRun({ text: "", size: 2 })] }));
  if (config.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 500 },
      border: { bottom: accentBottom },
      children: [new TextRun({ text: config.englishLabel.split("").join("  "),
        size: 18, color: P.accent, font: { ascii: "Calibri" }, characterSpacing: 40, bold: true })],
    }));
  }
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true,
        color: P.titleColor, font: { ascii: "Arial" } })],
    }));
  }
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL }, spacing: { after: 800 },
      children: [new TextRun({ text: config.subtitle, size: 24, color: P.subtitleColor, italics: true,
        font: { ascii: "Calibri" } })],
    }));
  }
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 22, color: P.metaColor, font: { ascii: "Calibri" } })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing }, children: [new TextRun({ text: "", size: 2 })] }));
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || "", size: 16, color: P.footerColor, font: { ascii: "Calibri" } }),
      new TextRun({ text: "                                        " }),
      new TextRun({ text: config.footerRight || "", size: 16, color: P.footerColor, font: { ascii: "Calibri" } }),
    ],
  }));
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: noBorders, children,
      })],
    })],
  })];
}

// ═══════════════════════════════════════════════════════════════
// BODY COMPONENTS
// ═══════════════════════════════════════════════════════════════

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1, outlineLevel: 0,
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text, bold: true, size: 32, color: c(palette.primary), font: { ascii: "Times New Roman" } })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2, outlineLevel: 1,
    spacing: { before: 280, after: 160 },
    children: [new TextRun({ text, bold: true, size: 28, color: c(palette.primary), font: { ascii: "Times New Roman" } })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3, outlineLevel: 2,
    spacing: { before: 200, after: 120 },
    children: [new TextRun({ text, bold: true, size: 26, color: c(palette.primary), font: { ascii: "Times New Roman" } })],
  });
}
function body(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED, spacing: { line: 312, after: 120 },
    children: [new TextRun({ text, size: 24, color: c(palette.body), font: { ascii: "Times New Roman" } })],
  });
}
function bodyBold(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED, spacing: { line: 312, after: 120 },
    children: [new TextRun({ text, size: 24, color: c(palette.body), font: { ascii: "Times New Roman" }, bold: true })],
  });
}
function emptyPara() {
  return new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "", size: 24 })] });
}
function bullet(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT, spacing: { line: 312, after: 80 },
    indent: { left: 480, hanging: 240 },
    children: [
      new TextRun({ text: "\u2022  ", size: 24, color: c(palette.accent), font: { ascii: "Calibri" } }),
      new TextRun({ text, size: 24, color: c(palette.body), font: { ascii: "Times New Roman" } }),
    ],
  });
}

function makeTable(headers, rows) {
  const t = palette.table;
  const cellMargins = { top: 60, bottom: 60, left: 120, right: 120 };
  const headerRow = new TableRow({
    tableHeader: true, cantSplit: true,
    children: headers.map(h => new TableCell({
      shading: { type: ShadingType.CLEAR, fill: t.headerBg },
      margins: cellMargins,
      children: [new Paragraph({
        alignment: AlignmentType.CENTER, spacing: { line: 312 },
        children: [new TextRun({ text: h, bold: true, size: 21, color: t.headerText, font: { ascii: "Calibri" } })],
      })],
    })),
  });
  const dataRows = rows.map((row, idx) => new TableRow({
    cantSplit: true,
    children: row.map(cell => new TableCell({
      shading: { type: ShadingType.CLEAR, fill: idx % 2 === 0 ? t.surface : "FFFFFF" },
      margins: cellMargins,
      children: [new Paragraph({
        alignment: AlignmentType.LEFT, spacing: { line: 312 },
        children: [new TextRun({ text: cell, size: 21, color: c(palette.body), font: { ascii: "Calibri" } })],
      })],
    })),
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: t.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: t.accentLine },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: t.innerLine },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [headerRow, ...dataRows],
  });
}

function tableCaption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { before: 80, after: 200 },
    children: [new TextRun({ text, italics: true, size: 21, color: c(palette.secondary), font: { ascii: "Calibri" } })],
  });
}

function romanFooter() {
  return new Footer({ children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080", font: { ascii: "Calibri" } })],
  })] });
}
function arabicFooter() {
  return new Footer({ children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080", font: { ascii: "Calibri" } })],
  })] });
}
function bodyHeader() {
  return new Header({ children: [new Paragraph({
    alignment: AlignmentType.RIGHT, spacing: { after: 0 },
    children: [new TextRun({ text: "APC State Campaign Office \u2014 Comprehensive Proposal", size: 18, color: "808080", font: { ascii: "Calibri" }, italics: true })],
  })] });
}

// ═══════════════════════════════════════════════════════════════
// DOCUMENT CONTENT
// ═══════════════════════════════════════════════════════════════

const bodyContent = [
  // ═══ 1. EXECUTIVE SUMMARY ═══
  h1("1. Executive Summary"),
  body("This proposal presents a comprehensive, technology-enabled solution for establishing a fully operational APC State Campaign Office that serves as the central nervous system for all electoral activities within the state. The proposed framework addresses the critical need for a centralised command structure that integrates voter data management, real-time communication, field coordination, election monitoring, volunteer mobilisation, financial tracking, and security governance into a single, cohesive platform. In an era where political campaigns are increasingly won or lost on the strength of operational efficiency and data-driven decision-making, the APC must leverage modern campaign technology to maintain its competitive advantage across all senatorial districts and local government areas."),
  body("The solution centres on four interconnected pillars: a robust digital infrastructure comprising eight integrated platform modules that provide real-time analytics, voter intelligence, and operational control; an organised field operations framework that empowers ward-level coordinators with mobile tools and standardised processes; an integrated multi-channel communication system that ensures seamless information flow between the state headquarters, zone coordinators, and grassroots volunteers; and a comprehensive security and compliance layer that protects sensitive voter data and ensures adherence to INEC regulations. Together, these pillars create a campaign operation that is responsive, accountable, and capable of adapting to changing electoral dynamics throughout the campaign cycle."),
  body("The platform encompasses eight core modules: a Voter Intelligence Database with advanced segmentation and predictive analytics; a Real-Time Analytics Dashboard with geospatial visualisation and drill-down capabilities; a Field Coordination Mobile Application with offline-first architecture; an Election Monitoring and Incident Response System with structured escalation workflows; a Communication and Messaging Hub supporting SMS, WhatsApp, email, and in-app notifications; a Volunteer Management System with recruitment pipelines and performance tracking; a Financial Tracking and Resource Management module with budget controls and inventory management; and a Security, Compliance, and Data Governance module with role-based access control, encryption, and audit logging."),
  body("The estimated total investment for the initial setup and first six months of operation is approximately N85 million, covering technology infrastructure, staffing, training, logistics, and contingency reserves. This investment is projected to yield measurable improvements in voter outreach coverage, volunteer mobilisation rates, incident response times, and overall electoral performance. The implementation roadmap spans twelve weeks from approval to full operational capability."),

  // ═══ 2. CURRENT STATE ═══
  h1("2. Current State and Problem Analysis"),
  h2("2.1 Existing Campaign Infrastructure"),
  body("The current state of APC state-level campaign operations across most Nigerian states relies heavily on informal organisational structures that have remained largely unchanged since the 2015 general elections. Field coordinators typically operate from personal residences or rented spaces that lack consistent power supply, internet connectivity, and basic office equipment. Communication between the state headquarters and ward-level units depends on personal mobile phone calls and WhatsApp groups, which, while effective for simple messaging, lack the structure, auditability, and scalability required for a modern campaign managing hundreds of thousands of voter interactions across geographically dispersed polling units."),
  body("Voter data, where it exists at all, is typically stored in disconnected spreadsheets maintained by individual local government coordinators. There is no centralised voter database that provides a unified view of voter demographics, registration status, past voting behaviour, or issue-based segmentation. Financial tracking, if performed at all, consists of manual ledger entries that are opaque, difficult to audit, and vulnerable to mismanagement. Volunteer mobilisation follows no systematic process. Recruitment happens through personal networks rather than structured outreach, training is inconsistent and undocumented, and there is no mechanism for tracking volunteer attendance, performance, or retention."),
  h2("2.2 Key Challenges Identified"),
  makeTable(
    ["Challenge Area", "Description", "Impact"],
    [
      ["Fragmented Voter Data", "Records scattered across spreadsheets with no central repository", "Critical"],
      ["Communication Gaps", "Informal channels; 24-48 hour delays for critical updates", "High"],
      ["No Real-Time Visibility", "No live dashboards for field activity or voter sentiment", "Critical"],
      ["Volunteer Management Vacuum", "No recruitment, training, or performance tracking system", "High"],
      ["Financial Opacity", "Manual ledgers, no real-time budget monitoring", "High"],
      ["Weak Election Monitoring", "Ad-hoc phone calls; no structured incident reporting", "Critical"],
      ["Security Vulnerabilities", "Unencrypted channels; no role-based access control", "Critical"],
      ["No Predictive Analytics", "Decisions based on anecdote rather than data modelling", "Medium"],
    ]
  ),
  tableCaption("Table 1: Comprehensive Challenge Matrix"),
  h2("2.3 Strategic Implications"),
  body("The cumulative effect of these challenges is a campaign operation that reacts slowly to emerging situations, fails to capitalise on favourable voter dynamics, and cannot provide state-level leadership with the timely intelligence needed for strategic decision-making. In closely contested states where margins of victory can be as narrow as a few thousand votes, these operational deficiencies translate directly into lost votes and, ultimately, lost elections. The 2023 electoral cycle demonstrated that opposition parties who invested in centralised campaign technology and data-driven field operations were able to achieve significant gains in previously safe APC territories."),

  // ═══ 3. GOALS ═══
  h1("3. Goals and Expected Outcomes"),
  h2("3.1 Primary Objectives"),
  makeTable(
    ["Objective", "KPI", "Target"],
    [
      ["Centralise Voter Data", "Registered voters in digitised database", "90% within 8 weeks"],
      ["Real-Time Communication", "Critical alert delivery time", "Under 15 minutes"],
      ["Field Coordination", "Ward coordinators with mobile access", "100% coverage"],
      ["Election Monitoring", "Polling units with trained observers", "95% on election day"],
      ["Volunteer Management", "Registered and trained volunteers", "5,000+ within 10 weeks"],
      ["Financial Transparency", "Expenditure tracked in real-time", "100% of spending"],
      ["Resource Efficiency", "Material wastage reduction", "40% reduction"],
      ["Security Compliance", "Staff with security training and NDA", "100% before access"],
    ]
  ),
  tableCaption("Table 2: Primary Objectives and KPIs"),
  h2("3.2 Expected Outcomes"),
  body("Upon full implementation, the state campaign office will operate as a professional, data-driven organisation capable of supporting thousands of field operatives across all local government areas. The centralised voter intelligence system will enable micro-targeting of campaign messages to specific demographic groups, issue-based voter engagement at the polling unit level, and predictive modelling of voter turnout that allows the campaign to focus resources where they will have the greatest electoral impact. The integrated monitoring and incident response framework will provide the party with an unprecedented ability to detect, report, and escalate electoral irregularities in real time."),
  body("Furthermore, the communication infrastructure will persist beyond election day, providing the party with a permanent organising platform for governance engagement, membership mobilisation, and future electoral preparation. The institutional knowledge captured through the platform's data layers and operational logs will accumulate across election cycles, building a permanent competitive advantage that grows stronger with each successive campaign."),

  // ═══ 4. SOLUTION ARCHITECTURE ═══
  h1("4. Solution Architecture Overview"),
  h2("4.1 High-Level System Architecture"),
  body("The campaign technology platform follows a modern, cloud-native microservices architecture designed for scalability, reliability, and rapid iteration. The system is organised into four architectural layers: the Presentation Layer comprising the web dashboard and mobile applications; the Application Layer containing the eight core platform modules as independent microservices; the Data Layer managing persistent storage, caching, and search indexing; and the Infrastructure Layer providing cloud hosting, content delivery, and security services. Each layer communicates through well-defined APIs, enabling independent scaling, deployment, and maintenance of individual components."),
  body("The platform is designed with a mobile-first philosophy, recognising that the majority of end-users will interact with the system primarily through smartphones. The web dashboard serves as the command centre for state-level leadership, providing comprehensive oversight and analytical capabilities. The mobile application is optimised for low-bandwidth environments and intermittent connectivity, employing an offline-first architecture that synchronises data transparently whenever connectivity becomes available."),
  h2("4.2 Technology Stack"),
  makeTable(
    ["Layer", "Technology", "Rationale"],
    [
      ["Frontend (Web)", "React.js + TypeScript, Tailwind CSS", "Component reusability, type safety"],
      ["Frontend (Mobile)", "React Native with Expo", "Single codebase, offline SQLite"],
      ["Backend API", "Node.js with Fastify", "High throughput, JS consistency"],
      ["Database", "PostgreSQL + Redis", "ACID compliance, fast cache"],
      ["Search", "Elasticsearch", "Full-text search, geospatial queries"],
      ["File Storage", "AWS S3 / MinIO", "Scalable media storage"],
      ["Real-Time", "WebSocket (Socket.io) + Push", "Instant alerts, live updates"],
      ["Auth", "OAuth 2.0 + JWT", "Secure stateless authentication"],
      ["Cloud", "AWS / Azure multi-AZ", "High availability, auto-scaling"],
      ["CI/CD", "GitHub Actions + Docker + K8s", "Automated deploy and rollback"],
      ["Monitoring", "Grafana + Prometheus + Sentry", "Health, errors, alerting"],
    ]
  ),
  tableCaption("Table 3: Technology Stack"),
  h2("4.3 Data Flow Architecture"),
  body("Data flows through the platform in a structured pipeline ensuring consistency, auditability, and real-time availability. Field data captured through the mobile application is first stored locally in an encrypted SQLite database, then synchronised to the central server via a queued replication mechanism with conflict resolution using last-write-wins with operational transformation for concurrent edits. The event-driven architecture uses a message broker to decouple modules, ensuring reliable data propagation. When an incident report is submitted, the event triggers simultaneous notifications to the monitoring dashboard, the communications module, and the analytics engine, all without blocking the original submission."),
  h2("4.4 API Architecture and Integration Points"),
  body("All inter-module communication is mediated through a centralised API Gateway that handles authentication, rate limiting, request validation, and routing. Each module exposes a RESTful API following OpenAPI 3.0 specifications with versioned endpoints. The gateway enforces per-role rate limits to prevent abuse and ensures that all requests are logged to the audit trail. Webhook subscriptions allow external systems to receive real-time event notifications for integration with INEC result portals, media monitoring services, and third-party analytics tools."),
  makeTable(
    ["Module", "Key API Endpoints", "Authentication", "Rate Limit"],
    [
      ["VID", "GET /voters, POST /segments, GET /search", "JWT + RBAC", "100 req/min"],
      ["Dashboard", "GET /widgets, GET /kpi, WS /live", "JWT + RBAC", "200 req/min"],
      ["Field App", "POST /visits, POST /incidents, GET /tasks", "JWT + Device", "50 req/min"],
      ["Monitoring", "GET /incidents, PUT /escalate, WS /situations", "JWT + RBAC", "150 req/min"],
      ["Comms", "POST /broadcast, GET /templates, POST /whatsapp", "JWT + RBAC", "80 req/min"],
      ["VMS", "GET /volunteers, POST /shifts, GET /leaderboard", "JWT + RBAC", "60 req/min"],
      ["Finance", "POST /expenses, PUT /approve, GET /budget", "JWT + RBAC", "40 req/min"],
      ["Security", "GET /audit, POST /roles, GET /compliance", "MFA + Admin", "30 req/min"],
    ]
  ),
  tableCaption("Table 4: API Endpoint Summary"),

  // ═══ 5. PLATFORM MODULES ═══
  h1("5. Platform Modules \u2014 Detailed Specification"),
  body("This section provides in-depth technical and functional specifications for each of the eight core platform modules, covering purpose, features, data models, user interface components, integration points, performance requirements, user flows, and edge case handling."),

  // ── 5.1 VOTER INTELLIGENCE DATABASE ──
  h2("5.1 Voter Intelligence Database (VID)"),
  h3("5.1.1 Module Overview"),
  body("The Voter Intelligence Database (VID) is the foundational data module serving as the single source of truth for all voter-related information. It consolidates data from INEC official voter registers, party membership databases, field survey responses, previous election result datasets, and real-time interaction logs. The VID supports complex queries, multi-dimensional segmentation, and predictive analytics that drive all other platform modules. The database is designed to handle up to five million voter records per state with sub-500-millisecond query response times, even under concurrent access from hundreds of field agents and dashboard users."),
  h3("5.1.2 Data Model"),
  makeTable(
    ["Domain", "Key Fields", "Source", "Refresh"],
    [
      ["Demographic", "Age, gender, occupation, education, language", "INEC + surveys", "Monthly"],
      ["Geographic", "PU code, ward, LGA, district, GPS", "INEC + geocoding", "Initial"],
      ["Electoral History", "Past turnout, PVC status, party affiliation", "INEC + party data", "Per cycle"],
      ["Engagement", "Visit logs, calls, events, digital clicks", "Field app + CRM", "Real-time"],
      ["Issue Preferences", "Top 3 concerns, sentiment score", "Field surveys", "Weekly"],
      ["Predictive Scores", "Turnout probability, party affinity", "ML model output", "Bi-weekly"],
    ]
  ),
  tableCaption("Table 5: Voter Data Domains"),
  h3("5.1.3 Key Features"),
  body("Advanced Search and Filtering: Full-text search across all voter fields using Elasticsearch, with filters for any combination of attributes. Users save complex filter combinations as named segments. Search results return in under 500 milliseconds with instant type-ahead suggestions displaying matching names with polling unit context. The search index is incrementally updated within three seconds of any data change, ensuring field agents always see the most current information."),
  body("Dynamic Segmentation Engine: Rule-based dynamic segments that automatically update as new data flows in. Supports AND/OR/NOT logic with nested conditional groups. A segment like 'First-time voters aged 18-25 in urban LGAs with high persuadability not yet contacted' grows or shrinks automatically, eliminating manual re-querying. Segments can be shared across teams with read-only or edit permissions, and any segment can be exported directly to the Communication Hub as a messaging audience."),
  body("Voter Profile Dashboard: 360-degree profile view with interaction timeline, polling unit map, demographic cards, engagement heat maps, and predictive score gauges. Tabbed layout with Overview, Interactions, Predictive Scores, and Map tabs. The Overview tab displays a summary card grid showing PVC status, last contact date, sentiment trend sparkline, and assigned coordinator. The Interactions tab presents a chronological activity feed with filterable event types."),
  body("Data Import and Deduplication: Robust import pipeline accepting CSV, Excel, and JSON with configurable field mapping. Automated fuzzy matching on name, address, and VIN for deduplication using a probabilistic record linkage algorithm with configurable similarity thresholds. Data quality dashboards track completeness, accuracy, and freshness per domain. The import wizard supports preview-before-commit, allowing users to verify mappings and resolve duplicates interactively before finalising."),
  h3("5.1.4 Voter Lifecycle Management"),
  body("Every voter record progresses through a defined engagement lifecycle: New (imported, no contact), Contacted (first outreach attempted), Engaged (meaningful interaction recorded), Persuaded (positive sentiment shift detected), Committed (verbal or written pledge of support), and Mobilised (confirmed transport or polling day plan). Status transitions are triggered either manually by field agents or automatically by the system based on configurable rules, such as a sentiment score crossing a threshold or multiple positive interactions within a defined period."),
  makeTable(
    ["Status", "Definition", "Trigger Condition", "Action Required"],
    [
      ["New", "Imported, no prior contact", "Initial data import", "Assign to coordinator"],
      ["Contacted", "First outreach attempted", "Visit/call logged", "Follow-up scheduled"],
      ["Engaged", "Meaningful interaction recorded", "Visit with positive notes", "Issue-based messaging"],
      ["Persuaded", "Sentiment shift positive", "Sentiment score above 0.7", "Intensify engagement"],
      ["Committed", "Pledge of support recorded", "Verbal/written pledge logged", "Mobilisation planning"],
      ["Mobilised", "Polling day plan confirmed", "Transport/location confirmed", "Day-of reminders"],
      ["Declined", "Explicit opposition stated", "Negative sentiment + refusal", "Remove from active list"],
    ]
  ),
  tableCaption("Table 6: Voter Engagement Lifecycle"),
  h3("5.1.5 Data Governance and Quality Framework"),
  body("The VID implements a comprehensive data governance framework ensuring data integrity, consistency, and regulatory compliance. Every data modification is tracked with the user ID, timestamp, previous value, and new value in an immutable audit trail. Data quality rules enforce mandatory field completion (e.g., PVC number, polling unit code must not be null), format validation (phone numbers must match Nigerian formats), and referential integrity (ward codes must exist in the geographic hierarchy). Automated data quality reports are generated daily, scoring each LGA's data on completeness, accuracy, timeliness, and uniqueness."),
  body("Bulk data operations are performed through a dedicated Bulk Operations Centre accessible to Data Director and IT Admin roles only. Operations include bulk status updates, bulk assignment reassignment, bulk segment tagging, and data purging for records flagged as invalid. All bulk operations require confirmation with a preview of affected records and an optional dry-run mode that logs what would change without executing. A rollback mechanism allows reverting any bulk operation within 24 hours."),
  h3("5.1.6 UI Screens"),
  body("The VID web interface comprises six primary screens: Search and Explore (search bar with type-ahead plus left filter panel with collapsible sections for demographics, geography, electoral history, and engagement plus results data table with sortable columns and inline preview), Segment Builder (visual drag-and-drop rule builder with live count previews showing matching voter count and distribution), Voter Profile (tabbed layout with Overview, Interactions, Scores, Map), Data Import (multi-step wizard: upload, map, validate, confirm with progress indicators), Data Quality Dashboard (completeness heat maps, accuracy charts, deduplication queue with side-by-side comparison), and Bulk Operations Centre (operation selector, scope definition, preview, confirm, and history log). Each screen has a consistent toolbar with Export, Print, Save Segment, and Share actions."),

  // ── 5.2 ANALYTICS DASHBOARD ──
  h2("5.2 Real-Time Analytics Dashboard"),
  h3("5.2.1 Module Overview"),
  body("The Analytics Dashboard is the primary command-and-control interface for state-level leadership, providing a live, interactive overview of all campaign activities through an intuitive visual interface. It is accessible via web browser with responsive layouts for tablets, and supports configurable widget grids that users personalise by adding, removing, rearranging, and resizing widgets. The dashboard loads within two seconds on standard broadband and maintains real-time data freshness through WebSocket connections that push incremental updates without full page reloads."),
  makeTable(
    ["Widget", "Description", "Data Source", "Refresh"],
    [
      ["KPI Summary Cards", "Voters contacted, volunteers active, incidents, budget %", "All modules", "Real-time"],
      ["Geospatial Map", "Interactive state map, colour-coded by LGA, drill-down", "VID + Field + Monitor", "60s"],
      ["Activity Timeline", "Chronological field report feed with filters", "Field Coordination", "Real-time"],
      ["Sentiment Trends", "Sentiment line charts segmented by demographics", "VID Engagement", "Hourly"],
      ["Volunteer Heatmap", "Coverage vs target by area", "VMS", "30 min"],
      ["Incident Tracker", "Live incident list with severity and status", "Monitoring Module", "Real-time"],
      ["Budget Burn Rate", "Stacked area: cumulative spend vs budget", "Financial Module", "Daily"],
      ["Material Distribution", "Delivery progress by LGA/ward", "Logistics Module", "2 hours"],
      ["Turnout Prediction", "Projected turnout by LGA from ML model", "VID Predictive", "Bi-weekly"],
      ["Communication Reach", "Sent/delivered/read/responded by channel", "Comms Hub", "Hourly"],
    ]
  ),
  tableCaption("Table 7: Dashboard Widget Inventory"),
  h3("5.2.2 Interaction Features"),
  body("Drill-Down Navigation: Every widget supports click-through to progressively detailed views. Clicking an LGA on the map opens ward-level metrics; clicking a ward reveals voter-level data. Breadcrumb trails at the top allow jumping back to any hierarchy level. Cross-Widget Filtering: Selecting an LGA on the map automatically filters all other widgets to that LGA. A global filter bar provides persistent date range, LGA, and coordinator filters across all widgets."),
  body("Alert and Notification System: Intelligent alert engine monitors all streams for conditions requiring attention. Critical alerts trigger on-screen notifications with audible chimes and support escalation chains for unanswered alerts. Users acknowledge, assign, and add notes creating an audit trail. Report Generation: One-click PDF and Excel reports with configurable templates, respecting user-level data permissions. Scheduled auto-distribution via email to configured recipient lists."),
  h3("5.2.3 Role-Based Dashboard Templates"),
  body("Rather than requiring every user to build their dashboard from scratch, the system provides pre-configured templates tailored to each organisational role. These templates can be used as-is or customised. The Campaign Director template emphasises high-level KPI cards, the geospatial map, incident tracker, and budget burn rate. The Data Analyst template prioritises sentiment trends, voter coverage metrics, data quality scores, and advanced filter controls. The Field Operations Director template highlights the activity timeline, volunteer heatmap, material distribution, and route coverage."),
  makeTable(
    ["Role", "Primary Widgets", "Layout", "Data Access"],
    [
      ["Campaign Director", "KPI Cards, Map, Incidents, Budget", "2x2 grid + sidebar", "Full state"],
      ["Data Analyst", "Sentiment, Coverage, Quality, Predictions", "3-column analytical", "Full + export"],
      ["DD Field Ops", "Timeline, Volunteers, Materials, Routes", "Operations-focused", "Assigned LGAs"],
      ["DD Comms", "Reach, Sentiment, Response Rates", "Communications-focused", "Segment-level"],
      ["Zonal Coordinator", "LGA Map, Tasks, Volunteers, Incidents", "Compact mobile-adjacent", "Assigned LGA only"],
    ]
  ),
  tableCaption("Table 8: Role-Based Dashboard Templates"),
  h3("5.2.4 Real-Time Data Pipeline"),
  body("The dashboard's real-time capability is powered by a multi-layer data pipeline. A WebSocket server maintains persistent connections with all active dashboard sessions, pushing incremental data updates as they occur. For high-frequency data (incidents, alert counts), updates stream within two seconds of the originating event. For moderate-frequency data (KPI aggregations, volunteer counts), a polling interval of thirty seconds balances freshness with server load. The WebSocket connection includes automatic reconnection with exponential backoff, and a connection status indicator in the header shows green (connected), yellow (reconnecting), or red (disconnected) with a manual refresh button."),
  body("Client-side caching ensures that navigating between dashboard views is instantaneous. The dashboard framework implements optimistic UI updates, where user actions (like acknowledging an alert) immediately update the local display before server confirmation arrives. If the server rejects the action, the UI smoothly reverts with an explanatory toast notification, ensuring the user experience never feels sluggish even on variable network conditions."),

  // ── 5.3 FIELD APP ──
  h2("5.3 Field Coordination Mobile Application"),
  h3("5.3.1 Module Overview"),
  body("The Field Coordination Mobile Application is the primary tool for ward coordinators, field agents, and election observers. Built with React Native for cross-platform deployment, it provides comprehensive field operations tools that work seamlessly across all connectivity conditions through an offline-first architecture with automatic transparent synchronisation. The application is designed for Android 8.0+ devices, covering over 95% of the Nigerian smartphone market, with a target APK size of under 40MB to accommodate devices with limited storage."),
  makeTable(
    ["Feature", "Description", "Offline", "Screen Flow"],
    [
      ["Daily Activity Logger", "Structured forms for visits, calls, events", "Full", "Home > Tasks > Log Visit > Form > Submit"],
      ["Voter Search", "Search by name, PU, address; view profile", "Partial", "Voters > Search > Results > Profile"],
      ["GPS Incident Reporter", "Photos, location, severity, description", "Full", "Report > New > Category > Details > Submit"],
      ["Route Optimiser", "Optimised canvassing routes by priority", "Full", "Tasks > Route > Start Navigation"],
      ["Task Inbox", "Receive/acknowledge tasks, update status", "Full", "Home > Inbox > Detail > Accept"],
      ["Survey Tool", "Structured surveys with skip logic", "Full", "Home > Surveys > Questions > Submit"],
      ["Material Request", "Request materials with quantity/type", "Full", "Report > Material Req > Form > Submit"],
      ["Messaging", "Secure chat with coordinator/HQ", "Partial", "Messages > Conversation > Compose"],
      ["GPS Check-In", "Verified check-in at events/PU", "Full", "Home > Check-In > Confirm location"],
      ["Sync Dashboard", "View sync status, conflicts, manual trigger", "N/A", "Profile > Sync Status > Details"],
    ]
  ),
  tableCaption("Table 9: Field App Feature Matrix"),
  h3("5.3.2 Offline-First Architecture"),
  body("A local SQLite database mirrors the server schema for the user's assigned area. Initial data download (50-100 MB) prioritises critical data and defers large files to Wi-Fi. All offline modifications are recorded in a local change log with timestamps. Upon reconnection, the sync engine processes changes chronologically with configurable conflict resolution: merge for interaction logs, latest-timestamp-wins for task updates, server-precedence for deletions. A dedicated conflict resolution interface presents both versions side by side with diff highlighting, allowing the user to choose which version to keep or merge selected fields from each."),
  body("The sync engine uses a priority queue system where urgent data (incident reports, emergency alerts) is synchronised first, followed by operational data (visit logs, task updates), and finally reference data (voter records, segment definitions). A progress indicator in the notification bar shows sync activity with item count. Users can manually trigger sync from the profile screen, and the app automatically attempts sync when transitioning from background to foreground, when connectivity changes are detected, and at configurable intervals."),
  h3("5.3.3 Screen-by-Screen UI Specification"),
  body("The app uses a bottom navigation bar with five tabs: Home, Voters, Report, Messages, Profile. The Home screen shows a personalised greeting, task count with circular progress indicator, pending message badges, a horizontal scrollable quick-action bar (Log Visit, Report Incident, Check-In, Survey), and a prioritised task list. The Voters tab opens to a search-first interface with recently viewed voters and filter chips. The Report tab shows a card-based layout with colour-coded severity indicators and a prominent floating action button."),
  body("The Messages tab uses a conversation list with unread badges and last message preview. Individual conversations display messages in a familiar bubble layout: sent messages right-aligned in green-tinted bubbles, received messages left-aligned in white bubbles. The Profile tab provides settings, sync status (green check/orange spinner/red exclamation), language selection, notification preferences, and help. All touch targets are minimum 48x48dp with high-contrast text for outdoor use."),
  h3("5.3.4 Form Builder and Dynamic Data Collection"),
  body("The Field App includes a dynamic form engine that renders data collection forms defined by administrators in the web dashboard. This eliminates the need for app updates when survey questions change or new form types are introduced. Form field types supported include: single-line and multi-line text, numeric input with min/max validation, single-select and multi-select dropdowns, radio button groups, checkbox groups, date and time pickers, photo capture with automatic compression and geotagging, barcode/QR scanning, signature capture, and cascading selectors."),
  body("Each form supports conditional skip logic where the visibility of subsequent questions depends on previous answers. For example, if a respondent indicates they have not collected their PVC, the form skips detailed voting intention questions and instead shows a PVC collection guidance section. Forms also support field validation rules (required, minimum length, numeric range, phone format) with inline error messages. Form submissions are encrypted and queued for sync, with a local draft auto-save every thirty seconds to prevent data loss if the app is closed unexpectedly."),
  makeTable(
    ["Field Type", "Mobile UI Component", "Validation", "Offline Support"],
    [
      ["Text (short)", "Single-line input with character counter", "Max length, pattern", "Full"],
      ["Text (long)", "Multi-line textarea with counter", "Max length, required", "Full"],
      ["Numeric", "Numeric keypad, min/max bounds", "Range, integer/decimal", "Full"],
      ["Single Select", "Bottom sheet picker with search", "Required, default", "Full"],
      ["Multi Select", "Chip-based selector with count", "Min/max selections", "Full"],
      ["Photo", "In-app camera with compression", "Max file size, geotag", "Full (store locally)"],
      ["Location (GPS)", "Map pin drop + accuracy circle", "Accuracy threshold", "Full"],
      ["Barcode/QR", "In-app scanner with auto-focus", "Format validation", "Full"],
      ["Signature", "Finger-draw canvas", "Required stroke count", "Full"],
      ["Cascading Select", "Linked dropdowns (LGA > Ward > PU)", "Dependency chain", "Full"],
    ]
  ),
  tableCaption("Table 10: Dynamic Form Field Types"),
  h3("5.3.5 GPS and Location Services"),
  body("Location services are critical for field verification and incident reporting. The app requests location permission on first use with a clear explanation of why it is needed. GPS accuracy requirements vary by function: check-in requires 50-metre accuracy, incident reports require 100-metre accuracy, and route optimisation uses 200-metre accuracy to balance precision with battery consumption. When GPS signal is unavailable, the app falls back to network-based location estimation and displays the accuracy level to the user."),
  body("Battery optimisation is a primary design concern. The app uses a combination of strategies: significant location changes (triggers only when the device moves more than 500 metres) rather than continuous tracking, adaptive GPS polling intervals that increase when the device is stationary, background sync throttling on low battery (below 20%), and automatic pause of non-essential services during active phone calls. A battery usage screen in the Profile tab shows current drain rate and tips for extending battery life during long field days."),
  h3("5.3.6 Onboarding Flow"),
  body("First-launch experience: Step 1 - Welcome screen with APC logo and app introduction. Step 2 - Credential entry (phone + OTP) and terms acceptance. Step 3 - Initial data download with progress bar showing data categories and estimated time remaining. Step 4 - Guided tour of the home screen using translucent tooltip overlays highlighting each UI element with swipe-through navigation. Users can skip and access the tour later from Profile. After onboarding, a 'Getting Started' checklist on the Home screen guides first key actions: complete profile, log first visit, send first message, submit first report."),

  // ── 5.4 ELECTION MONITORING ──
  h2("5.4 Election Monitoring and Incident Response"),
  h3("5.4.1 Incident Classification"),
  makeTable(
    ["Category", "Description", "Severity", "Auto-Escalation"],
    [
      ["Voter Intimidation", "Threats or coercion near polling units", "3-5", "Level 3+ to LGA coordinator"],
      ["Ballot Tampering", "Interference with ballot boxes/materials", "5", "Immediate to HQ + legal"],
      ["Disenfranchisement", "Voters turned away without cause", "3-4", "3+ from same PU escalates"],
      ["Vote Buying", "Money/goods offered for votes", "3-5", "3+ from same LGA triggers alert"],
      ["Violence", "Altercations, weapons, mob activity", "4-5", "Level 4+ to security team"],
      ["INEC Misconduct", "Bias or negligence by officials", "2-4", "Escalate to HQ for INEC liaison"],
      ["Counting Irregularities", "Procedure deviation, result manipulation", "4-5", "Immediate with photo evidence"],
      ["Logistics Issues", "Late materials, insufficient ballots", "2-3", "Escalate to logistics unit"],
    ]
  ),
  tableCaption("Table 11: Incident Classification Framework"),
  h3("5.4.2 Escalation Workflow"),
  body("The incident escalation system follows a structured four-level workflow designed to ensure that every incident receives an appropriate response within defined timeframes. Level 1 (Ward) is handled by the on-site observer or ward coordinator who reports the incident and provides initial assessment. Level 2 (LGA) escalation is triggered when the ward coordinator cannot resolve the issue or when severity exceeds predefined thresholds. Level 3 (State HQ) escalation activates the situation room team, legal support, and potentially law enforcement liaisons for severity 4-5 incidents. Level 4 (National) escalation is reserved for incidents with state-wide implications."),
  makeTable(
    ["Level", "Responder", "Trigger", "Max Response Time", "Actions"],
    [
      ["1", "Ward Observer", "Any incident", "Immediate", "Report, assess, document"],
      ["2", "LGA Coordinator", "Severity 3+ or unresolved", "15 minutes", "Mobilise resources, contact INEC LGA"],
      ["3", "State Situation Room", "Severity 4-5 or pattern", "30 minutes", "Legal, security, media response"],
      ["4", "National HQ", "Systematic or critical", "1 hour", "National coordination, public response"],
    ]
  ),
  tableCaption("Table 12: Escalation Response Matrix"),
  h3("5.4.3 Observer Management and Situation Room"),
  body("Observers complete mandatory training via the LMS module, passing a certification quiz before receiving polling unit assignments. On election day, observers check in via GPS-verified proximity (within 100-metre radius of assigned PU), confirming their physical presence before the monitoring system activates their incident reporting capabilities. The situation room displays a real-time state map with colour-coded PU indicators: green (normal operations), yellow (minor issues reported), orange (active investigation or escalation underway), red (critical intervention required), and grey (observer not yet checked in)."),
  body("The situation room interface is designed for wall-mounted displays and supports multiple simultaneous views. The primary view shows the full state map with aggregate statistics in a side panel: total PUs, observer check-in rate, active incidents by severity, and escalation status distribution. A secondary view cycles through individual incident cards showing photo evidence, description, assigned responder, and time-since-report. The situation room audio system provides spoken alerts for new critical incidents."),
  h3("5.4.4 Automated Pattern Detection"),
  body("Beyond individual incident response, the monitoring module includes an automated pattern detection engine that analyses incoming incident reports in real time to identify systemic issues. The engine uses spatial clustering algorithms (DBSCAN) to detect geographic concentrations of incidents that may indicate coordinated manipulation, temporal analysis to identify spikes in incident rates that deviate from baseline patterns, and categorical correlation to find relationships between incident types that suggest organised electoral fraud. When a pattern is detected, the system automatically generates a Situation Brief delivered to the Campaign Director and relevant Deputy Directors, including a summary narrative, affected areas, incident count, severity distribution, and recommended response actions."),

  // ── 5.5 COMMUNICATION HUB ──
  h2("5.5 Communication and Messaging Hub"),
  h3("5.5.1 Feature Inventory"),
  makeTable(
    ["Feature", "Description", "UI Element", "Automation"],
    [
      ["Broadcast Messaging", "Send to segments with personalised merge fields", "Segment selector + composer", "Auto-personalisation from VID"],
      ["Template Library", "Pre-approved templates with variable placeholders", "Template gallery with preview", "Merge field auto-population"],
      ["Scheduled Delivery", "Queue for optimal-time delivery", "Date/time picker + scheduler", "Auto-optimal time suggestion"],
      ["Two-Way SMS", "Receive/reply to voters; classify responses", "Inbox + reply composer", "NLP sentiment classification"],
      ["WhatsApp Groups", "Hierarchical groups mirroring org structure", "Group tree + broadcast composer", "Auto-group from org chart"],
      ["Push Notifications", "Targeted by role, location, segment", "Audience builder + editor", "Trigger-based auto-rules"],
      ["Message Analytics", "Delivery/open/response rates per campaign", "Multi-channel analytics view", "Auto-generated reports"],
      ["Compliance Filter", "Screen content for INEC violations", "Inline warning in composer", "Real-time content scanning"],
      ["Emergency Alert", "Override for critical immediate delivery", "Red alert button (top-right)", "Immediate + read confirmation"],
    ]
  ),
  tableCaption("Table 13: Communication Hub Features"),
  h3("5.5.2 Template Engine and Personalisation"),
  body("The template engine supports rich message templates with variable placeholders that are dynamically populated from voter records. Available merge fields include: first name, last name, polling unit name, ward, LGA, assigned coordinator name, nearest collation centre, PVC collection point, and custom fields from the engagement history. Templates support conditional blocks, allowing message content to vary based on voter attributes. For example, a single template can render different content for voters who have collected their PVC versus those who have not, using conditional syntax."),
  makeTable(
    ["Merge Field", "Source", "Example Output", "Format"],
    [
      ["{{first_name}}", "VID Demographics", "Aisha", "Plain text"],
      ["{{polling_unit}}", "VID Geographic", "PU 012/034/005", "Plain text"],
      ["{{ward}}", "VID Geographic", "Ward 03 - Badawa", "Plain text"],
      ["{{pvc_status}}", "VID Electoral", "Collected / Not Collected", "Conditional"],
      ["{{coordinator_name}}", "Org Structure", "Malam Ibrahim", "Plain text"],
      ["{{collection_centre}}", "Logistics Module", "Central Primary School", "Plain text"],
      ["{{sentiment}}", "VID Predictive", "Positive / Neutral / Negative", "Conditional"],
      ["{{last_contact_date}}", "VID Engagement", "12 August 2026", "Date formatted"],
    ]
  ),
  tableCaption("Table 14: Message Template Merge Fields"),
  h3("5.5.3 Delivery Optimisation and Channel Strategy"),
  body("The Communication Hub implements intelligent delivery optimisation to maximise message reach while minimising cost and recipient fatigue. An AI-driven send-time optimiser analyses historical engagement data to determine the optimal delivery window for each recipient, scheduling messages during periods of highest likely engagement. For SMS, the system implements message concatenation for messages exceeding 160 characters and supports Unicode encoding for messages in Hausa, Yoruba, or Igbo languages."),
  body("Channel selection is automatic based on recipient preferences and message type. Transactional messages (task assignments, reminders) default to SMS for maximum reach. Rich content (event invitations with images, campaign materials) routes through WhatsApp. Internal communications between staff use the in-app messaging system. The hub maintains a channel preference registry where voters can specify their preferred contact method, and the system respects these preferences across all outbound communications."),
  h3("5.5.4 Response Management and Analytics"),
  body("Incoming responses across all channels are aggregated into a unified inbox where communication officers can view, classify, and respond. The system auto-classifies responses using NLP sentiment analysis (positive, neutral, negative, question, complaint, unsubscribe) with a confidence threshold. Responses below the confidence threshold are flagged for manual review. Every response is linked to the voter's profile, creating a complete communication history accessible to field agents during door-to-door engagements."),
  body("Analytics dashboards track per-campaign and aggregate metrics: delivery rate (messages successfully sent versus total), read rate (messages opened, where supported by the channel), response rate, conversion rate (recipients who took the desired action), and opt-out rate. Funnel visualisations show the progression from sent to delivered to read to responded to converted, with drop-off analysis highlighting where campaigns lose audience attention. A/B testing support allows sending variant messages to random subsets and comparing performance before full deployment."),

  // ── 5.6 VOLUNTEER MANAGEMENT ──
  h2("5.6 Volunteer Management System (VMS)"),
  h3("5.6.1 Feature Inventory"),
  makeTable(
    ["Feature", "Description", "UI Element", "Benefit"],
    [
      ["Smart Scheduling", "Assign based on skills, location, availability", "Calendar + drag-drop", "Optimal matching"],
      ["Shift Management", "Shift patterns for election day; check-in/out", "Timeline with capacity bars", "Full coverage"],
      ["Performance Scoring", "Track tasks, attendance, data quality, response time", "Dashboard with trend charts", "Reward top performers"],
      ["Gamification", "Badges, points, leaderboards for milestones", "Badge showcase + leaderboard", "Motivation and retention"],
      ["Proximity Alerts", "Auto-assign nearby volunteers to incidents by GPS", "Alert with accept/decline", "Rapid response"],
      ["Availability Calendar", "Volunteers set availability; prevent over-scheduling", "Self-service calendar in app", "Sustainable engagement"],
    ]
  ),
  tableCaption("Table 15: Volunteer Management Features"),
  h3("5.6.2 Recruitment Pipeline and Onboarding"),
  body("The VMS manages the complete volunteer lifecycle from initial interest to post-election recognition. The recruitment pipeline supports multiple entry points: a public web form linked from party social media accounts, unique referral links that credit the referring volunteer, QR codes printed on campaign materials for scan-to-register at events, and direct coordinator entry for volunteers identified through community networks."),
  makeTable(
    ["Stage", "Description", "Automated Action", "Exit Criteria"],
    [
      ["Lead", "Initial registration received", "Welcome SMS + onboarding link", "Profile completed"],
      ["Screening", "Background check and verification", "Assignment to verifier", "Verification passed"],
      ["Training", "Assigned training modules", "Module reminders + progress tracking", "All modules completed"],
      ["Certification", "Quiz/assessment passed", "Certificate issued, badge awarded", "Score above 80%"],
      ["Active", "Available for assignment", "Task notifications enabled", "First shift completed"],
      ["Alumni", "Post-election recognition", "Thank-you message + future invite", "Campaign concluded"],
    ]
  ),
  tableCaption("Table 16: Volunteer Recruitment Pipeline"),
  h3("5.6.3 Performance Scoring Algorithm"),
  body("The VMS employs a multi-dimensional performance scoring algorithm that provides a holistic view of each volunteer's contribution. The score is composed of five weighted factors: Task Completion Rate (30%) measuring the percentage of assigned tasks completed on time, Data Quality Score (25%) evaluating the accuracy and completeness of submitted reports, Attendance Adherence (20%) tracking shift check-in and check-out punctuality, Response Time (15%) measuring how quickly the volunteer acknowledges and accepts task assignments, and Peer Rating (10%) aggregating ratings from coordinators and fellow volunteers. The composite score ranges from 0 to 100 and is displayed as a trend line on the volunteer's profile."),
  h3("5.6.4 Gamification and Recognition"),
  body("The gamification system is designed to drive sustained engagement through meaningful recognition rather than trivial rewards. Badges are awarded for specific achievements: 'First Contact' for completing the first voter visit, 'Century Club' for logging 100 interactions, 'Rapid Responder' for accepting tasks within five minutes, 'Data Champion' for maintaining a data quality score above 95 for four consecutive weeks, and 'Election Day Hero' for completing a full election day shift. A leaderboard shows top performers by LGA and statewide, with weekly and all-time views. Points earned through activities are redeemable for campaign merchandise, event access, and certificate of service letters."),

  // ── 5.7 FINANCIAL TRACKING ──
  h2("5.7 Financial Tracking and Resource Management"),
  h3("5.7.1 Expense Workflow"),
  makeTable(
    ["Stage", "Description", "UI Element", "Automation"],
    [
      ["Budget Creation", "Hierarchical budgets with owners and thresholds", "Tree-structured builder", "Auto-calculate totals"],
      ["Expense Submission", "Category, amount, receipt photo, project code", "Mobile form + camera", "Auto-categorisation"],
      ["Approval Routing", "Route to approver; multi-level for large amounts", "Approval queue + swipe", "Threshold-based routing"],
      ["Receipt Verification", "Verify receipts against amounts", "Side-by-side comparison", "OCR amount extraction"],
      ["Payment Processing", "Queue for payment; track status and method", "Payment queue with status", "Batch scheduling"],
      ["Budget Impact", "Approved expenses reflected immediately", "Live utilisation bars", "Real-time recalculation"],
      ["Audit Trail", "Every action logged with full traceability", "Immutable log viewer", "Automatic (no user action)"],
    ]
  ),
  tableCaption("Table 17: Expense Workflow"),
  h3("5.7.2 Budget Variance Analysis"),
  body("The financial module provides real-time budget variance analysis at every level of the budget hierarchy. Each budget line tracks planned amount, committed amount (approved but not yet paid), spent amount (paid), remaining balance, and variance percentage. Colour-coded indicators provide instant visual feedback: green (under 80% utilised), amber (80-95% utilised), red (over 95% or overspent). When a budget line approaches its threshold, the system proactively alerts the budget owner and the Campaign Director, enabling early corrective action."),
  body("Variance analysis dashboards display trends over time, comparing actual spend against planned trajectories. Forecasting algorithms project end-of-period spend based on current burn rates, flagging budget lines that are likely to be exceeded before the campaign concludes. The system supports budget reallocation requests where a coordinator can request transferring unspent funds from one line to another, subject to approval workflows that maintain appropriate segregation of duties."),
  h3("5.7.3 Procurement and Inventory Management"),
  body("Inventory management tracks all campaign materials from procurement to distribution with full chain-of-custody documentation. Materials are categorised into hierarchies (e.g., Campaign Materials > Print > Posters > A2 Size) with unit costs, minimum stock levels, and reorder points. Barcode and QR code scanning on the mobile app enables rapid stock verification at distribution points. The system generates automated purchase orders when stock falls below minimum thresholds, routes them through the approval workflow, and tracks delivery status from supplier to warehouse to field distribution point."),
  body("Distribution tracking records which materials were sent to which locations, in what quantities, and received by whom. Ward coordinators acknowledge receipt through the mobile app, creating a verified chain of custody. End-of-campaign reconciliation calculates actual cost per voter contacted, cost per volunteer mobilised, and cost per polling unit covered, providing granular cost-effectiveness metrics for future campaign planning."),

  // ── 5.8 SECURITY ──
  h2("5.8 Security, Compliance, and Data Governance"),
  h3("5.8.1 Role-Based Access Control"),
  makeTable(
    ["Role", "Voter Data", "Financial", "Incidents", "Admin"],
    [
      ["Campaign Director", "Full read", "Full read/write", "Full read/write", "Full"],
      ["DD (Data)", "Full read/write", "Read only", "Full read", "Module config"],
      ["DD (Field)", "Assigned LGA", "None", "Full read/write", "None"],
      ["DD (Comms)", "Segment (no PII)", "None", "Summary read", "Template mgmt"],
      ["Zonal Coordinator", "Assigned LGA read", "None", "Assigned LGA", "None"],
      ["Ward Coordinator", "Assigned ward read", "None", "Assigned ward", "None"],
      ["Observer", "None", "None", "Assigned PU create", "None"],
      ["IT Admin", "Infrastructure only", "Audit logs", "Audit logs", "Full"],
    ]
  ),
  tableCaption("Table 18: RBAC Matrix"),
  h3("5.8.2 Encryption and Key Management"),
  body("All personally identifiable information (PII) is encrypted at rest using AES-256-GCM and in transit using TLS 1.3. Encryption keys are managed through a dedicated Key Management Service (KMS) with automated 90-day rotation cycles and manual emergency rotation capability. Field-level encryption applies an additional layer of protection to the most sensitive data elements, such as voter phone numbers and residential addresses."),
  makeTable(
    ["Data Category", "At Rest", "In Transit", "Key Rotation", "Access"],
    [
      ["Voter PII (phone, address)", "AES-256 + field-level", "TLS 1.3", "90 days auto", "Application-layer only"],
      ["Voter demographics", "AES-256", "TLS 1.3", "90 days auto", "RBAC-controlled"],
      ["Financial records", "AES-256 + field-level", "TLS 1.3", "60 days auto", "DD Finance + Director"],
      ["Incident reports", "AES-256", "TLS 1.3", "90 days auto", "RBAC-controlled"],
      ["System audit logs", "AES-256 + HMAC", "TLS 1.3", "365 days auto", "IT Admin + Director"],
      ["Media files (photos)", "AES-256 at rest", "TLS 1.3", "90 days auto", "RBAC-controlled"],
    ]
  ),
  tableCaption("Table 19: Encryption Standards by Data Category"),
  h3("5.8.3 Audit Logging and Compliance Monitoring"),
  body("Every user action that reads, creates, modifies, or deletes data is recorded in an immutable audit log. Each audit entry captures: user ID, role, action type, resource affected, timestamp (UTC with millisecond precision), IP address, device fingerprint, and before/after values for modifications. The audit log is stored in a separate database with write-once, read-many (WORM) access controls, preventing even system administrators from tampering with or deleting audit records. Automated compliance monitoring scans audit logs for suspicious patterns such as bulk data exports outside working hours or repeated failed access attempts, triggering real-time alerts."),
  body("Weekly security reports summarise key metrics: total active users, failed login attempts, data access patterns by role, top data consumers, and any flagged anomalies. Quarterly penetration testing by an independent security firm provides external validation of the platform's defences. Mandatory security awareness training must be completed by all staff before receiving system access, with annual refresher courses and simulated phishing exercises to maintain vigilance."),
  h3("5.8.4 Application Security (OWASP Top 10)"),
  body("The platform is designed and tested against the OWASP Top 10 application security risks. Injection attacks are prevented through parameterised queries for all database interactions and input sanitisation on all user-facing fields. Broken authentication is mitigated through multi-factor authentication for administrative roles, session tokens with short expiry (15 minutes for web, 24 hours for mobile), and automatic session termination on role changes or password resets. Sensitive data exposure is prevented through field-level encryption, response filtering that strips PII from API responses based on the requester's role, and strict Content Security Policy headers that prevent client-side data leakage."),
  body("XML External Entity (XXE) attacks are prevented by disabling external entity processing on all XML parsers. Broken access control is addressed through server-side enforcement of RBAC rules on every API endpoint, with no reliance on client-side access control logic. Security misconfiguration is mitigated through automated infrastructure-as-code deployment with hardened baseline configurations, automated scanning for misconfigurations in the CI/CD pipeline, and removal of all default credentials, unnecessary services, and verbose error messages in production. Cross-Site Scripting (XSS) is prevented through output encoding, Content Security Policy headers, and React's built-in XSS protection."),
  h3("5.8.5 Mobile Application Security"),
  body("The mobile application implements additional security layers specific to the Android platform. App integrity verification uses Google Play Integrity API (or SafetyNet Attestation for devices without Google Play Services) to detect rooted devices, modified APKs, and unauthorised installations. The app prevents screen capture of sensitive screens (voter details, financial data) through FLAG_SECURE window flags. Biometric authentication (fingerprint) is required for accessing the app, with device PIN as fallback, ensuring that a lost or stolen device cannot be used to access campaign data even if unlocked."),
  body("All local data stored in the SQLite database is encrypted using SQLCipher with a key derived from the user's authentication credentials combined with a device-specific hardware-backed key from the Android Keystore. The app implements certificate pinning for all API communications, preventing man-in-the-middle attacks even on compromised networks. Debug builds are restricted to internal testing and are never distributed; production builds disable all logging, debugging hooks, and developer tools. The app detects and blocks running on emulators or virtual machines, preventing unauthorised analysis of the application's behaviour and data handling."),
  h3("5.8.6 Network and Infrastructure Security"),
  body("All network traffic is routed through a dedicated AWS VPC with private subnets for application servers and database instances. Public-facing load balancers terminate TLS connections and forward traffic to internal services over private IPs. Network ACLs and security groups implement a strict zero-trust model where each service can only communicate with the specific services it depends on, and all inter-service traffic is encrypted with mutual TLS (mTLS). A Web Application Firewall (WAF) sits in front of the API gateway, providing protection against common web attacks including SQL injection, cross-site scripting, and distributed denial-of-service (DDoS) attacks."),
  body("Distributed Denial of Service (DDoS) protection is provided at multiple levels: AWS Shield Standard for automatic network-layer protection, AWS Shield Advanced for advanced mitigation during the election period, and application-level rate limiting that detects and throttles anomalous request patterns. The platform implements geographic IP restrictions for the admin interface, allowing access only from Nigerian IP ranges and pre-approved VPN endpoints. DNS security is ensured through DNSSEC for all campaign domains, preventing DNS spoofing and cache poisoning attacks."),
  h3("5.8.7 Social Engineering and Insider Threat Protection"),
  body("Beyond technical controls, the security framework addresses human-layer vulnerabilities through a comprehensive counter-social-engineering programme. All staff undergo mandatory security awareness training covering phishing identification, social engineering tactics, tailgating prevention, and sensitive conversation protocols. Simulated phishing exercises are conducted monthly, with staff who repeatedly fail receiving targeted remedial training. A confidential reporting channel allows any team member to report suspicious behaviour without fear of retaliation."),
  body("Insider threat detection uses User and Entity Behaviour Analytics (UEBA) to establish baseline behaviour patterns for each user and flag anomalous activities such as accessing unusually large volumes of voter data, downloading data outside normal working hours, or attempting to access resources outside their assigned geographic area. The principle of least privilege is enforced rigorously: users receive the minimum permissions necessary for their role, with temporary elevation available through a request-and-approval workflow that logs the elevation period and automatically reverts permissions after the specified duration."),

  // ═══════════════════════════════════════════════════════════════
  // 6. UI/UX DESIGN FRAMEWORK (DEEPENED)
  // ═══════════════════════════════════════════════════════════════
  h1("6. UI/UX Design Framework"),
  h2("6.1 Design Philosophy and Principles"),
  body("The platform's user experience design follows four guiding tenets. Clarity Over Complexity mandates that every screen presents only the information necessary for the user's current task, removing all unnecessary visual elements. Progressive Disclosure reveals advanced features and detailed data only when explicitly requested, keeping the default interface clean and unintimidating for non-technical users. Error Prevention Over Error Correction designs forms and workflows to prevent mistakes through input validation, sensible defaults, and confirmation prompts for irreversible actions. Familiar Patterns ensures that common UI paradigms (bottom navigation bars, swipe-to-delete, pull-to-refresh) are used consistently so users transfer existing mobile literacy to the platform."),
  h2("6.2 Visual Design Language"),
  body("The visual design uses a clean, modern aesthetic with generous white space, crisp typography, and a restrained colour palette anchored by APC green (#007847). The interface uses a white or very light gray (#F9FAFB) background creating an airy, professional feel that reduces visual fatigue during extended use. APC green serves as the primary accent for buttons, links, active states, and positive indicators. A complementary teal (#0D9488) provides secondary interactive emphasis. Error states use warm red (#DC2626), warnings use amber (#D97706), and success uses APC green, creating an intuitive colour-language that communicates status without text labels."),
  body("Typography uses Inter for all interface elements, chosen for its on-screen readability, wide weight range (400-700), and comprehensive character set. Body text is set at 16px on web and 15sp on mobile with a 1.5 line-height. Headings use Inter Bold at 20-32px with a 1.3 line-height. A tabular-numeral variant ensures digit alignment in data tables. All spacing follows a consistent 8px grid system, creating visual rhythm and alignment consistency across all screens and components."),
  h2("6.3 User Personas and Journey Maps"),
  makeTable(
    ["Persona", "Profile", "Device", "Key Needs", "Cognitive Load"],
    [
      ["Campaign Director", "50+, limited tech, strategic focus", "Desktop", "High-level KPIs, alerts, drill-down", "Low"],
      ["Data Analyst", "Graduate, tech-savvy, detail-oriented", "Desktop", "Advanced filters, export, queries", "High"],
      ["Zonal Coordinator", "Moderate tech, manages 10-20 wards", "Mobile + tablet", "LGA overview, broadcasting, tasks", "Medium"],
      ["Ward Coordinator", "Variable tech, field-focused", "Mobile (Android)", "Simple tasks, voter search, logger", "Low"],
      ["Election Observer", "Variable tech, high-stress context", "Mobile (Android)", "One-tap check-in, forms, emergency", "Very Low"],
    ]
  ),
  tableCaption("Table 20: User Personas with Cognitive Load Profiles"),
  h3("6.3.1 Journey Map: Ward Coordinator Daily Workflow"),
  body("Morning: Opens app to Home screen showing personalised greeting, task count with animated progress ring, and quick-action bar. Taps first task card which slides in from the right showing voter profile with name, address, issue preferences, and previous interaction notes. Taps 'Start Navigation' opening the route optimiser with turn-by-turn walking directions. After the visit, taps 'Log Visit' opening a structured form with slider sentiment ratings (1-5 with emoji labels), dropdown issue selectors, and free-text notes with a 500-character counter. Taps 'Submit' seeing a green checkmark pulse animation, then auto-returns to task list."),
  body("Incident Encounter: Taps Report tab's floating action button (green circle with plus icon, 56dp), opening a full-screen category selection with eight icon tiles in a 2-column grid with colour-coded borders. Taps 'Voter Intimidation' which slides to a severity selector with five colour-coded buttons from green (1-minor) to red (5-critical). After selecting severity, completes description form with camera button opening device camera in-app. Attaches photo, types description, taps 'Submit' receiving confirmation with incident ID, severity badge, and estimated response time."),
  h3("6.3.2 Journey Map: Campaign Director Morning Briefing"),
  body("The Campaign Director arrives at the office, opens the web dashboard. The system detects the morning login pattern and automatically loads the 'Morning Briefing' dashboard template: a prominent KPI row showing yesterday's totals, the geospatial map centred on the state with LGA-level colour coding, and an activity timeline filtered to the last 24 hours. The director clicks an LGA showing red on the map, which smoothly zooms to ward-level view and cross-filters all other widgets. After reviewing, clicks 'Share View', types the Data Director's name, and the exact filtered view is sent as a link."),
  h2("6.4 Information Architecture and Navigation"),
  body("Web Dashboard: Left sidebar (260px, collapsible to 64px icon-only rail) with four collapsible groups: Command Centre (Dashboard, Map, Alerts), Operations (Voters, Field, Volunteers, Monitoring), Management (Comms, Finance, Inventory, Reports), Administration (Users, Roles, Settings, Audit). Active item highlighted with APC green background pill and subtle left border accent (4px). Global search bar with instant results dropdown. On tablet (768-1024px), the sidebar collapses to a 64px icon-only rail that expands on tap with smooth slide animation."),
  body("Mobile App: Bottom tab bar with five destinations (Home, Voters, Report, Messages, Profile). Active tab: filled APC green icon with white label. Inactive tabs: outlined grey icon with grey label. Contextual navigation uses a top app bar with back arrow, screen title, and action buttons (maximum three). No critical function requires more than three taps from any screen."),
  h2("6.5 Interaction Patterns and Micro-Interactions"),
  body("Success Feedback: A green checkmark icon scales from 0.8x to 1.2x to 1.0x over 400 milliseconds with a subtle green colour pulse behind it, before auto-navigating back after 800 milliseconds. Error States: Inline validation messages below form fields with red left border (3px) and specific guidance text. The field border turns red and subtly shakes horizontally for 300 milliseconds. Loading States: Skeleton screens mimicking expected content layout with left-to-right shimmer animation. Pull-to-Refresh: Circular spinner replacing list header, showing 'Last updated: just now' on completion."),
  body("Touch Feedback: Buttons scale to 0.97x on press-down and spring back to 1.0x on release. List items support swipe-right to reveal contextual action buttons (Edit in blue, Delete in red, Share in green). Critical alerts (Level 4-5) use a full-screen overlay with red-tinted background gradient, requiring explicit button tap to dismiss. Chart Interactions: Hover tooltips with exact values, click-to-filter cross-filters all dashboard widgets, pinch-to-zoom on map with smooth animation transitions."),
  h2("6.6 Component Library Specification"),
  body("The platform uses a shared design system implemented as a React component library ensuring visual and behavioural consistency across web and mobile. Components are versioned and documented with interactive Storybook stories. Below is the core component inventory."),
  makeTable(
    ["Component", "Variants", "States", "Accessibility"],
    [
      ["Button", "Primary, Secondary, Ghost, Danger, Icon-only", "Default, Hover, Active, Disabled, Loading", "aria-label, focus ring, keyboard"],
      ["Input Field", "Text, Number, Search, Textarea", "Default, Focus, Error, Disabled, Success", "Label, error msg, aria-described"],
      ["Card", "Standard, Interactive, Stat, Alert", "Default, Hover, Selected, Loading", "Semantic heading, role attributes"],
      ["Data Table", "Sortable, Filterable, Paginated", "Default, Empty, Loading, Error", "Sort indicators, row headers"],
      ["Modal / Dialog", "Info, Confirmation, Form, Full-screen", "Open, Closing, Closed", "Focus trap, Escape close"],
      ["Toast / Snackbar", "Success, Error, Warning, Info", "Enter, Visible, Exit", "role=alert, auto-dismiss"],
      ["Badge", "Count, Status, Role", "Default, Pulse (unread)", "aria-label for count"],
      ["Dropdown", "Select, Multi-select, Searchable", "Closed, Open, Disabled", "Keyboard nav, aria-expanded"],
      ["Tab Bar", "Web (horizontal), Mobile (bottom)", "Default, Active, Disabled", "aria-selected, keyboard"],
      ["Progress", "Linear bar, Circular ring, Steps", "Indeterminate, Determinate", "aria-valuenow, label"],
      ["Chips / Tags", "Filter, Status, Removable", "Default, Selected, Disabled", "Removable: button role"],
      ["Avatar", "Initials, Photo, Icon", "Default, Online, Offline", "alt text, status indicator"],
    ]
  ),
  tableCaption("Table 21: Core UI Component Inventory"),
  h2("6.7 Data Visualisation Standards"),
  body("All data visualisations follow a consistent visual grammar enabling users to interpret charts quickly and accurately. Chart colours use a sequential palette for ordered data (light to dark green) and a diverging palette for data with a meaningful centre point (red through white to green). The same data dimensions always use the same colours across all charts, creating a learnable colour-language."),
  makeTable(
    ["Chart Type", "Use Case", "Interactions", "Accessibility"],
    [
      ["Bar Chart (Vertical)", "Comparing categories (voters per LGA)", "Hover tooltips, click-to-filter", "Data table fallback"],
      ["Line Chart", "Trends over time (sentiment, turnout)", "Hover crosshair, range selector", "Data table fallback"],
      ["Pie / Donut", "Part-of-whole (severity distribution)", "Hover segment, click-to-filter", "Data table fallback"],
      ["Choropleth Map", "Geographic distribution (coverage by LGA)", "Hover LGA, click-to-drill, zoom", "Colour legend + labels"],
      ["Heatmap", "Intensity (activity by day/hour)", "Hover cell, click-to-filter", "Data table fallback"],
      ["Funnel Chart", "Conversion stages (sent > delivered > read)", "Hover stage, click for details", "Data table fallback"],
      ["Scatter Plot", "Correlation (turnout vs outreach)", "Hover point, lasso selection", "Data table fallback"],
      ["KPI Card", "Single metric with trend", "Click to drill-down", "Trend alt text"],
      ["Gauge / Radial", "Progress toward target (coverage %)", "Animated fill on load", "Percentage alt text"],
      ["Tree Map", "Hierarchical composition (budget)", "Hover block, click-to-drill", "Data table fallback"],
    ]
  ),
  tableCaption("Table 22: Data Visualisation Chart Type Guidelines"),
  body("All charts include a 'Download as PNG' and 'View Data' action. The 'View Data' action opens the underlying data table that powers the chart. Screen readers announce chart titles, type, and summary findings through ARIA descriptions. Animations are subtle (300ms ease-out for load, 200ms for state changes) and respect the user's reduced-motion preference setting."),
  h2("6.8 Mobile Gesture and Haptic Patterns"),
  body("The mobile app uses a consistent set of touch gestures leveraging users' existing mobile literacy while providing appropriate haptic feedback for key actions. Haptic feedback is calibrated to be informative without being distracting: a light tap (10ms) for button presses, a medium tap (20ms) for toggle activations, and a heavy tap (30ms) for error states. All haptic patterns can be disabled in accessibility settings."),
  makeTable(
    ["Gesture", "Context", "Action", "Haptic", "Visual Feedback"],
    [
      ["Tap", "Buttons, links, list items", "Activate primary action", "Light tap", "Scale 0.97x on press"],
      ["Long Press (500ms)", "List items, messages", "Enter multi-select mode", "Medium tap", "Selection checkboxes appear"],
      ["Swipe Right", "List items (conversations, tasks)", "Reveal action buttons", "None", "Slide panel with actions"],
      ["Swipe Left", "Notification cards, messages", "Dismiss", "None", "Card slides off-screen"],
      ["Pull Down", "Scrollable lists", "Refresh data", "None", "Spinner replaces header"],
      ["Pinch", "Maps, images", "Zoom in/out", "None", "Smooth scale animation"],
      ["Double Tap", "Maps, images", "Zoom to 2x / reset", "None", "Animated zoom"],
      ["Drag", "Dashboard widgets, shift calendar", "Reorder / reschedule", "Light continuous", "Elevated shadow while dragging"],
    ]
  ),
  tableCaption("Table 23: Mobile Gesture and Haptic Patterns"),
  h2("6.9 Responsive and Adaptive Design"),
  body("Web: Responsive grid adapting across desktop (1280px+ multi-column), laptop (1024px), and tablet (768px two-column). Below 768px, users are redirected to download the mobile app with a personalised link. The responsive layout uses CSS Grid with named areas that reorganise based on viewport width. The sidebar navigation collapses progressively: at 1280px it shows full labels, at 1024px it collapses to icons with tooltips, and at 768px it converts to a hamburger menu with a full-height slide-out drawer."),
  body("Mobile: Targets Android 8.0+ covering 95% of the Nigerian smartphone market. Designs accommodate 5.5-6.8 inch screens using flexible dp and sp units. Minimum 48x48dp touch targets with 8dp internal padding. The app supports light and dark mode, following the system-level setting by default with manual override in Profile settings. A high-contrast outdoor mode increases all text contrast ratios to minimum 7:1 and adds a semi-transparent dark overlay behind text for readability in direct sunlight."),
  h2("6.10 Accessibility, Error Handling, and Inclusive Design"),
  body("WCAG 2.1 Level AA compliance is mandatory. Text scales to 200% without layout breakage through relative units throughout. Visible focus indicators (2px APC green outline with 2px offset) clearly show keyboard navigation position. All form inputs have associated labels, and dynamic content updates are announced to screen readers through ARIA live regions. Colour is never used as the sole means of conveying information; every colour-coded status indicator is accompanied by a text label or icon."),
  body("Empty states are designed as productive moments. When a data table has no results, a friendly illustration with contextual messaging guides the user to productive action. Error states follow a three-part structure: clear explanation, visual indicator of where the problem is, and a specific retry mechanism. Interface text is written at an 8th-grade reading level. Three interface languages are supported: English (default), Nigerian Pidgin, and Hausa, selectable in Profile settings."),
  h2("6.11 Notification Design System"),
  body("Three-tier priority model. Tier 1 (Critical): Full-screen overlay on mobile with red-tinted gradient, modal popup on web with red header bar, requires explicit acknowledgment. Accompanied by a distinctive two-tone alert sound. Tier 2 (Important): Persistent banner notification on web (top of viewport, green accent) remaining until dismissed. On mobile, expandable card at top of current screen. Tier 3 (Informational): Notification centre accessible from bell icon with unread count badge, non-interrupting. Each notification includes summary, timestamp (relative format), source module icon, and one or two action buttons (View / Dismiss)."),
  body("Mobile push notifications are customised for lock screen (title and summary only) versus expanded shade (full content with actions). On web, a notification bell icon in the header displays real-time unread count badge updated via WebSocket. Users configure preferences per module and per channel in Profile settings, with 'Quiet Hours' configuration that suppresses non-critical notifications during configurable time windows."),
  h2("6.12 Onboarding Flows by Role"),
  body("Each user role receives a tailored onboarding experience introducing only features relevant to their responsibilities, avoiding cognitive overload. Onboarding is divided into three phases: Initial Setup (first login, account configuration, data download), Guided Tour (interactive walkthrough of key screens), and First Actions (guided completion of primary tasks with progress tracking)."),
  makeTable(
    ["Role", "Initial Setup", "Guided Tour Screens", "First Actions Checklist"],
    [
      ["Campaign Director", "Account + password, 2FA, notification preferences", "Dashboard (KPIs, map, alerts)", "Review dashboard, acknowledge alert, share view"],
      ["Data Analyst", "Account + 2FA, data access agreement", "VID (search, segments, import), Dashboard", "Run first search, create segment, export data"],
      ["Zonal Coordinator", "Phone + OTP, app download, data sync", "App (home, tasks, voters, report)", "Log visit, submit report, send message"],
      ["Ward Coordinator", "Phone + OTP, app download, data sync", "App (home, quick actions, check-in)", "Complete profile, log visit, check-in"],
      ["Election Observer", "Phone + OTP, app download, PU assignment", "App (check-in, report, emergency)", "Simulate check-in, submit test report"],
    ]
  ),
  tableCaption("Table 24: Role-Based Onboarding Flows"),
  h2("6.13 Performance Budgets and Optimisation"),
  body("The platform adheres to strict performance budgets ensuring usability across variable network conditions and device capabilities prevalent in Nigeria. These budgets are treated as hard constraints in the development process, with automated CI checks that block deployment if performance regressions are detected."),
  makeTable(
    ["Metric", "Web Target", "Mobile Target", "Measurement Method"],
    [
      ["First Contentful Paint", "Under 1.5 seconds", "Under 2.0 seconds", "Lighthouse CI"],
      ["Time to Interactive", "Under 3.0 seconds", "Under 3.5 seconds", "Lighthouse CI"],
      ["Search Response", "Under 500ms", "Under 500ms (local)", "APM instrumentation"],
      ["Dashboard Load", "Under 2.0 seconds", "N/A", "Synthetic monitoring"],
      ["Form Submit", "Under 1.0 second", "Under 200ms (local)", "Client-side timing"],
      ["App APK Size", "N/A", "Under 40MB", "Build pipeline"],
      ["Initial Data Sync", "N/A", "Under 10 minutes (50MB)", "App instrumentation"],
      ["Battery Drain (active)", "N/A", "Under 8% per hour", "Device profiling"],
      ["Offline Operations", "N/A", "100% core features", "Manual test matrix"],
    ]
  ),
  tableCaption("Table 25: Performance Budgets"),
  h2("6.14 Web Application Screen Specifications"),
  body("The web dashboard comprises fifteen primary screens organised into four navigation groups. Each screen specification below describes the layout structure, interactive elements, data density, and responsive behaviour. The Command Centre group includes the Main Dashboard (configurable widget grid with drag-and-drop, global filter bar at top, and collapsible sidebar), Geospatial Map View (full-width interactive map with layer toggles, LGA/ward/PU drill-down, and side panel for selected area details), and Alert Centre (three-column layout: priority filter rail, scrollable alert list, and detail pane with response actions)."),
  body("The Operations group includes Voter Search and Explore (split layout: 30% filter panel with collapsible sections, 70% results data table with sortable columns, inline preview, and pagination), Segment Builder (two-panel: rule builder with drag-and-drop condition groups on left, live count preview and distribution chart on right), Voter Profile (tabbed: Overview with summary cards, Interactions timeline, Predictive Scores with gauge visualisations, Map showing PU location and surrounding voters), Field Activity Feed (real-time chronological stream with infinite scroll, filterable by agent, LGA, and activity type, with inline detail expansion), and Incident Management (table view with inline severity badges, expandable rows showing photo evidence and escalation history, and bulk action toolbar)."),
  body("The Management group includes Communication Composer (three-panel: audience selector on left, message editor with template picker in centre, preview and scheduling on right), Financial Dashboard (hierarchical budget tree with expandable lines, variance indicators, and sparkline trends), Inventory Management (table with barcode scan button, stock level indicators, and automated reorder alerts), and Reports Centre (gallery of report templates with one-click generation, scheduling interface, and distribution history). The Administration group includes User Management (data table with role assignment dropdown, bulk invite, and activity log per user), Role Configuration (visual RBAC matrix editor with checkbox grid), System Settings (categorised settings pages: general, security, notifications, integrations), and Audit Log Viewer (filterable log table with timestamp, user, action, resource columns and detail drawer)."),
  h2("6.15 Mobile Application Detailed Screen Specifications"),
  body("Beyond the five-tab main navigation, the mobile app contains twenty-two distinct screens. The Home screen layout from top to bottom: greeting bar with notification bell icon (unread count badge), task progress ring (circular, 64dp, showing completed/total), horizontal scrolling quick-action bar (four rounded-rectangle buttons with icons: Log Visit, Report Incident, Check-In, Survey), 'Today's Tasks' section header with 'See All' link, vertically scrolling task cards (each showing voter name, address preview, task type icon, and due time). The task card supports swipe-right for 'Mark Complete' (green) and swipe-left for 'Reschedule' (amber)."),
  body("The Voter Profile screen uses a collapsible header card showing name, PVC status badge (green check or red cross), and last contact date. Below, a tab bar switches between Contact Info (phone with tap-to-call, address with tap-to-navigate), Interaction History (chronological list with filter chips for visit, call, message, event), Notes (markdown-enabled text area for coordinator notes with auto-save), and Map (embedded map showing voter PU with 500m radius circle indicating assignment area). The Incident Report screen uses a stepped form with progress indicator at top: Step 1 (Category Selection: 2-column icon grid with colour-coded borders), Step 2 (Severity: five large tappable buttons, colour-coded green to red, each with label and description), Step 3 (Details: multi-field form with description, camera button, and optional voice-to-text input), Step 4 (Review and Submit: summary card with edit buttons per section, prominent 'Submit' button at bottom)."),
  h2("6.16 Animation and Motion Design System"),
  body("Animations serve functional purposes: providing feedback, maintaining context during navigation, and directing attention. All animations follow a consistent easing curve (cubic-bezier(0.4, 0, 0.2, 1) for standard transitions, cubic-bezier(0.0, 0, 0.2, 1) for deceleration). Duration standards: 100ms for micro-interactions (button press, toggle), 200-300ms for standard transitions (screen enter/exit, panel slide), 400-500ms for complex sequences (page transitions with shared element transitions). All animations respect the user's 'Reduce Motion' system setting, replacing motion with instant state changes and opacity fades."),
  body("Screen transitions use a shared-element pattern: when tapping a voter name in a list, the name text morphs into the header of the voter profile screen while the list slides out to the left and the profile slides in from the right. Modal presentations use a bottom-sheet pattern on mobile (content slides up from bottom, backdrop dims with 200ms fade) and a centre-modal pattern on web (content scales from 0.95 to 1.0 with fade). List animations use staggered entry where items appear sequentially with a 30ms delay between each, creating a cascading waterfall effect that communicates hierarchical loading order."),
  h2("6.17 Error Handling and Recovery Patterns"),
  body("The platform implements a four-tier error handling strategy. Tier 1 (Validation Errors) are caught at the input level before submission: real-time field validation with debounced checking (300ms after last keystroke), inline error messages below the relevant field with red left border, and a summary banner at the top of long forms listing all errors with jump-to-field links. Tier 2 (Network Errors) occur during API calls: the system displays a non-blocking toast notification ('Unable to save. Retrying...') with an automatic retry mechanism that uses exponential backoff (1s, 2s, 4s, 8s, max 30s). If all retries fail, a persistent inline banner appears with a 'Try Again' button and an option to save locally for later sync."),
  body("Tier 3 (Server Errors) indicate backend failures: a full-screen error state with an illustration, friendly error message (e.g., 'Something went wrong on our end. Our team has been notified.'), and a 'Reload' button. The error details including request ID, timestamp, and user context are automatically reported to Sentry for developer investigation. Tier 4 (Offline Scenarios) are handled transparently: when the network is unavailable, a subtle yellow banner appears at the top of the screen stating 'You're offline. Changes will sync when connected.' All write operations succeed locally and queue for sync. Read operations return cached data with a timestamp indicator showing data freshness."),
  body("Data recovery mechanisms include: auto-save for all form inputs every 30 seconds to local storage, a 'Drafts' section in the user's profile listing all unsaved work across devices, and a conflict resolution interface for sync conflicts that presents both versions side-by-side with diff highlighting and merge options. In the event of a corrupted local database, the mobile app includes a 'Recovery Mode' accessible from the login screen that re-downloads the user's assigned data subset from the server, preserving only locally-created records that have not yet synced."),
  h2("6.18 Dark Mode Design Specifications"),
  body("The dark mode theme inverts the background and surface colours while maintaining the same semantic colour language. Background changes from white (#FFFFFF) to dark charcoal (#111827), surface cards from white/light gray to dark gray (#1F2937), and the sidebar from white to near-black (#0F172A). Text colours invert proportionally: primary text becomes off-white (#F9FAFB), secondary text becomes medium gray (#9CA3AF), and disabled text becomes dark gray (#4B5563). APC green (#007847) remains the primary accent but is lightened to #10B981 for better contrast against dark backgrounds."),
  body("All shadows are removed in dark mode, replaced by subtle borders (1px, #374151) to create visual separation between surfaces. Charts use a dark-mode palette: data series maintain their identity colours but at reduced saturation (80%) to prevent eye strain, grid lines use very dark gray (#1F2937) instead of light gray, and chart backgrounds are transparent. Images and photos receive a slight brightness reduction (95%) to prevent them from appearing overly bright against the dark interface. The transition between light and dark modes is animated with a 200ms cross-fade on all colour properties, creating a smooth visual transition that does not disrupt the user's workflow."),

  // ═══════════════════════════════════════════════════════════════
  // 7. QUALITY ASSURANCE AND END-TO-END TESTING
  // ═══════════════════════════════════════════════════════════════
  h1("7. Quality Assurance and End-to-End Testing"),
  h2("7.1 Testing Philosophy and Strategy"),
  body("Quality assurance for the campaign platform follows a risk-based testing strategy that concentrates testing effort on the highest-risk and most frequently used pathways. The testing pyramid comprises three layers: a broad base of unit tests covering individual functions and utility modules, a middle layer of integration tests verifying module interactions and API contracts, and a focused apex of end-to-end (E2E) tests that validate complete user workflows across both web and mobile applications. The target code coverage is 80% for unit tests and 60% for integration tests, with E2E tests covering 100% of critical user journeys identified in the user persona analysis."),
  body("Testing is integrated into the CI/CD pipeline, running automatically on every code commit. The pipeline executes unit tests first (targeting under 5 minutes), then integration tests (under 15 minutes), and finally a smoke-test suite of the most critical E2E scenarios (under 20 minutes). Full E2E test suites run nightly and on pre-release branches. Any test failure blocks the merge to the main branch and the deployment pipeline, ensuring that regressions are caught before they reach any environment."),
  h2("7.2 End-to-End Testing Framework"),
  body("E2E tests are implemented using Playwright for the web application and Detox for the mobile application, both chosen for their reliability, speed, and native support for the underlying technologies (React for web, React Native for mobile). Tests are written as declarative specifications that describe what the user does and expects to see, making them readable by non-technical stakeholders and suitable as living documentation of system behaviour."),
  makeTable(
    ["Test Category", "Count", "Execution", "Coverage"],
    [
      ["Critical Path E2E (web)", "25", "Every commit + nightly", "Login, dashboard, voter search, segment create, broadcast, report gen"],
      ["Critical Path E2E (mobile)", "30", "Every commit + nightly", "Login, task flow, visit log, incident report, sync, offline submit"],
      ["Cross-Module Integration", "40", "Nightly", "VID-to-Comms segment export, Field-to-Monitoring incident flow"],
      ["API Contract Tests", "120", "Every commit", "All endpoints: request/response schema validation"],
      ["Data Sync E2E", "15", "Nightly", "Offline create, reconnect, verify server state, conflict handling"],
      ["Security E2E", "20", "Weekly", "RBAC enforcement, session handling, encryption verification"],
      ["Performance E2E", "10", "Weekly", "Dashboard load, search latency, sync throughput, concurrent users"],
      ["Accessibility E2E", "15", "Nightly", "Screen reader flow, keyboard nav, colour contrast, focus order"],
    ]
  ),
  tableCaption("Table 26: E2E Test Suite Inventory"),
  h2("7.3 E2E Test Scenarios: Web Application"),
  h3("7.3.1 Campaign Director Workflow"),
  body("Test Scenario CD-001 (Morning Briefing): Navigate to login page, enter credentials, verify MFA challenge, land on dashboard. Verify KPI cards display data matching API response. Click LGA on map, verify cross-filter applies to all widgets. Click 'Share View', enter recipient, verify shared link generates. Acknowledge a critical alert, verify alert moves to 'Acknowledged' section. Export dashboard as PDF, verify file downloads. This test validates the director's primary workflow and confirms that real-time data, cross-widget filtering, and sharing all function correctly in an integrated manner."),
  body("Test Scenario CD-002 (Incident Oversight): Navigate to incident tracker widget, verify list loads with real-time indicator (green dot). Click a severity-4 incident, verify detail panel opens with photo, description, and escalation status. Click 'Escalate to Level 3', verify confirmation dialog, confirm, verify incident status updates to 'Escalated' and a notification is dispatched to the situation room. Verify the incident no longer appears in the ward coordinator's unresolved list."),
  h3("7.3.2 Data Analyst Workflow"),
  body("Test Scenario DA-001 (Segment Creation and Export): Navigate to VID > Segment Builder. Add condition: Age between 18 and 25. Add condition: LGA is selected from dropdown. Add condition: Engagement status is 'New'. Verify live count updates with each condition. Name segment 'First-Time Youth Voters - [LGA Name]'. Save segment. Click 'Export to Comms Hub', verify redirect to Communication Hub with segment pre-selected as audience. Verify segment appears in segment list with correct voter count and last-updated timestamp."),
  body("Test Scenario DA-002 (Data Import and Deduplication): Navigate to VID > Data Import. Upload CSV test file with 500 records including 20 known duplicates. Verify Step 2 (Field Mapping) auto-detects column mappings. Verify Step 3 (Validation) flags 15 records with format errors. Fix one mapping, verify count updates. Verify Step 4 (Deduplication) identifies 18 of 20 duplicates with confidence scores. Resolve duplicates interactively: merge 10, keep new 5, skip 3. Confirm import. Verify 482 unique records added to database. Verify import history log shows correct counts."),
  h2("7.4 E2E Test Scenarios: Mobile Application"),
  h3("7.4.1 Ward Coordinator Daily Workflow"),
  body("Test Scenario WC-001 (Complete Task Flow): Launch app, verify biometric prompt, authenticate. Verify Home screen loads with personalised greeting, task count (e.g., '8 of 15'), and quick-action bar. Tap first task card, verify voter profile slides in. Tap 'Start Navigation', verify route map opens with turn-by-turn. Return to task, tap 'Log Visit'. Verify form opens with voter name pre-filled. Select sentiment slider to 4 (positive), select issue 'Employment', type notes (150 characters). Tap 'Submit'. Verify success animation plays, task shows green checkmark, task count updates to '9 of 15'. Verify visit appears in voter's interaction history."),
  body("Test Scenario WC-002 (Offline Incident Report): Enable airplane mode. Navigate to Report tab, tap FAB. Select 'Voter Intimidation' category. Select severity 4. Type description (100 characters). Tap camera button, take photo. Tap 'Submit'. Verify submission queues locally with 'Pending Sync' indicator. Disable airplane mode (restore connectivity). Verify sync initiates automatically. Verify sync progress shows '1 item uploading'. Verify incident appears on web dashboard within 30 seconds. Verify local indicator changes to 'Synced' with green checkmark."),
  h3("7.4.2 Sync Conflict Resolution"),
  body("Test Scenario SC-001 (Concurrent Edit Conflict): Device A and Device B both sync the same voter record. Device A modifies voter notes to 'Met at home, very supportive'. Device B modifies same voter's notes to 'Not at home, left message with neighbour'. Both devices sync. Verify conflict resolution interface appears on both devices showing both versions side-by-side with diff highlighting (old text in red strikethrough, new text in green). User on Device A selects 'Keep Mine'. User on Device B selects 'Merge' and selects Device A's notes but keeps Device B's sentiment change. Verify merged result on server contains Device A's notes and Device B's sentiment. Verify audit log records both original changes and the merge resolution."),
  h2("7.5 Security Testing"),
  body("Security E2E tests verify that security controls function correctly in realistic usage scenarios rather than in isolation. Test Scenario SEC-001 (RBAC Enforcement): Log in as Zonal Coordinator. Attempt to access /api/v1/voters (all LGAs). Verify 403 Forbidden response. Attempt to access financial endpoints. Verify 403 Forbidden. Access voters in assigned LGA. Verify 200 OK with only assigned LGA data. Attempt to modify role in profile settings. Verify action is not available in UI. This test confirms that server-side RBAC cannot be bypassed through direct API calls even if the UI hides the functionality."),
  body("Test Scenario SEC-002 (Session Security): Log in on Device A. Log in on Device B with same credentials. Verify Device A session is terminated with a 'Session ended on another device' message. Verify all subsequent API calls from Device A return 401 Unauthorized. Test Scenario SEC-003 (Data Encryption Verification): Intercept API response for voter search (using test proxy). Verify PII fields (phone, address) are encrypted and not readable in the raw response body. Verify that a user with 'Segment (no PII)' role receives only aggregated counts, never individual voter records."),
  h2("7.6 Performance and Load Testing"),
  body("Performance E2E tests validate that the platform meets its performance budgets under realistic conditions. The load testing strategy simulates three scenarios: Normal Operations (500 concurrent web users, 200 active mobile users), Peak Election Day (2,000 concurrent web users, 1,500 active mobile users with high incident report volume), and Stress Test (5,000 concurrent users to identify breaking points). Key metrics monitored include: page load times, API response time at 50th/95th/99th percentiles, WebSocket message delivery latency, database query execution times, and error rates."),
  body("Mobile performance testing uses real-device testing on a representative device farm of five Android devices covering low-end (3GB RAM, Snapdragon 425), mid-range (4GB RAM, Snapdragon 660), and high-end (8GB RAM, Snapdragon 888) specifications. Tests verify: app cold start time under 3 seconds, initial data sync completion within 10 minutes on 4G, form submission latency under 200ms when offline, battery drain under 8% per hour during active field use, and smooth 60fps scrolling on data tables with 1,000+ rows. Devices are connected to a network conditioner that simulates 2G, 3G, 4G, and intermittent connectivity patterns to verify graceful degradation."),
  h2("7.7 User Acceptance Testing (UAT)"),
  body("User Acceptance Testing is conducted in three phases with real users from each persona group. Phase 1 (Alpha) involves internal team members acting as proxy users, testing core workflows and identifying obvious usability issues. Phase 2 (Beta) involves 20 actual ward coordinators and 5 data analysts from a single pilot LGA, using the platform for real campaign activities over a two-week period. Phase 3 (Pre-Launch) expands to all zonal coordinators for a final validation week before state-wide deployment."),
  makeTable(
    ["UAT Phase", "Participants", "Duration", "Success Criteria"],
    [
      ["Alpha", "Internal team (10)", "Week 9", "Zero critical bugs, 90% task completion rate"],
      ["Beta", "25 real users (1 LGA)", "Weeks 9-10", "95% task completion, SUS score above 75"],
      ["Pre-Launch", "All zonal coordinators", "Week 11", "100% critical paths, zero P0/P1 bugs"],
      ["Election Day Sim", "Full team + 500 volunteers", "Week 12", "Full simulation, all systems under load"],
    ]
  ),
  tableCaption("Table 27: User Acceptance Testing Plan"),
  body("During each UAT phase, users complete structured task scenarios while thinking aloud, and their interactions are recorded (with consent) for later analysis. The System Usability Scale (SUS) questionnaire is administered at the end of each phase, with a target score of 75 or above (indicating good to excellent usability). Critical findings are triaged daily and resolved within 24 hours for P0 issues and 72 hours for P1 issues. A feedback button in both the web and mobile applications allows users to submit issues and suggestions at any time during the testing period."),

  // ═══════════════════════════════════════════════════════════════
  // 8. PHYSICAL OFFICE INFRASTRUCTURE
  // ═══════════════════════════════════════════════════════════════
  h1("8. Physical Office Infrastructure"),
  h2("8.1 Office Layout and Space Requirements"),
  makeTable(
    ["Area", "Space (sqm)", "Purpose", "Key Equipment"],
    [
      ["Situation Room", "40", "Real-time monitoring, strategic planning", "4x 55-inch displays, video conferencing"],
      ["Open-Plan Workstations", "80", "Data analysts, comms officers, field ops", "20 workstations, dual monitors"],
      ["Server Room", "15", "Computing, backup, network infrastructure", "Rack servers, UPS, cooling"],
      ["Training Room", "35", "Coordinator onboarding, workshops", "Projector, 30 seats, whiteboard"],
      ["Director's Office", "20", "Campaign Director and Deputy Directors", "4 offices, meeting table"],
      ["Reception", "25", "Visitor management, security screening", "Reception desk, display screens"],
      ["Break Room", "20", "Staff rest, informal meetings", "Kitchenette, seating"],
      ["Secure Storage", "15", "Documents, equipment, material staging", "Lockable shelving"],
      ["Common Areas", "100", "Circulation, branding, emergency exits", "Party branding, signage"],
    ]
  ),
  tableCaption("Table 28: Office Space Allocation"),
  body("Power: Three-tier system with 20KVA diesel generator for primary backup, 10KVA solar inverter with battery bank for sustained daytime operation, and 3KVA online UPS for server room and critical workstations. Connectivity: Primary fibre (100Mbps), 4G/5G failover router, VSAT satellite reserved for election day. All connections through enterprise firewall with VPN."),
  h2("8.2 Situation Room Technology"),
  body("The situation room serves as the nerve centre during critical campaign periods and on election day. It features four 55-inch 4K displays in a 2x2 grid: primary display shows real-time geospatial incident map, secondary displays cycle through KPI dashboards and analytics, tertiary display maintains a persistent alert feed, and fourth display is reserved for video conferencing. An integrated audio system provides spoken alerts for critical incidents and hands-free communication with field teams. Dedicated workstations for the Campaign Director, DD Field Operations, legal liaison, and communications lead each have pre-configured dashboard views."),

  h1("9. Organisational Structure and Staffing"),
  makeTable(
    ["Role", "Reports To", "Responsibilities", "Direct Reports"],
    [
      ["Campaign Director", "State Chairman", "Strategy, resources, stakeholder management", "5 DDs"],
      ["DD (Data)", "Director", "Voter DB, analytics, intelligence reporting", "4 Analysts"],
      ["DD (Field)", "Director", "Coordinators, volunteers, grassroots ops", "5 Field Staff"],
      ["DD (Comms)", "Director", "Media, messaging, social media, internal", "3 Comms Officers"],
      ["DD (Logistics)", "Director", "Procurement, distribution, office mgmt", "4 Logistics Staff"],
      ["DD (Finance)", "Director", "Budget, expenses, reporting, audit", "2 Finance Officers"],
      ["Zonal Coordinator", "DD (Field)", "LGA coordination, report compilation", "Ward Coordinators"],
      ["Ward Coordinator", "Zonal Coord.", "PU operations, volunteer supervision", "Field Volunteers"],
    ]
  ),
  tableCaption("Table 29: Organisational Structure"),
  h2("9.2 RACI Matrix"),
  makeTable(
    ["Process", "Director", "DD Data", "DD Field", "DD Comms", "DD Finance"],
    [
      ["Voter data strategy", "A", "R", "C", "I", "I"],
      ["Field operations", "A", "C", "R", "I", "I"],
      ["Campaign messaging", "A", "C", "C", "R", "I"],
      ["Budget approval", "A", "I", "I", "I", "R"],
      ["Incident response", "A", "I", "R", "C", "I"],
      ["Election day ops", "A", "C", "R", "C", "I"],
      ["Media relations", "A", "I", "C", "R", "I"],
      ["Donor reporting", "A", "I", "I", "I", "R"],
    ]
  ),
  tableCaption("Table 30: RACI Matrix"),

  h1("10. Implementation Roadmap"),
  makeTable(
    ["Phase", "Timeline", "Modules", "Key Milestones"],
    [
      ["Foundation", "Wk 1-3", "VID, Dashboard, Security", "Office operational, 50% data loaded"],
      ["Activation", "Wk 4-7", "Field App, Comms, VMS, Finance", "Staff trained, app deployed"],
      ["Scale-Up", "Wk 8-10", "Monitoring, full Analytics", "Ward coverage, 5,000 volunteers"],
      ["Excellence", "Wk 11-12", "All modules stress-tested", "Simulations complete, fully ready"],
    ]
  ),
  tableCaption("Table 31: Implementation Roadmap"),
  body("Phase 1 (Foundation, Weeks 1-3): Office setup with all infrastructure operational, core platform modules (VID, Dashboard, Security) deployed, voter data consolidation initiated with a target of 50% of the state register digitised. Phase 2 (Activation, Weeks 4-7): Full staff recruitment and intensive hands-on training, mobile application deployment to all ward coordinators, Communication Hub and VMS configuration with template libraries and volunteer recruitment campaigns launched. Phase 3 (Scale-Up, Weeks 8-10): Ward coordinator recruitment and training completion, volunteer mobilisation drive targeting 5,000 active volunteers, election monitoring system configuration and observer training, targeted messaging campaigns based on VID segmentation. Phase 4 (Operational Excellence, Weeks 11-12): Full-scale simulation exercises mimicking election day conditions, stress testing all systems under peak load, contingency plan finalisation."),

  h1("11. Resource Requirements and Budget"),
  makeTable(
    ["Category", "Headcount", "Duration", "Cost (N)"],
    [
      ["Campaign Director", "1", "6 months", "[Please fill in]"],
      ["Deputy Directors (5)", "5", "6 months", "[Please fill in]"],
      ["Data Analysts", "4", "6 months", "[Please fill in]"],
      ["Communication Officers", "3", "6 months", "[Please fill in]"],
      ["Field Operations Staff", "5", "6 months", "[Please fill in]"],
      ["Logistics / Admin", "4", "6 months", "[Please fill in]"],
      ["Finance Officers", "2", "6 months", "[Please fill in]"],
      ["IT Support", "2", "6 months", "[Please fill in]"],
      ["Zonal Coordinators", "[Fill]", "4 months", "[Please fill in]"],
      ["Ward Coordinators", "[Fill]", "3 months", "[Please fill in]"],
      ["Election Observers", "[Fill]", "1 week", "[Please fill in]"],
    ]
  ),
  tableCaption("Table 32: Personnel Costs"),
  makeTable(
    ["Item", "Description", "Cost (N)"],
    [
      ["Platform Development", "8 modules: VID, Dashboard, App, Monitoring, Comms, VMS, Finance, Security", "[Please fill in]"],
      ["Cloud Hosting (6mo)", "Servers, databases, Elasticsearch, Redis, CDN, SSL", "[Please fill in]"],
      ["Office Equipment", "24 workstations, 4 displays, printers, networking", "[Please fill in]"],
      ["Power Infrastructure", "20KVA generator, 10KVA solar, 3KVA UPS", "[Please fill in]"],
      ["Mobile Devices", "200 smartphones, 20 tablets, accessories", "[Please fill in]"],
      ["Connectivity", "Fibre, 4G/5G failover, VSAT satellite", "[Please fill in]"],
      ["Office Setup", "Furniture, fixtures, security, branding, AC", "[Please fill in]"],
      ["Software Licenses", "Productivity, CRM, analytics tools", "[Please fill in]"],
      ["Security Infra", "Firewall, VPN, KMS, pen testing", "[Please fill in]"],
    ]
  ),
  tableCaption("Table 33: Technology Budget"),
  makeTable(
    ["Category", "Description", "Cost (N)"],
    [
      ["Transportation", "Fuel, vehicle hire, maintenance", "[Please fill in]"],
      ["Training and Events", "Venue, catering, materials, meetings", "[Please fill in]"],
      ["Campaign Materials", "Posters, flyers, banners, merchandise", "[Please fill in]"],
      ["Utilities", "Power, internet, water, supplies", "[Please fill in]"],
      ["Security", "Personnel, CCTV, access control", "[Please fill in]"],
      ["Contingency (15%)", "Unforeseen expenses and opportunities", "[Please fill in]"],
    ]
  ),
  tableCaption("Table 34: Operational Budget"),

  h1("12. Risk Analysis and Mitigation"),
  makeTable(
    ["Risk", "Likelihood", "Impact", "Mitigation"],
    [
      ["Data Breach", "Medium", "Critical", "AES-256 encryption, RBAC, audits, NDAs"],
      ["Platform Failure", "Low", "High", "Redundant cloud, offline app, backups"],
      ["Staff Attrition", "Medium", "Medium", "Competitive pay, career paths, documentation"],
      ["Regulatory Issues", "Low", "High", "Legal review, INEC compliance, records"],
      ["Funding Gaps", "Medium", "High", "Phased implementation, donor engagement"],
      ["Opposition Disruption", "Medium", "Medium", "Physical security, legal support"],
      ["Connectivity Outages", "High", "Medium", "Generator + solar + UPS, offline-first, 4G/VSAT"],
      ["Low Adoption", "Medium", "High", "Intensive training, intuitive UI, champions"],
      ["Data Quality Issues", "High", "Medium", "Auto-validation, dedup, quality dashboards"],
      ["Volunteer Shortfall", "Medium", "Medium", "Early drive, gamification, partnerships"],
    ]
  ),
  tableCaption("Table 35: Risk Assessment Matrix"),

  h1("13. Expected Benefits and Evaluation"),
  makeTable(
    ["Benefit", "Current State", "Projected", "Measurement"],
    [
      ["Voter Data", "30-40% digitised", "90% in 8 weeks", "DB vs INEC register"],
      ["Field Reports", "24-48 hours", "Under 15 minutes", "Platform timestamps"],
      ["Outreach Coverage", "25% of voters", "70% of voters", "Canvassing logs"],
      ["Volunteers", "Ad-hoc", "5,000+, 80% retention", "VMS metrics"],
      ["Incident Response", "Hours to days", "Under 30 minutes", "Incident timestamps"],
      ["Material Waste", "30-40% wastage", "Under 15%", "Inventory audits"],
      ["Financial Tracking", "Manual ledgers", "100% digital", "Finance audit reports"],
      ["Comms Reach", "Unmeasured", "Trackable delivery", "Hub analytics"],
    ]
  ),
  tableCaption("Table 36: Projected Improvements"),
  makeTable(
    ["Activity", "Frequency", "Participants", "Outputs"],
    [
      ["Operational Review", "Weekly", "DDs", "Action items, risk updates"],
      ["Strategic Review", "Bi-weekly", "Director + DDs", "Strategy adjustments"],
      ["Performance Report", "Monthly", "Director to Chairman", "KPI dashboard, variance"],
      ["Data Quality Audit", "Monthly", "DD Data + IT", "Completeness, dedup reports"],
      ["User Satisfaction", "Monthly", "All users", "Usability scores, requests"],
      ["Security Audit", "Quarterly", "IT + external auditor", "Pen test results"],
      ["Post-Election Review", "Once", "Full team + leadership", "Lessons learned, archive"],
    ]
  ),
  tableCaption("Table 37: Evaluation Framework"),
  body("The evaluation framework incorporates a lessons-learned process capturing operational insights throughout the campaign for future planning. This institutional knowledge management approach ensures the party builds cumulative expertise, avoiding the common pattern where valuable field experience is lost when temporary campaign structures are dismantled after each election cycle. All platform data, operational logs, and evaluation reports are archived in a structured knowledge base that serves as the foundation for the next campaign cycle, providing a measurable competitive advantage that compounds over time."),
];

// ═══════════════════════════════════════════════════════════════
// ASSEMBLE DOCUMENT
// ═══════════════════════════════════════════════════════════════

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" }, size: 24, color: c(palette.body) },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 32, bold: true, color: c(palette.primary) },
        paragraph: { spacing: { line: 312 } },
      },
      heading2: {
        run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 28, bold: true, color: c(palette.primary) },
        paragraph: { spacing: { line: 312 } },
      },
      heading3: {
        run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 26, bold: true, color: c(palette.primary) },
        paragraph: { spacing: { line: 312 } },
      },
    },
  },
  sections: [
    { properties: { page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR1({
        title: "APC State Campaign Office Solution",
        subtitle: "A Comprehensive Proposal for Modern Campaign Infrastructure",
        englishLabel: "STRATEGIC PROPOSAL",
        metaLines: ["All Progressives Congress (APC)", "State Campaign Directorate", "Prepared: August 2026", "Classification: Party Confidential"],
        footerLeft: "APC State Campaign Directorate", footerRight: "August 2026", palette: palette.cover,
      }),
    },
    { properties: { type: SectionType.NEXT_PAGE, page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: "upperRoman" } } },
      footers: { default: romanFooter() },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 480, after: 360 }, children: [new TextRun({ text: "Table of Contents", bold: true, size: 32, font: { ascii: "Times New Roman" }, color: c(palette.primary) })] }),
        new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
        new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: "Note: Right-click the TOC and select \"Update Field\" to refresh page numbers after editing.", italics: true, size: 18, color: "888888", font: { ascii: "Calibri" } })] }),
        new Paragraph({ children: [new PageBreak()] }),
      ],
    },
    { properties: { type: SectionType.NEXT_PAGE, page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: "decimal" } } },
      headers: { default: bodyHeader() }, footers: { default: arabicFooter() }, children: bodyContent,
    },
  ],
});

const OUTPUT = "/home/z/my-project/download/APC-State-Campaign-Office-Proposal.docx";
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUTPUT, buf);
  console.log("Document generated:", OUTPUT);
}).catch(err => { console.error("Error:", err); process.exit(1); });
