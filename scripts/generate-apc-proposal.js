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
  // 1. Top whitespace
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing }, children: [new TextRun({ text: "", size: 2 })] }));
  // 2. English label with accent bottom border
  if (config.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 500 },
      border: { bottom: accentBottom },
      children: [new TextRun({ text: config.englishLabel.split("").join("  "),
        size: 18, color: P.accent, font: { ascii: "Calibri" }, characterSpacing: 40, bold: true })],
    }));
  }
  // 3. Main title
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true,
        color: P.titleColor, font: { ascii: "Arial" } })],
    }));
  }
  // 4. Subtitle
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL }, spacing: { after: 800 },
      children: [new TextRun({ text: config.subtitle, size: 24, color: P.subtitleColor, italics: true,
        font: { ascii: "Calibri" } })],
    }));
  }
  // 5. Meta info lines with left accent border
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 22, color: P.metaColor, font: { ascii: "Calibri" } })],
    }));
  }
  // 6. Bottom whitespace
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing }, children: [new TextRun({ text: "", size: 2 })] }));
  // 7. Footer with top accent separator
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
  h1("1. Executive Summary"),
  body("This proposal presents a comprehensive, technology-enabled solution for establishing a fully operational APC State Campaign Office that serves as the central nervous system for all electoral activities within the state. The proposed framework addresses the critical need for a centralised command structure that integrates voter data management, real-time communication, field coordination, election monitoring, volunteer mobilisation, financial tracking, and security governance into a single, cohesive platform. In an era where political campaigns are increasingly won or lost on the strength of operational efficiency and data-driven decision-making, the APC must leverage modern campaign technology to maintain its competitive advantage across all senatorial districts and local government areas."),
  body("The solution centres on four interconnected pillars: a robust digital infrastructure comprising eight integrated platform modules that provide real-time analytics, voter intelligence, and operational control; an organised field operations framework that empowers ward-level coordinators with mobile tools and standardised processes; an integrated multi-channel communication system that ensures seamless information flow between the state headquarters, zone coordinators, and grassroots volunteers; and a comprehensive security and compliance layer that protects sensitive voter data and ensures adherence to INEC regulations. Together, these pillars create a campaign operation that is responsive, accountable, and capable of adapting to changing electoral dynamics throughout the campaign cycle."),
  body("The platform encompasses eight core modules: a Voter Intelligence Database with advanced segmentation and predictive analytics; a Real-Time Analytics Dashboard with geospatial visualisation and drill-down capabilities; a Field Coordination Mobile Application with offline-first architecture; an Election Monitoring and Incident Response System with structured escalation workflows; a Communication and Messaging Hub supporting SMS, WhatsApp, email, and in-app notifications; a Volunteer Management System with recruitment pipelines and performance tracking; a Financial Tracking and Resource Management module with budget controls and inventory management; and a Security, Compliance, and Data Governance module with role-based access control, encryption, and audit logging."),
  body("The estimated total investment for the initial setup and first six months of operation is approximately N85 million, covering technology infrastructure, staffing, training, logistics, and contingency reserves. This investment is projected to yield measurable improvements in voter outreach coverage, volunteer mobilisation rates, incident response times, and overall electoral performance. The implementation roadmap spans twelve weeks from approval to full operational capability."),

  // ── 2 ──
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

  // ── 3 ──
  h1("3. Goals and Expected Outcomes"),
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

  // ── 4 ──
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

  // ── 5 ──
  h1("5. Platform Modules — Detailed Specification"),
  body("This section provides in-depth technical and functional specifications for each of the eight core platform modules, covering purpose, features, data models, user interface components, integration points, and performance requirements."),

  // 5.1 VID
  h2("5.1 Voter Intelligence Database"),
  h3("5.1.1 Module Overview"),
  body("The Voter Intelligence Database (VID) is the foundational data module serving as the single source of truth for all voter-related information. It consolidates data from INEC official voter registers, party membership databases, field survey responses, previous election result datasets, and real-time interaction logs. The VID supports complex queries, multi-dimensional segmentation, and predictive analytics that drive all other platform modules."),
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
  tableCaption("Table 4: Voter Data Domains"),
  h3("5.1.3 Key Features"),
  body("Advanced Search and Filtering: Full-text search across all voter fields using Elasticsearch, with filters for any combination of attributes. Users save complex filter combinations as named segments. Search results return in under 500 milliseconds with instant type-ahead suggestions displaying matching names with polling unit context."),
  body("Dynamic Segmentation Engine: Rule-based dynamic segments that automatically update as new data flows in. Supports AND/OR/NOT logic with nested conditional groups. A segment like 'First-time voters aged 18-25 in urban LGAs with high persuadability not yet contacted' grows or shrinks automatically, eliminating manual re-querying."),
  body("Voter Profile Dashboard: 360-degree profile view with interaction timeline, polling unit map, demographic cards, engagement heat maps, and predictive score gauges. Tabbed layout with Overview, Interactions, Predictive Scores, and Map tabs."),
  body("Data Import and Deduplication: Robust import pipeline accepting CSV, Excel, and JSON with configurable field mapping. Automated fuzzy matching on name, address, and VIN for deduplication. Data quality dashboards track completeness, accuracy, and freshness per domain."),
  h3("5.1.4 UI Screens"),
  body("The VID web interface comprises five primary screens: Search and Explore (search bar + left filter panel + results table), Segment Builder (visual drag-and-drop rule builder with live count previews), Voter Profile (tabbed layout with Overview, Interactions, Scores, Map), Data Import (multi-step wizard: upload, map, validate, confirm), and Data Quality Dashboard (completeness heat maps, accuracy charts, deduplication queue). Each screen has a consistent toolbar with Export, Print, Save Segment, and Share actions."),

  // 5.2 Dashboard
  h2("5.2 Real-Time Analytics Dashboard"),
  h3("5.2.1 Module Overview"),
  body("The Analytics Dashboard is the primary command-and-control interface for state-level leadership, providing a live, interactive overview of all campaign activities through an intuitive visual interface. It is accessible via web browser with responsive layouts for tablets, and supports configurable widget grids that users personalise by adding, removing, rearranging, and resizing widgets."),
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
  tableCaption("Table 5: Dashboard Widget Inventory"),
  h3("5.2.2 Interaction Features"),
  body("Drill-Down Navigation: Every widget supports click-through to progressively detailed views. Clicking an LGA on the map opens ward-level metrics; clicking a ward reveals voter-level data. Breadcrumb trails at the top allow jumping back to any hierarchy level. Cross-Widget Filtering: Selecting an LGA on the map automatically filters all other widgets to that LGA. A global filter bar provides persistent date range, LGA, and coordinator filters across all widgets."),
  body("Alert and Notification System: Intelligent alert engine monitors all streams for conditions requiring attention. Critical alerts trigger on-screen notifications with audible chimes and support escalation chains for unanswered alerts. Users acknowledge, assign, and add notes creating an audit trail. Report Generation: One-click PDF and Excel reports with configurable templates, respecting user-level data permissions. Scheduled auto-distribution via email."),

  // 5.3 Field App
  h2("5.3 Field Coordination Mobile Application"),
  h3("5.3.1 Module Overview"),
  body("The Field Coordination Mobile Application is the primary tool for ward coordinators, field agents, and election observers. Built with React Native for cross-platform deployment, it provides comprehensive field operations tools that work seamlessly across all connectivity conditions through an offline-first architecture with automatic transparent synchronisation."),
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
  tableCaption("Table 6: Field App Feature Matrix"),
  h3("5.3.2 Offline-First Architecture"),
  body("A local SQLite database mirrors the server schema for the user's assigned area. Initial data download (50-100 MB) prioritises critical data and defers large files to Wi-Fi. All offline modifications are recorded in a local change log with timestamps. Upon reconnection, the sync engine processes changes chronologically with configurable conflict resolution: merge for interaction logs, latest-timestamp-wins for task updates, server-precedence for deletions. A dedicated conflict resolution interface presents both versions side by side with diff highlighting."),
  h3("5.3.3 Screen-by-Screen UI Specification"),
  body("The app uses a bottom navigation bar with five tabs: Home, Voters, Report, Messages, Profile. The Home screen shows a personalised greeting, task count with circular progress indicator, pending message badges, a horizontal scrollable quick-action bar (Log Visit, Report Incident, Check-In, Survey), and a prioritised task list. The Voters tab opens to a search-first interface with recently viewed voters and filter chips. The Report tab shows a card-based layout with colour-coded severity indicators and a prominent floating action button."),
  body("The Messages tab uses a conversation list with unread badges and last message preview. Individual conversations display messages in a familiar bubble layout: sent messages right-aligned in green-tinted bubbles, received messages left-aligned in white bubbles. The Profile tab provides settings, sync status (green check/orange spinner/red exclamation), language selection, notification preferences, and help. All touch targets are minimum 48x48dp with high-contrast text for outdoor use."),
  h3("5.3.4 Onboarding Flow"),
  body("First-launch experience: Step 1 - Welcome screen with APC logo and app introduction. Step 2 - Credential entry (phone + OTP) and terms acceptance. Step 3 - Initial data download with progress bar showing data categories and estimated time. Step 4 - Guided tour of the home screen using translucent tooltip overlays highlighting each UI element. Users can skip and access the tour later. After onboarding, a 'Getting Started' checklist guides first key actions: complete profile, log first visit, send first message, submit first report."),

  // 5.4 Monitoring
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
  tableCaption("Table 7: Incident Classification Framework"),
  h3("5.4.2 Observer Management and Situation Room"),
  body("Observers complete mandatory training via the LMS module, then check in via GPS-verified proximity (100m radius of assigned PU). The situation room displays a real-time state map with colour-coded PU indicators: green (normal), yellow (minor issues), orange (active investigation), red (critical intervention needed). The display auto-cycles through alert summaries every thirty seconds showing severity, location, and response status. A cumulative incident counter, severity distribution pie chart, and escalation status tracker complete the situation room view."),

  // 5.5 Comms Hub
  h2("5.5 Communication and Messaging Hub"),
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
  tableCaption("Table 8: Communication Hub Features"),
  body("The hub integrates with the VID segmentation engine for audience selection. A manager can target 'Undecided voters aged 25-40 with high turnout probability not yet contacted' and the system resolves this to phone numbers instantly. Communication history appears in voter profiles for field agent context. Frequency controls prevent over-messaging with configurable per-day, per-week, and per-campaign limits. Opt-out management respects unsubscribe requests across all channels automatically."),

  // 5.6 VMS
  h2("5.6 Volunteer Management System"),
  makeTable(
    ["Feature", "Description", "UI Element", "Benefit"],
    [
      ["Smart Scheduling", "Assign based on skills, location, availability, performance", "Calendar + drag-drop", "Optimal matching"],
      ["Shift Management", "Shift patterns for election day; check-in/check-out", "Timeline with capacity bars", "Full coverage"],
      ["Performance Scoring", "Track tasks, attendance, data quality, response time", "Dashboard with trend charts", "Reward top performers"],
      ["Gamification", "Badges, points, leaderboards for milestones", "Badge showcase + leaderboard", "Motivation and retention"],
      ["Proximity Alerts", "Auto-assign nearby volunteers to incidents by GPS", "Alert with accept/decline", "Rapid response"],
      ["Availability Calendar", "Volunteers set availability; prevent over-scheduling", "Self-service calendar in app", "Sustainable engagement"],
    ]
  ),
  tableCaption("Table 9: Volunteer Management Features"),
  body("The recruitment pipeline supports multiple entry points: public web form, referral links, QR codes at events, and direct coordinator entry. Onboarding is managed entirely through the platform with automated welcome messages, training module assignment, completion tracking, and automated status transition from Pending to Active upon training completion."),

  // 5.7 Finance
  h2("5.7 Financial Tracking and Resource Management"),
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
  tableCaption("Table 10: Expense Workflow"),
  body("Inventory management tracks all materials from procurement to distribution with barcode scanning on mobile for quick stock verification. Real-time dashboards show stock vs targets, automated purchase orders at minimum thresholds, and end-of-campaign reconciliation calculating actual cost per voter contacted."),

  // 5.8 Security
  h2("5.8 Security, Compliance, and Data Governance"),
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
  tableCaption("Table 11: RBAC Matrix"),
  body("All PII encrypted at rest (AES-256) and in transit (TLS 1.3). Keys managed via dedicated KMS with 90-day auto-rotation. Field-level encryption for the most sensitive data. Every user action recorded in immutable audit log. Automated compliance monitoring scans for suspicious patterns with real-time alerts. Weekly security reports and quarterly penetration testing. Mandatory security awareness training before system access."),

  // ═══════════════════════════════════════════════════════════════
  // 6. UI/UX DESIGN FRAMEWORK (DEEPENED)
  // ═══════════════════════════════════════════════════════════════
  h1("6. UI/UX Design Framework"),
  h2("6.1 Design Philosophy and Principles"),
  body("The platform's user experience design follows three guiding tenets. Clarity Over Complexity mandates that every screen presents only the information necessary for the user's current task, removing all unnecessary visual elements. Progressive Disclosure reveals advanced features and detailed data only when explicitly requested, keeping the default interface clean and unintimidating for non-technical users. Error Prevention Over Error Correction designs forms and workflows to prevent mistakes through input validation, sensible defaults, and confirmation prompts for irreversible actions, rather than relying on error messages after the fact."),
  h2("6.2 Visual Design Language"),
  body("The visual design uses a clean, modern aesthetic with generous white space, crisp typography, and a restrained colour palette anchored by APC green (#007847). The interface uses a white or very light gray background creating an airy, professional feel that reduces visual fatigue. APC green serves as the primary accent for buttons, links, active states, and positive indicators. Complementary teal for secondary interactive elements. Error states use warm red, warnings use amber, success uses APC green, creating an intuitive colour-language that communicates status without text labels."),
  body("Typography uses Inter for all interface elements, chosen for on-screen readability, wide weight range (400-700), and comprehensive character set. Body text: 16px web / 15sp mobile, line-height 1.5. Headings use Inter Bold at 20-32px. A tabular-numeral variant ensures digit alignment in data columns. Consistent 8px spacing grid for all padding, margins, and gaps, creating visual rhythm and alignment consistency across all screens."),
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
  tableCaption("Table 12: User Personas with Cognitive Load Profiles"),
  h3("6.3.1 Journey Map: Ward Coordinator Daily Workflow"),
  body("Morning: Opens app to Home screen showing personalised greeting, task count with progress ring, and quick-action bar. Taps first task card (slides in from right) showing voter profile with name, address, issue preferences, and previous interaction notes. Taps 'Start Navigation' opening route optimiser. After the visit, taps 'Log Visit' opening a structured form with slider sentiment ratings, dropdown issue selectors, and free-text notes with 500-character counter. Taps 'Submit' seeing a green checkmark pulse animation, then returns to task list with completed task showing green checkmark."),
  body("Incident Encounter: Taps Report tab's floating action button, opening category selection with eight icon tiles in a 2-column grid. Taps 'Voter Intimidation' sliding to severity selector with five colour-coded buttons (green to red). After selecting severity, completes description form with camera button opening device camera in-app. Attaches photo, types description, taps 'Submit' receiving confirmation with incident ID, severity badge, and estimated response time. Push notifications for new tasks appear as small cards at screen top, expandable or swipe-dismissible."),
  h2("6.4 Information Architecture and Navigation"),
  body("Web Dashboard: Left sidebar (260px) with four collapsible groups: Command Centre (Dashboard, Map, Alerts), Operations (Voters, Field, Volunteers, Monitoring), Management (Comms, Finance, Inventory, Reports), Administration (Users, Roles, Settings, Audit). Active item highlighted with APC green and subtle left border. Global search bar with instant results dropdown. On tablet, sidebar collapses to 64px icon-only rail with tap-to-expand animation."),
  body("Mobile App: Bottom tab bar with five destinations (Home, Voters, Report, Messages, Profile). Active tab: filled APC green icon with label. Contextual navigation uses top app bar with back arrow, title, and action buttons. No critical function more than three taps from any screen. A 'Navigation Help' overlay maps the three-tap path to any feature."),
  h2("6.5 Interaction Patterns and Micro-Interactions"),
  body("Success Feedback: Green checkmark scales 0.8x to 1.2x to 1.0x with subtle colour pulse before auto-navigating back. Error States: Inline messages below form fields with red left border and specific guidance; red field border highlight; fade-out on input correction. Loading: Skeleton screens mimicking expected layout with shimmer animation (left-to-right gradient). Pull-to-Refresh: Circular spinner replaces list header, shows 'Last updated: just now' on completion."),
  body("Touch Feedback: Buttons scale to 0.97x on press, return 1.0x on release. List items swipe right to reveal contextual actions (Edit, Delete, Share) in colour-coded buttons. Critical alerts (Level 4-5) use full-screen overlay requiring explicit 'Acknowledge' or 'View Details' tap to dismiss. Chart Interactions: Hover tooltips with exact values; click-to-filter cross-filters all dashboard widgets; pinch-to-zoom on map with smooth animation transitions."),
  h2("6.6 Responsive and Adaptive Design"),
  body("Web: Responsive grid adapting across desktop (1280px+ multi-column), laptop (1024px), and tablet (768px two-column). Below 768px, users are redirected to download the mobile app. Mobile: Targets Android 8.0+ covering 95% of Nigerian market. Designs for 5.5-6.8 inch screens with flexible dp/sp units. Minimum 48x48dp touch targets with 8dp padding. Light/dark mode following system setting. High-contrast mode for outdoor use with minimum 7:1 text contrast ratio."),
  h2("6.7 Accessibility, Error Handling, and Inclusive Design"),
  body("WCAG 2.1 Level AA compliance: text scaling to 200% without breakage, visible focus indicators (2px green outline, 2px offset) for keyboard navigation, labelled form inputs, and colour-never-solo for information conveyance. Empty states guide users to productive action with friendly illustrations and suggestions. Error states show clear explanation, visual problem indicator, and retry mechanism. Nigerian English conventions throughout with local terminology (ward, LGA, senatorial district)."),
  body("Interface text at 8th-grade reading level. Three interface languages: English, Nigerian Pidgin, and Hausa (for northern states), selectable in Profile settings. Right-to-left layout support included for future Arabic expansion. Communication frequency controls prevent over-messaging with configurable limits per day, week, and campaign period."),
  h2("6.8 Notification Design System"),
  body("Three-tier priority model. Tier 1 (Critical): Full-screen overlay on mobile, modal popup on web with red header bar, requires explicit acknowledgment. Tier 2 (Important): Persistent banner notification remaining until dismissed or actioned, green accent. Tier 3 (Informational): Notification centre accessible from profile icon badge, non-interrupting. Each notification includes summary, timestamp, source module icon, and one or two action buttons (View/Dismiss). Tapping navigates directly to relevant detail screen."),
  body("Mobile push notifications customised for lock screen (title + summary only) versus expanded (full content + actions). Web notification bell icon in top-right with real-time unread count badge via WebSocket. Users configure notification preferences per module and priority tier in Profile settings."),

  // ═══════════════════════════════════════════════════════════════
  // 7-12: REMAINING SECTIONS
  // ═══════════════════════════════════════════════════════════════
  h1("7. Physical Office Infrastructure"),
  h2("7.1 Office Layout and Space Requirements"),
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
  tableCaption("Table 13: Office Space Allocation"),
  body("Power: Three-tier system with 20KVA diesel generator, 10KVA solar inverter with battery bank, and 3KVA online UPS. Connectivity: Primary fibre (100Mbps), 4G/5G failover router, VSAT satellite for election day. All connections through enterprise firewall with VPN."),

  h1("8. Organisational Structure and Staffing"),
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
  tableCaption("Table 14: Organisational Structure"),
  h2("8.2 RACI Matrix"),
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
  tableCaption("Table 15: RACI Matrix"),

  h1("9. Implementation Roadmap"),
  makeTable(
    ["Phase", "Timeline", "Modules", "Key Milestones"],
    [
      ["Foundation", "Wk 1-3", "VID, Dashboard, Security", "Office operational, 50% data loaded"],
      ["Activation", "Wk 4-7", "Field App, Comms, VMS, Finance", "Staff trained, app deployed"],
      ["Scale-Up", "Wk 8-10", "Monitoring, full Analytics", "Ward coverage, 5,000 volunteers"],
      ["Excellence", "Wk 11-12", "All modules stress-tested", "Simulations complete, fully ready"],
    ]
  ),
  tableCaption("Table 16: Implementation Roadmap"),
  body("Phase 1 (Foundation, Weeks 1-3): Office setup, infrastructure deployment, voter data consolidation (50% target). Phase 2 (Activation, Weeks 4-7): Staff recruitment and intensive training, mobile app deployment, Comms Hub and VMS configuration. Phase 3 (Scale-Up, Weeks 8-10): Ward coordinator recruitment and training, volunteer drive (5,000 target), election monitoring system configuration, targeted messaging campaigns. Phase 4 (Operational Excellence, Weeks 11-12): Full-scale simulation exercises, stress testing, contingency plan finalisation."),

  h1("10. Resource Requirements and Budget"),
  makeTable(
    ["Category", "Headcount", "Duration", "Cost (N)"],
    [
      ["Campaign Director", "1", "6 months", "\u3010Please fill in\u3011"],
      ["Deputy Directors (5)", "5", "6 months", "\u3010Please fill in\u3011"],
      ["Data Analysts", "4", "6 months", "\u3010Please fill in\u3011"],
      ["Communication Officers", "3", "6 months", "\u3010Please fill in\u3011"],
      ["Field Operations Staff", "5", "6 months", "\u3010Please fill in\u3011"],
      ["Logistics / Admin", "4", "6 months", "\u3010Please fill in\u3011"],
      ["Finance Officers", "2", "6 months", "\u3010Please fill in\u3011"],
      ["IT Support", "2", "6 months", "\u3010Please fill in\u3011"],
      ["Zonal Coordinators", "\u3010Fill\u3011", "4 months", "\u3010Please fill in\u3011"],
      ["Ward Coordinators", "\u3010Fill\u3011", "3 months", "\u3010Please fill in\u3011"],
      ["Election Observers", "\u3010Fill\u3011", "1 week", "\u3010Please fill in\u3011"],
    ]
  ),
  tableCaption("Table 17: Personnel Costs"),
  makeTable(
    ["Item", "Description", "Cost (N)"],
    [
      ["Platform Development", "8 modules: VID, Dashboard, App, Monitoring, Comms, VMS, Finance, Security", "\u3010Please fill in\u3011"],
      ["Cloud Hosting (6mo)", "Servers, databases, Elasticsearch, Redis, CDN, SSL", "\u3010Please fill in\u3011"],
      ["Office Equipment", "24 workstations, 4 displays, printers, networking", "\u3010Please fill in\u3011"],
      ["Power Infrastructure", "20KVA generator, 10KVA solar, 3KVA UPS", "\u3010Please fill in\u3011"],
      ["Mobile Devices", "200 smartphones, 20 tablets, accessories", "\u3010Please fill in\u3011"],
      ["Connectivity", "Fibre, 4G/5G failover, VSAT satellite", "\u3010Please fill in\u3011"],
      ["Office Setup", "Furniture, fixtures, security, branding, AC", "\u3010Please fill in\u3011"],
      ["Software Licenses", "Productivity, CRM, analytics tools", "\u3010Please fill in\u3011"],
      ["Security Infra", "Firewall, VPN, KMS, pen testing", "\u3010Please fill in\u3011"],
    ]
  ),
  tableCaption("Table 18: Technology Budget"),
  makeTable(
    ["Category", "Description", "Cost (N)"],
    [
      ["Transportation", "Fuel, vehicle hire, maintenance", "\u3010Please fill in\u3011"],
      ["Training and Events", "Venue, catering, materials, meetings", "\u3010Please fill in\u3011"],
      ["Campaign Materials", "Posters, flyers, banners, merchandise", "\u3010Please fill in\u3011"],
      ["Utilities", "Power, internet, water, supplies", "\u3010Please fill in\u3011"],
      ["Security", "Personnel, CCTV, access control", "\u3010Please fill in\u3011"],
      ["Contingency (15%)", "Unforeseen expenses and opportunities", "\u3010Please fill in\u3011"],
    ]
  ),
  tableCaption("Table 19: Operational Budget"),

  h1("11. Risk Analysis and Mitigation"),
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
  tableCaption("Table 20: Risk Assessment Matrix"),

  h1("12. Expected Benefits and Evaluation"),
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
  tableCaption("Table 21: Projected Improvements"),
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
  tableCaption("Table 22: Evaluation Framework"),
  body("The evaluation framework incorporates a lessons-learned process capturing operational insights throughout the campaign for future planning. This institutional knowledge management approach ensures the party builds cumulative expertise, avoiding the common pattern where valuable field experience is lost when temporary structures are dismantled after each election cycle."),
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

