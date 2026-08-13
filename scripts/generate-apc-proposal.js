const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel,
  PageBreak, PageNumber, SectionType, TableOfContents,
  Table, TableRow, TableCell, WidthType, TableLayoutType,
  ShadingType, BorderStyle, Header, Footer, TabStopType, TabStopPosition
} = require('docx');

// ═══════════════════════════════════════════════════════════════
// PALETTE & CONSTANTS
// ═══════════════════════════════════════════════════════════════
const palette = {
  cover: {
    bg: "1A2330",
    titleColor: "FFFFFF",
    subtitleColor: "B0B8C0",
    metaColor: "90989F",
    footerColor: "687078",
    accent: "D4875A",
  },
  body: "000000",
  primary: "1A2330",
  secondary: "607080",
  accent: "D4875A",
  surface: "F8F0EB",
  table: {
    headerBg: "D4875A",
    headerText: "FFFFFF",
    accentLine: "D4875A",
    innerLine: "DDD0C8",
    surface: "F8F0EB",
  },
};

const c = (hex) => hex.replace("#", "");
const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

// ═══════════════════════════════════════════════════════════════
// COVER: R1 Pure Paragraph Left with GO-1 palette
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
  const children = [];
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing }, children: [new TextRun({ text: "", size: 2 })] }));
  if (config.englishLabel) {
    children.push(new Paragraph({
      spacing: { after: 300 }, indent: { left: padL },
      children: [new TextRun({ text: config.englishLabel, font: { ascii: "Calibri" }, size: 18, color: P.accent, bold: true, characterSpacing: 200 })],
    }));
  }
  titleLines.forEach((line, i) => {
    children.push(new Paragraph({
      spacing: { after: i === titleLines.length - 1 ? 200 : 100 }, indent: { left: padL },
      children: [new TextRun({ text: line, font: { ascii: "Times New Roman" }, size: titleSize, bold: true, color: P.titleColor })],
    }));
  });
  if (config.subtitle) {
    children.push(new Paragraph({
      spacing: { after: 600 }, indent: { left: padL },
      children: [new TextRun({ text: config.subtitle, font: { ascii: "Calibri" }, size: 24, color: P.subtitleColor, italics: true })],
    }));
  }
  const accentPara = new Paragraph({ spacing: { after: 600 }, indent: { left: padL }, border: { left: accentLeft }, children: [] });
  children.push(accentPara);
  (config.metaLines || []).forEach((line) => {
    children.push(new Paragraph({
      spacing: { after: 100 }, indent: { left: padL },
      children: [new TextRun({ text: line, font: { ascii: "Calibri" }, size: 20, color: P.metaColor })],
    }));
  });
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing }, children: [new TextRun({ text: "", size: 2 })] }));
  children.push(new Paragraph({
    indent: { left: padL }, spacing: { after: 80 },
    children: [new TextRun({ text: config.footerLeft || "", font: { ascii: "Calibri" }, size: 16, color: P.footerColor })],
  }));
  children.push(new Paragraph({
    indent: { left: padL },
    children: [new TextRun({ text: config.footerRight || "", font: { ascii: "Calibri" }, size: 16, color: P.footerColor })],
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: noBorders, children,
      })],
    })],
  });
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
    children: [new TextRun({ text: "APC State Campaign Office — Comprehensive Proposal", size: 18, color: "808080", font: { ascii: "Calibri" }, italics: true })],
  })] });
}

// ═══════════════════════════════════════════════════════════════
// DOCUMENT CONTENT — DEEPENED VERSION
// ═══════════════════════════════════════════════════════════════

const bodyContent = [

  // ═══════════════════════════════════════════════════════════════
  // 1. EXECUTIVE SUMMARY
  // ═══════════════════════════════════════════════════════════════
  h1("1. Executive Summary"),
  body("This proposal presents a comprehensive, technology-enabled solution for establishing a fully operational APC State Campaign Office that serves as the central nervous system for all electoral activities within the state. The proposed framework addresses the critical need for a centralised command structure that integrates voter data management, real-time communication, field coordination, election monitoring, volunteer mobilisation, financial tracking, and security governance into a single, cohesive platform. In an era where political campaigns are increasingly won or lost on the strength of operational efficiency and data-driven decision-making, the APC must leverage modern campaign technology to maintain its competitive advantage across all senatorial districts and local government areas."),
  body("The solution centres on four interconnected pillars: a robust digital infrastructure comprising eight integrated platform modules that provide real-time analytics, voter intelligence, and operational control; an organised field operations framework that empowers ward-level coordinators with mobile tools and standardised processes; an integrated multi-channel communication system that ensures seamless information flow between the state headquarters, zone coordinators, and grassroots volunteers; and a comprehensive security and compliance layer that protects sensitive voter data and ensures adherence to INEC regulations. Together, these pillars create a campaign operation that is responsive, accountable, and capable of adapting to changing electoral dynamics throughout the campaign cycle."),
  body("The platform encompasses eight core modules: a Voter Intelligence Database with advanced segmentation and predictive analytics; a Real-Time Analytics Dashboard with geospatial visualisation and drill-down capabilities; a Field Coordination Mobile Application with offline-first architecture; an Election Monitoring and Incident Response System with structured escalation workflows; a Communication and Messaging Hub supporting SMS, WhatsApp, email, and in-app notifications; a Volunteer Management System with recruitment pipelines and performance tracking; a Financial Tracking and Resource Management module with budget controls and inventory management; and a Security, Compliance, and Data Governance module with role-based access control, encryption, and audit logging."),
  body("The estimated total investment for the initial setup and first six months of operation is approximately N85 million, covering technology infrastructure, staffing, training, logistics, and contingency reserves. This investment is projected to yield measurable improvements in voter outreach coverage, volunteer mobilisation rates, incident response times, and overall electoral performance. The implementation roadmap spans twelve weeks from approval to full operational capability, with incremental milestones that allow the campaign leadership to assess progress and make data-informed adjustments at each phase."),

  // ═══════════════════════════════════════════════════════════════
  // 2. CURRENT STATE & PROBLEM ANALYSIS
  // ═══════════════════════════════════════════════════════════════
  h1("2. Current State and Problem Analysis"),
  h2("2.1 Existing Campaign Infrastructure"),
  body("The current state of APC state-level campaign operations across most Nigerian states relies heavily on informal organisational structures that have remained largely unchanged since the 2015 general elections. Field coordinators typically operate from personal residences or rented spaces that lack consistent power supply, internet connectivity, and basic office equipment. Communication between the state headquarters and ward-level units depends on personal mobile phone calls and WhatsApp groups, which, while effective for simple messaging, lack the structure, auditability, and scalability required for a modern campaign managing hundreds of thousands of voter interactions across geographically dispersed polling units."),
  body("Voter data, where it exists at all, is typically stored in disconnected spreadsheets maintained by individual local government coordinators. There is no centralised voter database that provides a unified view of voter demographics, registration status, past voting behaviour, or issue-based segmentation. This fragmentation means that campaign strategies are often designed based on anecdotal evidence and personal experience rather than empirical data, leading to inefficient resource allocation and missed opportunities in high-potential polling units. Financial tracking, if performed at all, consists of manual ledger entries that are opaque, difficult to audit, and vulnerable to mismanagement."),
  body("Volunteer mobilisation follows no systematic process. Recruitment happens through personal networks rather than structured outreach, training is inconsistent and undocumented, task assignment is ad hoc, and there is no mechanism for tracking volunteer attendance, performance, or retention. This results in significant volunteer churn, wasted training investment, and unreliable field coverage on critical campaign days. Security protocols are minimal, with sensitive voter data regularly shared through unencrypted channels and physical documents stored without proper access controls."),
  h2("2.2 Key Challenges Identified"),
  body("Through extensive consultation with party officials, ward coordinators, and field agents, several critical challenges have been identified that collectively undermine campaign effectiveness. These challenges span organisational, technological, and operational dimensions, and they interact in ways that compound their individual impact on campaign performance."),
  makeTable(
    ["Challenge Area", "Description", "Impact Level"],
    [
      ["Fragmented Voter Data", "Voter records scattered across spreadsheets with no central repository or standardised format", "Critical"],
      ["Communication Gaps", "Information flow relies on informal channels; delays of 24-48 hours for critical updates", "High"],
      ["No Real-Time Visibility", "State headquarters lacks live dashboards for field activity, incident reports, or voter sentiment", "Critical"],
      ["Volunteer Management Vacuum", "No systematic approach to recruitment, training, assignment, scheduling, or performance tracking", "High"],
      ["Financial Opacity", "Campaign expenditures tracked manually with no real-time budget monitoring or audit trail", "High"],
      ["Resource Misallocation", "Campaign materials and personnel deployed without data-driven prioritisation of polling units", "High"],
      ["Weak Election Monitoring", "Election day monitoring relies on ad-hoc phone calls; no structured incident reporting or escalation", "Critical"],
      ["Security Vulnerabilities", "Sensitive data shared via unencrypted channels; no role-based access control or audit logging", "Critical"],
      ["No Predictive Analytics", "Campaign decisions based on anecdotal evidence rather than data-driven voter modelling", "Medium"],
      ["Post-Election Knowledge Loss", "Field experience and operational insights lost when temporary structures are dismantled", "Medium"],
    ]
  ),
  tableCaption("Table 1: Comprehensive Challenge Matrix"),
  h2("2.3 Technology Gap Analysis"),
  body("A systematic technology gap analysis reveals that the current campaign operation lacks foundational capabilities that are considered standard in modern political campaign management. The absence of a centralised database means there is no single source of truth for voter information, leading to duplicated effort, contradictory data, and inability to perform cross-referencing analysis. The lack of mobile field tools forces coordinators to rely on paper-based data collection that is slow, error-prone, and impossible to aggregate in real time. Without an analytics engine, the campaign cannot identify trends, segment voters, or optimise resource allocation based on empirical evidence."),
  body("The communication infrastructure gap is particularly acute. While individual coordinators may have smartphones, there is no unified platform that enables structured data collection, standardised reporting formats, or verified information dissemination. WhatsApp groups, the primary communication channel, provide no message prioritisation, no read-receipt tracking for critical alerts, no structured data capture, and no archiving for compliance or legal purposes. The absence of a dedicated election monitoring system means that on election day, the party is effectively blind to developing situations at individual polling units until reports filter through informal channels hours after the fact."),
  h2("2.4 Strategic Implications"),
  body("The cumulative effect of these challenges is a campaign operation that reacts slowly to emerging situations, fails to capitalise on favourable voter dynamics, and cannot provide state-level leadership with the timely intelligence needed for strategic decision-making. In closely contested states where margins of victory can be as narrow as a few thousand votes across dozens of polling units, these operational deficiencies translate directly into lost votes and, ultimately, lost elections. The 2023 electoral cycle demonstrated that opposition parties who invested in centralised campaign technology and data-driven field operations were able to achieve significant gains in previously safe APC territories, underscoring the urgency of modernising the party's campaign infrastructure."),

  // ═══════════════════════════════════════════════════════════════
  // 3. GOALS & EXPECTED OUTCOMES
  // ═══════════════════════════════════════════════════════════════
  h1("3. Goals and Expected Outcomes"),
  h2("3.1 Primary Objectives"),
  body("The proposed solution is designed to achieve eight primary objectives that directly address the challenges identified in the current state analysis. Each objective is measurable, time-bound, and linked to specific key performance indicators that will be tracked throughout the campaign lifecycle via the analytics dashboard."),
  makeTable(
    ["Objective", "Key Performance Indicator", "Target"],
    [
      ["Centralise Voter Data", "Percentage of registered voters in digitised database", "90% within 8 weeks"],
      ["Real-Time Communication", "Average time for critical alerts from field to HQ", "Under 15 minutes"],
      ["Field Coordination", "Number of active ward coordinators with mobile access", "100% coverage"],
      ["Election Monitoring", "Percentage of polling units with trained observers", "95% on election day"],
      ["Volunteer Management", "Registered, trained, and assignable volunteers in system", "5,000+ within 10 weeks"],
      ["Financial Transparency", "Real-time budget utilisation visible to authorised users", "100% expenditure tracked"],
      ["Resource Efficiency", "Reduction in material wastage through data-driven distribution", "40% reduction"],
      ["Security Compliance", "Percentage of staff completing security training and NDA signing", "100% before system access"],
    ]
  ),
  tableCaption("Table 2: Primary Objectives and Key Performance Indicators"),
  h2("3.2 Expected Outcomes"),
  body("Upon full implementation, the state campaign office will operate as a professional, data-driven organisation capable of supporting thousands of field operatives across all local government areas. The centralised voter intelligence system will enable micro-targeting of campaign messages to specific demographic groups, issue-based voter engagement at the polling unit level, and predictive modelling of voter turnout that allows the campaign to focus resources where they will have the greatest electoral impact. The analytics dashboard will provide unprecedented situational awareness, allowing campaign leadership to monitor field activity, identify emerging trends, and redirect resources in real time based on data rather than intuition."),
  body("The integrated monitoring and incident response framework will provide the party with an unprecedented ability to detect, report, and escalate electoral irregularities in real time. This capability serves a dual purpose: it protects the integrity of the electoral process for APC supporters, and it provides the party with documentary evidence that can support legal challenges if necessary. The volunteer management system will transform ad hoc mobilisation into a structured, measurable process with clear accountability and performance metrics. The financial tracking module will ensure that every naira spent is documented, categorised, and auditable, providing donors and party leadership with confidence in the stewardship of campaign funds."),
  body("Furthermore, the communication infrastructure will persist beyond election day, providing the party with a permanent organising platform for governance engagement, membership mobilisation, and future electoral preparation. The institutional knowledge captured through the platform's data layers, operational logs, and evaluation frameworks will accumulate across election cycles, building a permanent competitive advantage that grows stronger with each successive campaign."),

  // ═══════════════════════════════════════════════════════════════
  // 4. SOLUTION ARCHITECTURE OVERVIEW
  // ═══════════════════════════════════════════════════════════════
  h1("4. Solution Architecture Overview"),
  h2("4.1 High-Level System Architecture"),
  body("The campaign technology platform follows a modern, cloud-native microservices architecture designed for scalability, reliability, and rapid iteration. The system is organised into four architectural layers: the Presentation Layer comprising the web dashboard and mobile applications; the Application Layer containing the eight core platform modules as independent microservices; the Data Layer managing persistent storage, caching, and search indexing; and the Infrastructure Layer providing cloud hosting, content delivery, and security services. Each layer communicates through well-defined APIs, enabling independent scaling, deployment, and maintenance of individual components without affecting the overall system."),
  body("The platform is designed with a mobile-first philosophy, recognising that the majority of end-users, including ward coordinators, field agents, and election observers, will interact with the system primarily through smartphones. The web dashboard serves as the command centre for state-level leadership, providing comprehensive oversight and analytical capabilities that require larger screen real estate. The mobile application is optimised for low-bandwidth environments and intermittent connectivity, employing an offline-first architecture that synchronises data with the central server whenever connectivity is available, ensuring that field operations continue uninterrupted regardless of network conditions."),
  h2("4.2 Technology Stack"),
  makeTable(
    ["Layer", "Technology", "Rationale"],
    [
      ["Frontend (Web)", "React.js with TypeScript, Tailwind CSS", "Component reusability, type safety, rapid UI development"],
      ["Frontend (Mobile)", "React Native with Expo", "Single codebase for Android and iOS, offline storage via SQLite"],
      ["Backend API", "Node.js with Express.js / Fastify", "High throughput, JavaScript ecosystem consistency"],
      ["Database", "PostgreSQL (primary), Redis (cache)", "ACID compliance for voter data, sub-millisecond cache responses"],
      ["Search Engine", "Elasticsearch", "Full-text voter search, geospatial queries, analytics aggregation"],
      ["File Storage", "AWS S3 / MinIO (self-hosted)", "Scalable media storage for photos, documents, reports"],
      ["Real-Time Communication", "WebSocket (Socket.io) + Push notifications", "Instant alerts, live dashboard updates"],
      ["Authentication", "OAuth 2.0 + JWT with refresh tokens", "Secure, stateless authentication across all modules"],
      ["Cloud Infrastructure", "AWS / Azure with multi-AZ deployment", "High availability, auto-scaling, disaster recovery"],
      ["CI/CD Pipeline", "GitHub Actions + Docker + Kubernetes", "Automated testing, deployment, and rollback"],
      ["Monitoring", "Grafana + Prometheus + Sentry", "System health, error tracking, performance alerting"],
    ]
  ),
  tableCaption("Table 3: Technology Stack Specification"),
  h2("4.3 Data Flow Architecture"),
  body("Data flows through the platform in a structured pipeline that ensures consistency, auditability, and real-time availability. Field data captured through the mobile application is first stored locally in an encrypted SQLite database, then synchronised to the central server via a queued replication mechanism that handles conflict resolution using last-write-wins with operational transformation for concurrent edits. Once received by the API gateway, data is validated, transformed, and routed to the appropriate microservice for processing. Voter data updates are indexed in Elasticsearch for fast search, while aggregate metrics are pre-computed and cached in Redis for dashboard display."),
  body("The event-driven architecture uses a message broker to decouple modules and ensure reliable data propagation. When an incident report is submitted from the field, for example, the event triggers simultaneous notifications to the monitoring dashboard, the communications module for alert broadcasting, and the analytics engine for trend analysis, all without blocking the original submission. This asynchronous processing model ensures that the system remains responsive even under heavy load, such as on election day when thousands of observers may be submitting reports simultaneously."),
  h2("4.4 Security Architecture"),
  body("Security is embedded at every layer of the architecture, following the principle of defence in depth. All data in transit is encrypted using TLS 1.3, and all data at rest is encrypted using AES-256. The authentication system implements multi-factor authentication for administrative users, with biometric authentication available on supported mobile devices. Role-based access control (RBAC) governs all API endpoints, ensuring that users can only access data and perform actions appropriate to their assigned role. A comprehensive audit logging system records every data access, modification, and deletion event, creating an immutable trail that supports both security forensics and regulatory compliance."),

  // ═══════════════════════════════════════════════════════════════
  // 5. PLATFORM MODULES — DETAILED SPECIFICATION
  // ═══════════════════════════════════════════════════════════════
  h1("5. Platform Modules — Detailed Specification"),
  body("This section provides an in-depth technical and functional specification for each of the eight core platform modules. For each module, the specification covers the purpose and scope, key features and functionalities, data models, user interface components, integration points with other modules, and performance requirements."),

  // ── 5.1 Voter Intelligence Database ──
  h2("5.1 Voter Intelligence Database"),
  h3("5.1.1 Module Overview"),
  body("The Voter Intelligence Database (VID) is the foundational data module that serves as the single source of truth for all voter-related information across the campaign. It consolidates data from multiple sources including INEC official voter registers, party membership databases, field survey responses, previous election result datasets, and real-time interaction logs from field operatives. The VID is designed to support complex queries, multi-dimensional segmentation, and predictive analytics that drive all other platform modules from campaign messaging to resource allocation."),
  h3("5.1.2 Data Model and Schema"),
  body("The voter record schema captures over forty data points per individual, organised into six primary data domains. The Demographic domain includes age, gender, occupation, education level, and language preference. The Geographic domain maps each voter to their polling unit, ward, local government area, senatorial district, and state, with GPS coordinates for geospatial analysis. The Electoral domain tracks registration status, voter card collection status, previous election turnout history, and party affiliation indicators. The Engagement domain records all interactions between the voter and campaign operatives, including door-to-door visits, phone calls, event attendance, and digital engagement metrics. The Issue domain captures the voter's stated policy priorities and concerns as reported by field agents. The Predictive domain stores model-generated scores for turnout likelihood, party affinity, and persuadability."),
  makeTable(
    ["Data Domain", "Key Fields", "Data Source", "Update Frequency"],
    [
      ["Demographic", "Age, gender, occupation, education, language", "INEC register + field surveys", "Initial load + monthly refresh"],
      ["Geographic", "PU code, ward, LGA, district, GPS coordinates", "INEC register + geocoding", "Initial load"],
      ["Electoral History", "Past turnout (2019, 2023), registration status, PVC collected", "INEC records + party data", "Per election cycle"],
      ["Engagement", "Visit logs, call records, event attendance, digital clicks", "Field app + CRM", "Real-time"],
      ["Issue Preferences", "Top 3 concerns, policy priorities, sentiment score", "Field surveys", "Weekly during campaign"],
      ["Predictive Scores", "Turnout probability, party affinity, persuadability index", "ML model output", "Recomputed bi-weekly"],
    ]
  ),
  tableCaption("Table 4: Voter Intelligence Database — Data Domains"),
  h3("5.1.3 Key Features"),
  body("Advanced Search and Filtering: The VID supports full-text search across all voter fields using Elasticsearch, with filters for any combination of demographic, geographic, electoral, and engagement attributes. Users can save complex filter combinations as named segments for repeated use, enabling quick access to frequently analysed voter cohorts. Search results are returned in under 500 milliseconds for queries against the full state voter register, ensuring that analysts can iterate rapidly during strategic planning sessions."),
  body("Dynamic Segmentation Engine: Beyond static filters, the segmentation engine supports rule-based dynamic segments that automatically update as new data flows into the system. For example, a segment defined as 'First-time voters aged 18-25 in urban LGAs with high persuadability scores who have not yet been contacted' will automatically grow or shrink as field agents log interactions and the predictive model updates scores. This eliminates the manual effort of repeatedly re-running queries and ensures that campaign strategies are always based on the latest available data."),
  body("Voter Profile Dashboard: Each voter record opens into a comprehensive profile view that displays all available information in a structured, scannable layout. The profile includes a timeline of all recorded interactions, a map showing the voter's polling unit location, demographic summary cards, engagement heat maps, and predictive score gauges. This 360-degree view enables field agents to prepare personalised engagement strategies before voter contact and allows analysts to identify patterns across individual voter profiles."),
  body("Data Import and Deduplication: The VID includes a robust data import pipeline that accepts CSV, Excel, and JSON files from multiple sources, with configurable field mapping to accommodate variations in data format across local government areas. An automated deduplication algorithm uses fuzzy matching on name, address, and voter identification number to identify and merge duplicate records, with a manual review queue for edge cases that require human judgment. Data quality dashboards track completeness, accuracy, and freshness metrics for each data domain, enabling the data team to prioritise cleanup efforts."),
  h3("5.1.4 Integration Points"),
  body("The VID feeds data to virtually every other platform module. The Analytics Dashboard consumes aggregated VID data for visualisation and trend analysis. The Field Coordination App queries the VID to provide coordinators with voter lists for their assigned areas. The Communication Hub uses VID segments as target audiences for broadcast messaging. The Volunteer Management System matches volunteer skills and locations to voter outreach priorities derived from VID data. The Financial Tracking Module uses VID-derived outreach targets to calculate cost-per-contact metrics for budget efficiency analysis."),

  // ── 5.2 Real-Time Analytics Dashboard ──
  h2("5.2 Real-Time Analytics Dashboard"),
  h3("5.2.1 Module Overview"),
  body("The Real-Time Analytics Dashboard is the primary command-and-control interface for state-level campaign leadership. It provides a live, interactive overview of all campaign activities, metrics, and field intelligence across the entire state, presented through an intuitive visual interface designed for rapid comprehension and decision-making. The dashboard is accessible via web browser on desktop computers and large-format displays in the campaign situation room, with responsive layouts that adapt to tablet screens for mobile leadership access."),
  h3("5.2.2 Dashboard Components and Widgets"),
  body("The dashboard is organised into a configurable grid layout where each widget displays a specific category of information. The default layout presents the most critical metrics prominently, but users with appropriate permissions can customise their personal dashboard view by adding, removing, rearranging, and resizing widgets to match their specific information needs. The following table describes the standard widget inventory."),
  makeTable(
    ["Widget", "Description", "Data Source", "Refresh Rate"],
    [
      ["KPI Summary Cards", "Key metrics: voters contacted, volunteers active, incidents open, budget utilisation %", "Aggregated from all modules", "Real-time (WebSocket)"],
      ["Geospatial Map View", "Interactive state map colour-coded by LGA performance metrics; drill-down to ward/PU level", "VID + Field App + Monitoring", "Every 60 seconds"],
      ["Field Activity Timeline", "Chronological feed of field reports, events, and status changes with filters by LGA/ward", "Field Coordination Module", "Real-time (WebSocket)"],
      ["Voter Sentiment Trends", "Line charts showing sentiment scores over time, segmented by demographics or geography", "VID Engagement Domain", "Hourly"],
      ["Volunteer Deployment Heatmap", "Visual representation of volunteer coverage vs. target coverage by area", "Volunteer Management System", "Every 30 minutes"],
      ["Incident Tracker", "Live incident list with severity indicators, status, and escalation state", "Election Monitoring Module", "Real-time (WebSocket)"],
      ["Budget Burn Rate Chart", "Stacked area chart showing cumulative expenditure by category vs. budget allocation", "Financial Tracking Module", "Daily"],
      ["Material Distribution Status", "Progress bars showing campaign material delivery status by LGA and ward", "Logistics / Resource Module", "Every 2 hours"],
      ["Turnout Prediction Model", "Projected turnout by LGA based on historical data, weather, and engagement signals", "VID Predictive Domain", "Bi-weekly"],
      ["Communication Reach Metrics", "Messages sent, delivered, read, and responded to by channel (SMS, WhatsApp, email)", "Communication Hub", "Hourly"],
    ]
  ),
  tableCaption("Table 5: Analytics Dashboard Widget Inventory"),
  h3("5.2.3 Interaction Features"),
  body("Drill-Down Navigation: Every widget supports click-through navigation to progressively more detailed views. Clicking an LGA on the map view, for example, opens a ward-level breakdown with individual polling unit metrics. Clicking a specific ward then reveals the voter-level data for that area, including individual interaction histories and predictive scores. This hierarchical drill-down capability allows campaign leadership to move from a strategic state-level overview to tactical polling-unit-level intelligence in three clicks, enabling rapid root-cause analysis when anomalies are detected."),
  body("Alert and Notification System: The dashboard includes an intelligent alert engine that monitors all incoming data streams for conditions that require leadership attention. Alerts are configured with user-defined thresholds and severity levels. Critical alerts, such as a sudden spike in incident reports from a specific LGA or a significant drop in field report submission rates, trigger immediate on-screen notifications with audible chimes on the situation room displays. The alert system also supports escalation chains, where unanswered critical alerts are automatically escalated to the next level of management after a configurable time window."),
  body("Report Generation and Export: The dashboard provides one-click generation of standardised reports in PDF and Excel formats, covering daily operational summaries, weekly performance reviews, and ad hoc analytical deep-dives. Report templates are configurable, and the export function respects user-level data access permissions, ensuring that sensitive voter-level data is only included in reports authorised for the requesting user's role. Scheduled report generation supports automatic distribution via email to specified recipients at configured intervals."),
  h3("5.2.4 Performance Requirements"),
  body("The dashboard must load within three seconds on a standard broadband connection, with all widget data populated and interactive. Real-time WebSocket updates should propagate from the field to the dashboard display within fifteen seconds under normal operating conditions. The geospatial map view must support smooth panning and zooming across the full state map with at least ten thousand data points rendered simultaneously without frame drops. The system must support at least fifty concurrent dashboard users without degradation, scaling to two hundred concurrent users on election day through horizontal auto-scaling of the WebSocket server infrastructure."),

  // ── 5.3 Field Coordination Mobile Application ──
  h2("5.3 Field Coordination Mobile Application"),
  h3("5.3.1 Module Overview"),
  body("The Field Coordination Mobile Application is the primary tool for ward coordinators, field agents, and election observers, designed to operate reliably in the challenging connectivity environments common across Nigerian states. Built with React Native for cross-platform deployment to both Android and iOS devices, the application provides a comprehensive suite of field operations tools that work seamlessly whether the user has a strong 4G connection, a weak 2G edge signal, or no connectivity at all. The offline-first architecture ensures that field operatives can continue all critical activities without interruption, with automatic data synchronisation occurring transparently whenever connectivity becomes available."),
  h3("5.3.2 Core Features"),
  makeTable(
    ["Feature", "Description", "Offline Support"],
    [
      ["Daily Activity Logger", "Structured forms for recording door-to-door visits, phone calls, and community events", "Full — cached locally"],
      ["Voter Search & Lookup", "Search voter database by name, PU code, or address; view profile and interaction history", "Partial — cached ward data"],
      ["GPS-Tagged Incident Reporter", "Submit incident reports with photos, location pins, severity classification, and descriptions", "Full — queued for sync"],
      ["Route Optimiser", "Generate optimised canvassing routes based on voter density and visit priority", "Full — pre-downloaded maps"],
      ["Task Assignment Inbox", "Receive and acknowledge tasks from zonal coordinators; update status and add notes", "Full — local task queue"],
      ["Quick Poll / Survey Tool", "Conduct structured voter surveys with configurable question sets and skip logic", "Full — responses cached"],
      ["Material Request Form", "Request campaign materials for assigned area with quantity and type specifications", "Full — queued for sync"],
      ["Instant Messaging", "Secure chat with zonal coordinator and state HQ; supports text, image, and voice notes", "Partial — recent messages"],
      ["Attendance Check-In", "GPS-verified check-in at events, training sessions, and polling units", "Full — time-stamped locally"],
      ["Data Sync Dashboard", "View sync status, pending uploads, and conflicts; manual sync trigger available", "N/A — core function"],
    ]
  ),
  tableCaption("Table 6: Field Coordination App — Core Feature Matrix"),
  h3("5.3.3 Offline-First Architecture"),
  body("The offline-first architecture is implemented through a local SQLite database that mirrors the server-side data schema for the user's assigned area. When the user first logs in, the application performs an initial data download that includes all voter records for their assigned wards, their task queue, recent messages, and configuration data such as survey forms and material request templates. This initial download typically requires approximately 50-100 MB of data, which is managed through a smart download scheduler that prioritises critical data and defers large downloads to Wi-Fi connections when available."),
  body("All data modifications made while offline are recorded in a local change log with timestamps and conflict metadata. When connectivity is restored, a synchronisation engine processes the change log in chronological order, pushing local changes to the server and pulling any server-side changes that occurred during the offline period. Conflict resolution follows a configurable strategy: for voter interaction logs, the system uses a merge strategy that preserves all entries from both sides; for task status updates, the most recent timestamp wins; and for data deletions, the server-side state takes precedence to prevent accidental data loss. Users are notified of any sync conflicts and can review and resolve them manually through a dedicated conflict resolution interface."),
  h3("5.3.4 User Interface Design"),
  body("The mobile application follows a bottom navigation bar pattern with five primary sections: Home (dashboard with today's tasks and quick actions), Voters (search and voter management), Report (incident and activity logging), Messages (communication hub), and Profile (settings, sync status, and help). The home screen presents a personalised daily briefing that includes pending tasks, upcoming events, unread messages, and a quick-action bar for the most common activities such as logging a visit or reporting an incident. Each screen uses large touch targets (minimum 48x48 pixels), high-contrast text, and clear visual hierarchy to ensure usability in outdoor conditions with potential glare."),
  body("Form inputs are designed for speed and accuracy, with auto-complete for voter names and PU codes, dropdown selectors for categorical fields, and photo capture buttons directly integrated into incident report forms. The application supports multiple Nigerian languages for interface labels and survey questions, with language selection available in the user profile settings. Gesture-based navigation includes swipe-to-go-back, pull-to-refresh for data updates, and long-press for contextual menus on list items."),

  // ── 5.4 Election Monitoring & Incident Response ──
  h2("5.4 Election Monitoring and Incident Response System"),
  h3("5.4.1 Module Overview"),
  body("The Election Monitoring and Incident Response System provides a structured, technology-enabled framework for observing electoral processes, detecting irregularities, and coordinating rapid response across all polling units in the state. This module transforms the traditional ad hoc approach to election monitoring into a systematic, real-time operation that provides state headquarters with complete visibility into the electoral process as it unfolds. The system supports three operational phases: pre-election monitoring (voter card collection tracking, campaign violence surveillance), election day monitoring (polling unit observation, incident reporting, results tracking), and post-election monitoring (results aggregation, legal evidence compilation)."),
  h3("5.4.2 Incident Classification and Workflow"),
  body("The system uses a structured incident taxonomy that classifies events into twelve categories covering all common electoral irregularities. Each category has a defined severity scale from Level 1 (minor procedural irregularity) to Level 5 (critical threat to electoral integrity), with automatic escalation rules that ensure appropriate response urgency. The following table presents the incident classification framework."),
  makeTable(
    ["Incident Category", "Description", "Severity Range", "Auto-Escalation Trigger"],
    [
      ["Voter Intimidation", "Threats, coercion, or harassment of voters near polling units", "Level 3-5", "Any Level 3+ escalates to LGA zonal coordinator"],
      ["Ballot Box Tampering", "Physical interference with ballot boxes or voting materials", "Level 5", "Immediate escalation to state HQ and legal team"],
      ["Voter Disenfranchisement", "Voters turned away without valid cause, missing voter registers", "Level 3-4", "Escalate to LGA coordinator if 3+ reports from same PU"],
      ["Bribery and Vote Buying", "Offers of money, goods, or services in exchange for votes", "Level 3-5", "Pattern detection: 3+ reports from same LGA triggers alert"],
      ["Violence and Security", "Physical altercations, weapon sightings, or mob activity", "Level 4-5", "Any Level 4+ triggers immediate security team alert"],
      ["INEC Personnel Misconduct", "Improper behaviour by electoral officials including bias or negligence", "Level 2-4", "Escalate to state HQ for INEC liaison"],
      ["Vote Counting Irregularities", "Deviation from counting procedures, result sheet manipulation", "Level 4-5", "Immediate escalation with photo evidence required"],
      ["Logistics and Materials", "Late arrival of materials, insufficient ballots, equipment failure", "Level 2-3", "Escalate to logistics unit for remediation"],
    ]
  ),
  tableCaption("Table 7: Incident Classification Framework"),
  h3("5.4.3 Observer Management"),
  body("The system manages a registry of trained election observers assigned to specific polling units, with tracking of their deployment status, check-in times, and report submission history. Each observer is required to complete a standardised training programme delivered through the platform's learning management module, which covers incident recognition, reporting procedures, personal safety protocols, and legal rights and responsibilities. Upon arrival at their assigned polling unit, observers check in via the mobile application's GPS-verified check-in feature, which confirms their physical presence and activates their reporting interface. Observers submit structured observation reports at scheduled intervals, including opening procedures, mid-day situation reports, closing procedures, and results observation forms."),
  h3("5.4.4 Situation Room Integration"),
  body("On election day, the monitoring system feeds directly into the campaign situation room through a dedicated large-format display that presents a real-time state map with colour-coded polling unit status indicators. Green indicates normal operations, yellow indicates minor issues being monitored, orange indicates active incidents under investigation, and red indicates critical situations requiring immediate intervention. The situation room display automatically cycles through alert summaries, showing the most recent incidents with their severity, location, and current response status. A dedicated incident response team in the situation room is responsible for triaging incoming reports, coordinating with field observers for additional information, and initiating response actions through the communication module."),

  // ── 5.5 Communication & Messaging Hub ──
  h2("5.5 Communication and Messaging Hub"),
  h3("5.5.1 Module Overview"),
  body("The Communication and Messaging Hub serves as the central nervous system for all campaign communications, providing a unified platform for multi-channel message delivery, internal collaboration, and public engagement. The hub integrates four primary communication channels: SMS for broad voter outreach, WhatsApp for volunteer and coordinator communication, email for formal stakeholder engagement, and in-app push notifications for platform users. A message composer interface allows authorised users to craft messages once and distribute them across multiple channels simultaneously, with channel-specific formatting and character limit handling applied automatically."),
  h3("5.5.2 Key Features and Functionalities"),
  makeTable(
    ["Feature", "Description", "Target Users"],
    [
      ["Broadcast Messaging", "Send messages to pre-defined segments (e.g., all voters in an LGA, all ward coordinators)", "Comms team, Campaign Director"],
      ["Template Library", "Pre-approved message templates for common scenarios: event invitations, voting reminders, incident alerts", "All authorised users"],
      ["Scheduled Delivery", "Queue messages for delivery at optimal times based on engagement analytics and time zone considerations", "Comms team"],
      ["Two-Way SMS", "Receive and respond to voter replies via SMS; auto-classify common response categories", "Comms officers"],
      ["WhatsApp Group Management", "Create, manage, and broadcast to hierarchical WhatsApp groups mirroring the organisational structure", "Zonal and ward coordinators"],
      ["Push Notification Manager", "Configure and send targeted push notifications to mobile app users by role, location, or segment", "System administrators"],
      ["Message Analytics", "Track delivery rates, open rates, response rates, and engagement metrics per campaign and channel", "Comms team, Data analysts"],
      ["Compliance Filter", "Automatic screening for content that may violate INEC regulations or platform terms of service", "System (automatic)"],
      ["Emergency Alert System", "Override channel for critical alerts that bypass scheduling and deliver immediately to all recipients", "Campaign Director only"],
    ]
  ),
  tableCaption("Table 8: Communication Hub Feature Matrix"),
  h3("5.5.3 Audience Segmentation Integration"),
  body("The Communication Hub integrates directly with the Voter Intelligence Database's segmentation engine, allowing communication staff to select target audiences using the full range of voter attributes and predictive scores. A campaign manager can, for example, compose a message targeted at 'Undecided voters aged 25-40 in Lagos Island LGA with high turnout probability who have not yet been contacted,' and the system will automatically resolve this segment to a current list of phone numbers and delivery channels. This eliminates the manual process of exporting segments and importing them into separate messaging tools, reducing the time from audience identification to message delivery from hours to minutes."),
  body("The hub also maintains communication history for each contact, recording every message sent, delivered, and received. This history is visible in the voter profile view within the VID, providing field agents with complete context for their next interaction. Communication frequency controls prevent over-messaging individual voters, with configurable limits on messages per day, week, and campaign period. Opt-out management automatically respects unsubscribe requests across all channels, ensuring compliance with communication ethics and potential future regulatory requirements."),

  // ── 5.6 Volunteer Management System ──
  h2("5.6 Volunteer Management System"),
  h3("5.6.1 Module Overview"),
  body("The Volunteer Management System (VMS) provides an end-to-end platform for recruiting, onboarding, training, scheduling, and retaining campaign volunteers. It transforms the currently ad hoc volunteer mobilisation process into a structured, measurable operation with clear accountability and performance metrics. The VMS manages the full volunteer lifecycle from initial expression of interest through active deployment to post-campaign recognition, creating a permanent talent pool that persists across election cycles and provides the party with a growing base of trained, experienced grassroots operatives."),
  h3("5.6.2 Recruitment Pipeline"),
  body("The recruitment module provides multiple entry points for volunteer sign-up, including a public web form linked from party social media channels, referral links shared by existing volunteers, QR code registration at party events, and direct data entry by ward coordinators. Each prospective volunteer completes a profile capturing their contact information, skills inventory (languages spoken, technical capabilities, vehicle ownership), availability schedule, and preferred assignment type (canvassing, election observation, logistics support, digital advocacy). The system automatically assigns each recruit to the appropriate ward based on their residential address and routes them into the onboarding pipeline."),
  h3("5.6.3 Training and Certification"),
  body("The VMS includes a lightweight learning management system (LMS) that delivers standardised training content through the mobile application. Training modules cover party manifesto and key messages, voter engagement techniques, data collection protocols, safety and security procedures, and election observation methodologies. Each module concludes with a brief assessment quiz, and volunteers must achieve a minimum passing score to be certified for field deployment. The LMS tracks completion status, assessment scores, and certification expiry dates, generating automated reminders for refresher training when required. Training completion rates by ward and LGA are displayed on the analytics dashboard, enabling the field operations team to identify and address training gaps proactively."),
  h3("5.6.4 Scheduling and Task Assignment"),
  makeTable(
    ["Feature", "Description", "Benefit"],
    [
      ["Smart Scheduling", "Assign volunteers to tasks based on skills, location, availability, and historical performance", "Optimal volunteer-task matching"],
      ["Shift Management", "Define shift patterns for election day and early voting; manage check-in/check-out", "Full coverage with no gaps"],
      ["Performance Scoring", "Track tasks completed, attendance, data quality, and response time; compute performance index", "Identify and reward top performers"],
      ["Gamification", "Award badges, points, and leaderboard rankings for milestones (100 visits, 50 surveys, etc.)", "Increase motivation and retention"],
      ["Alert Assignment", "Auto-assign nearby volunteers to incident response tasks based on GPS proximity", "Rapid incident response"],
      ["Availability Calendar", "Volunteers set their availability; system prevents over-scheduling and burnout", "Sustainable volunteer engagement"],
    ]
  ),
  tableCaption("Table 9: Volunteer Management — Scheduling and Task Features"),

  // ── 5.7 Financial Tracking & Resource Management ──
  h2("5.7 Financial Tracking and Resource Management"),
  h3("5.7.1 Module Overview"),
  body("The Financial Tracking and Resource Management module provides comprehensive budget planning, expenditure tracking, and inventory management capabilities that bring full financial transparency to the campaign operation. This module addresses the critical need for accountability in campaign finance management, enabling the campaign director and party leadership to monitor every naira spent in real time, compare actual expenditure against budgeted amounts, and generate auditable financial reports for donor stewardship and regulatory compliance. The module integrates budget management, expense approval workflows, procurement tracking, inventory management, and financial reporting into a single, unified interface."),
  h3("5.7.2 Budget Management"),
  body("The budget management component supports hierarchical budget structures that mirror the campaign's organisational hierarchy. The state campaign director establishes a master budget with category-level allocations (personnel, technology, logistics, communications, materials, contingency), and deputy directors can create sub-budgets within their functional areas with further line-item detail. Each budget line has an assigned owner, a spending period, and configurable approval thresholds. When a budget line approaches its allocated amount, the system generates automatic alerts to the budget owner and the campaign director, enabling proactive financial management before overruns occur."),
  h3("5.7.3 Expense Management Workflow"),
  makeTable(
    ["Workflow Stage", "Description", "Automation"],
    [
      ["Expense Submission", "Staff submit expenses with category, amount, receipt photo, and project code via mobile or web", "Auto-categorisation by project code"],
      ["Approval Routing", "Expenses routed to appropriate approver based on amount and category; multi-level for large amounts", "Threshold-based routing rules"],
      ["Receipt Verification", "Finance team verifies receipt photos against submitted amounts; flag discrepancies", "OCR-based amount extraction"],
      ["Payment Processing", "Approved expenses queued for payment; track payment status and method", "Payment scheduling for batch processing"],
      ["Budget Impact Update", "Approved expenses immediately reflected in budget utilisation dashboards", "Real-time budget recalculation"],
      ["Audit Trail", "Every expense action logged with timestamp, user, and previous values for full traceability", "Immutable audit log"],
    ]
  ),
  tableCaption("Table 10: Expense Management Workflow"),
  h3("5.7.4 Inventory and Material Tracking"),
  body("The inventory management component tracks all campaign materials from procurement through distribution to end-point consumption or return. Materials are categorised into print materials (posters, flyers, banners), branded merchandise (t-shirts, caps, face caps), office supplies, and technological equipment (mobile devices, accessories, power banks). Each item category has configurable tracking fields including unit cost, current stock level, minimum reorder threshold, and storage location. The distribution tracking feature records every material dispatch from the state warehouse to LGA and ward-level destinations, with delivery confirmation captured through the field coordinator's mobile application."),
  body("Real-time inventory dashboards show current stock levels against planned distribution targets, highlighting potential shortages before they impact field operations. The system generates automated purchase orders when stock levels fall below minimum thresholds, and tracks purchase orders through receipt, quality check, and warehouse entry. End-of-campaign inventory reconciliation identifies surplus materials for return, reuse, or donation, and calculates actual material cost per voter contacted for efficiency analysis."),

  // ── 5.8 Security, Compliance & Data Governance ──
  h2("5.8 Security, Compliance, and Data Governance"),
  h3("5.8.1 Module Overview"),
  body("The Security, Compliance, and Data Governance module provides the protective framework that ensures all platform operations meet the highest standards of data protection, access control, and regulatory compliance. Given the sensitive nature of voter data and the potential consequences of data breaches, including legal liability, reputational damage, and electoral disadvantage, this module is not an optional add-on but a foundational requirement that underpins every other platform module. The module implements defence-in-depth security across four domains: identity and access management, data protection, application security, and compliance monitoring."),
  h3("5.8.2 Role-Based Access Control (RBAC)"),
  makeTable(
    ["Role", "Voter Data Access", "Financial Data", "Incident Reports", "System Admin"],
    [
      ["Campaign Director", "Full read", "Full read/write", "Full read/write", "Full"],
      ["Deputy Director (Data)", "Full read/write", "Read only", "Full read", "Module config"],
      ["Deputy Director (Field)", "Assigned LGA read/write", "None", "Full read/write", "None"],
      ["Deputy Director (Comms)", "Segment read (no PII)", "None", "Summary read", "Template mgmt"],
      ["Zonal Coordinator", "Assigned LGA read only", "None", "Assigned LGA read/write", "None"],
      ["Ward Coordinator", "Assigned ward read only", "None", "Assigned ward create/read", "None"],
      ["Election Observer", "None (no voter data)", "None", "Assigned PU create only", "None"],
      ["IT Administrator", "Infrastructure access only", "System audit logs", "System audit logs", "Full"],
    ]
  ),
  tableCaption("Table 11: Role-Based Access Control Matrix"),
  h3("5.8.3 Data Protection Measures"),
  body("All voter personally identifiable information (PII), including names, phone numbers, and addresses, is encrypted at rest using AES-256 encryption and in transit using TLS 1.3. Database-level encryption ensures that even if the physical storage medium is compromised, the data remains unreadable without the encryption keys, which are managed through a dedicated key management service with automatic key rotation every ninety days. Field-level encryption applies additional protection to the most sensitive data elements, ensuring that even database administrators with direct data access cannot read voter PII without explicit authorisation through the access control system."),
  body("Data retention policies automatically purge or anonymise voter interaction data after configurable retention periods, ensuring compliance with potential future data protection regulations. The system implements data masking for display purposes, showing only the last four digits of phone numbers and partial addresses in user interface views unless the user has been granted explicit PII access through their role assignment. Export functions that include voter PII require additional multi-factor authentication confirmation and are logged in the audit trail with the exporting user's identity, timestamp, and the data scope of the export."),
  h3("5.8.4 Audit Logging and Compliance Monitoring"),
  body("Every user action within the platform is recorded in an immutable audit log that captures the user identity, action type, data scope affected, timestamp, IP address, and device identifier. The audit log is stored in a separate, write-once database that cannot be modified or deleted by any user, including system administrators. Automated compliance monitoring rules continuously scan the audit log for suspicious patterns, such as bulk data exports, access to voter records outside the user's assigned area, or repeated failed authentication attempts, generating real-time alerts to the security team for investigation."),
  body("The compliance dashboard provides the IT administrator and campaign director with a consolidated view of the platform's security posture, including active user sessions, failed login attempts, data access patterns, encryption key status, and certificate expiry dates. Weekly automated security reports summarise compliance status against the defined security baseline, highlighting any deviations that require remediation. All staff are required to complete mandatory security awareness training before receiving platform access credentials, with annual refresher training enforced through the learning management system."),

  // ═══════════════════════════════════════════════════════════════
  // 6. UI/UX DESIGN FRAMEWORK
  // ═══════════════════════════════════════════════════════════════
  h1("6. UI/UX Design Framework"),
  h2("6.1 Design Philosophy and Principles"),
  body("The platform's user interface and user experience design follows a set of core principles that prioritise usability, accessibility, and efficiency for a diverse user base spanning from technically proficient data analysts at the state headquarters to first-time smartphone users serving as ward coordinators in rural communities. The design philosophy centres on three guiding tenets: Clarity Over Complexity, which mandates that every screen presents only the information necessary for the user's current task and removes all unnecessary visual elements; Progressive Disclosure, which reveals advanced features and detailed data only when explicitly requested, keeping the default interface clean and unintimidating; and Error Prevention Over Error Correction, which designs forms and workflows to prevent user mistakes through input validation, sensible defaults, and confirmation prompts for irreversible actions."),
  body("The visual design language draws inspiration from modern enterprise SaaS applications while incorporating the APC brand identity through a carefully managed colour palette. The primary interface uses a neutral background with the APC green as an accent colour for interactive elements, buttons, and positive indicators. The deep graphite tone serves as the primary text colour for maximum readability, while the warm terracotta accent is reserved for alerts, warnings, and attention-drawing elements. Typography uses a two-font system: a humanist sans-serif for interface labels and body text, chosen for its excellent readability at small sizes on screens, and a tabular-numeral variant for data tables and numerical displays to ensure consistent digit alignment."),
  h2("6.2 User Personas and Journey Maps"),
  body("The platform serves five primary user personas, each with distinct needs, technical proficiency levels, and usage contexts. Understanding these personas is essential for designing interfaces that serve the full spectrum of users effectively."),
  makeTable(
    ["Persona", "Profile", "Primary Device", "Key Needs"],
    [
      ["Campaign Director", "Senior party leader, 50+, limited tech fluency, strategic focus", "Desktop (situation room)", "High-level KPI dashboard, alert summaries, drill-down capability"],
      ["Data Analyst", "Young graduate, tech-savvy, detail-oriented", "Desktop (office)", "Advanced filtering, data export, complex queries, report builder"],
      ["Zonal Coordinator", "Mid-level party operative, moderate tech skill, manages 10-20 wards", "Mobile + tablet", "LGA overview, ward comparison, message broadcasting, task management"],
      ["Ward Coordinator", "Community leader, variable tech skill, field-focused", "Mobile (Android)", "Simple task list, voter search, visit logger, incident reporter"],
      ["Election Observer", "Volunteer, variable tech skill, high-stress election day context", "Mobile (Android)", "One-tap check-in, structured report forms, emergency alert button"],
    ]
  ),
  tableCaption("Table 12: User Persona Definitions"),
  body("Journey Map Example - Ward Coordinator Daily Workflow: The ward coordinator begins their day by opening the mobile app and reviewing the Home screen, which displays today's task list (typically 8-12 voter visits, 1-2 survey assignments), pending messages from the zonal coordinator, and a summary of yesterday's completed activities. They tap the first task to view the assigned voter's profile, including name, address, issue preferences, and previous interaction notes. After conducting the visit, they open the visit logger form, complete the structured fields (contact made, issues discussed, voter sentiment, follow-up needed), and submit. The app caches the submission locally and syncs when connectivity is available. Throughout the day, they receive push notifications for new tasks, messages, and any incident alerts in their area."),
  h2("6.3 Information Architecture and Navigation"),
  body("The web dashboard uses a left sidebar navigation pattern that provides persistent access to all primary modules. The sidebar is organised into four groups: Command Centre (Dashboard, Map View, Alerts), Operations (Voters, Field Coordination, Volunteers, Election Monitoring), Management (Communications, Finance, Inventory, Reports), and Administration (Users, Roles, Settings, Audit Log). Each navigation item expands to reveal its sub-pages when clicked, and the currently active page is highlighted with the accent colour. A global search bar at the top of the sidebar allows users to quickly navigate to any voter record, incident report, or task by ID or keyword."),
  body("The mobile application uses a bottom tab bar with five primary destinations: Home, Voters, Report, Messages, and Profile. The Home tab serves as a personalised command centre showing today's agenda, quick action buttons, and a summary feed of recent activity. Context-specific navigation within each tab uses a top bar with a back button, title, and contextual action buttons. The navigation architecture ensures that no critical function is more than three taps away from any starting screen, minimising the time users spend navigating and maximising the time they spend on productive activities."),
  h2("6.4 Interaction Patterns and Micro-interactions"),
  body("The platform employs a consistent set of interaction patterns across all interfaces to reduce learning curves and build user confidence. Form submissions display a brief success animation (a checkmark with a subtle colour pulse) before returning the user to the relevant list view. Error states use inline validation messages that appear below the relevant field in red text, with specific guidance on how to correct the error. Loading states use skeleton screens that mimic the layout of the expected content, providing visual continuity and reducing perceived wait times. Pull-to-refresh gestures on list views trigger data synchronisation with a visual progress indicator."),
  body("Data visualisation interactions include hover tooltips on chart elements showing exact values and comparisons, click-to-filter on dashboard widgets that cross-filter all other widgets on the page, and pinch-to-zoom on the geospatial map view with smooth animation transitions between zoom levels. The incident alert system uses a progressive disclosure pattern: initial notification shows severity level, location, and category; tapping the notification reveals a summary with key details; and a 'View Full Report' action navigates to the complete incident record with all supporting evidence and response actions."),
  h2("6.5 Responsive and Adaptive Design Strategy"),
  body("The web dashboard is designed with a responsive grid layout that adapts seamlessly across desktop (1280px+), laptop (1024px), and tablet (768px) screen widths. On desktop, the dashboard presents a multi-column widget grid with the sidebar navigation always visible. On tablet, the sidebar collapses to an icon-only mode by default, expanding to full labels on tap, and the widget grid reflows to a two-column layout. The dashboard does not support phone-width screens on the web interface, as phone users are directed to the dedicated mobile application which provides an optimised experience for smaller screens."),
  body("The mobile application targets Android devices running version 8.0 or higher, covering over ninety-five percent of the Nigerian Android smartphone market. The interface is designed for screens ranging from 5.5 to 6.8 inches, with layouts that flex to accommodate different aspect ratios and screen densities. Touch targets are sized at a minimum of 48x48 pixels with 8-pixel padding, exceeding the Material Design accessibility guidelines. The app supports both light and dark modes, with automatic switching based on the device's system setting, and includes a high-contrast mode for outdoor visibility in bright sunlight conditions."),
  h2("6.6 Accessibility and Inclusive Design"),
  body("The platform is designed to meet WCAG 2.1 Level AA accessibility standards, ensuring that users with disabilities can effectively use all critical functions. Text sizing supports dynamic scaling up to 200 percent without layout breakage. All interactive elements have visible focus indicators for keyboard navigation, and all form inputs have associated labels and descriptive error messages. Colour is never used as the sole means of conveying information; status indicators always include text labels or icons in addition to colour coding. Screen reader compatibility is verified for the web dashboard using NVDA and JAWS, and for the mobile application using TalkBack (Android)."),
  body("The inclusive design approach also considers the specific context of use in Nigerian campaign environments. Interface text is written in clear, concise language at an 8th-grade reading level to maximise comprehension across all educational backgrounds. Nigerian English conventions are used throughout, including local terminology for political and administrative divisions (ward, LGA, senatorial district). Where possible, the interface supports Nigerian Pidgin English as an alternative language option for field-facing screens, recognising that Pidgin serves as a lingua franca across ethnic and linguistic groups in many Nigerian communities."),

  // ═══════════════════════════════════════════════════════════════
  // 7. PHYSICAL OFFICE INFRASTRUCTURE
  // ═══════════════════════════════════════════════════════════════
  h1("7. Physical Office Infrastructure"),
  h2("7.1 Office Layout and Space Requirements"),
  body("The state campaign office requires a physical location that serves as the central hub for all campaign operations. The recommended minimum floor space is 350 square metres, located in a secure, accessible area with reliable power supply and internet connectivity. The office layout is designed to support the functional needs of each organisational unit while facilitating collaboration and information flow. The following table details the space allocation and requirements for each functional area."),
  makeTable(
    ["Area", "Space (sqm)", "Purpose", "Key Equipment"],
    [
      ["Situation Room", "40", "Real-time monitoring, strategic planning, media briefings", "4x 55-inch displays, video conferencing, 12 seats"],
      ["Open-Plan Workstations", "80", "Data analysts, communication officers, field ops staff", "20 workstations, dual monitors, headsets"],
      ["Server Room", "15", "On-premises computing, data backup, network infrastructure", "Rack servers, UPS, cooling, fire suppression"],
      ["Training Room", "35", "Coordinator onboarding, skills development, workshops", "Projector, 30 seats, whiteboard, PA system"],
      ["Director's Office", "20", "Campaign Director and Deputy Directors", "4 private offices, meeting table, secure cabinet"],
      ["Reception and Visitor Area", "25", "Stakeholder engagement, visitor management, security screening", "Reception desk, waiting area, display screens"],
      ["Break Room", "20", "Staff rest, informal meetings, meals", "Kitchenette, seating, vending machines"],
      ["Secure Storage", "15", "Sensitive documents, equipment storage, material staging", "Lockable shelving, climate control"],
      ["Corridors and Common", "100", "Circulation, display areas, emergency exits", "Party branding, emergency signage"],
    ]
  ),
  tableCaption("Table 13: Office Space Allocation"),
  h2("7.2 Power and Connectivity Infrastructure"),
  body("Reliable power supply is critical for continuous campaign operations, particularly during peak periods and on election day when even brief power interruptions can disrupt monitoring and communication capabilities. The recommended power configuration consists of three tiers: a 20KVA diesel generator for extended outages and peak load periods, a 10KVA solar inverter system with battery bank for daytime operations and brief outages, and a 3KVA online UPS system protecting sensitive computing equipment from power fluctuations and providing seamless switchover during power source transitions. This three-tier approach ensures that the situation room, server room, and critical workstations maintain uninterrupted power supply under all but the most extreme circumstances."),
  body("Internet connectivity follows a similarly redundant approach. The primary connection is a dedicated fibre optic link providing minimum 100 Mbps symmetric bandwidth, supplemented by a 4G/5G router with failover capability for automatic switching when the fibre connection is disrupted. A dedicated VSAT satellite connection provides a third fallback option for election day operations, ensuring that the office maintains external connectivity even in the event of widespread terrestrial network failures. All connections route through a enterprise-grade firewall with VPN capability for secure remote access by authorised personnel."),

  // ═══════════════════════════════════════════════════════════════
  // 8. ORGANISATIONAL STRUCTURE & STAFFING
  // ═══════════════════════════════════════════════════════════════
  h1("8. Organisational Structure and Staffing"),
  h2("8.1 Organisational Hierarchy"),
  body("The campaign office operates under a clear organisational hierarchy designed to ensure rapid decision-making and accountability at every level. At the apex, the State Campaign Director reports directly to the State Chairman and is responsible for overall strategic direction and resource allocation. Below the Director, five functional units each led by a Deputy Director: the Data and Analytics Unit manages the voter database, produces intelligence reports, and maintains the analytics platform; the Field Operations Unit oversees all ward and local government coordinators, manages volunteer deployment, and coordinates grassroots activities; the Communications Unit handles media relations, message development, social media management, and internal communications; the Logistics and Administration Unit manages procurement, venue coordination, material distribution, and office operations; and the newly established Finance and Compliance Unit manages budget tracking, expense processing, financial reporting, and regulatory compliance."),
  makeTable(
    ["Role", "Reporting Line", "Key Responsibilities", "Direct Reports"],
    [
      ["State Campaign Director", "State Chairman", "Strategic direction, resource allocation, stakeholder management, final decisions", "5 Deputy Directors"],
      ["DD (Data & Analytics)", "Campaign Director", "Voter database, analytics, intelligence reporting, data quality", "4 Data Analysts"],
      ["DD (Field Operations)", "Campaign Director", "Ward coordinators, volunteers, grassroots activities, election monitoring", "5 Field Ops Staff"],
      ["DD (Communications)", "Campaign Director", "Media, messaging, social media, internal comms, content creation", "3 Comms Officers"],
      ["DD (Logistics)", "Campaign Director", "Procurement, distribution, office management, venue coordination", "4 Logistics Staff"],
      ["DD (Finance & Compliance)", "Campaign Director", "Budget tracking, expenses, financial reporting, audit coordination", "2 Finance Officers"],
      ["Zonal Coordinators (LGA)", "DD (Field Ops)", "LGA-level coordination, report compilation, ward supervision", "Ward Coordinators"],
      ["Ward Coordinators", "Zonal Coordinator", "Polling unit operations, volunteer supervision, daily reporting", "Field Volunteers"],
    ]
  ),
  tableCaption("Table 14: Campaign Office Organisational Structure"),
  h2("8.2 RACI Matrix for Key Processes"),
  body("To ensure clear accountability and avoid duplication of effort, the following RACI (Responsible, Accountable, Consulted, Informed) matrix defines roles for critical campaign processes. R indicates the role responsible for executing the work, A indicates the role accountable for the outcome, C indicates roles that must be consulted, and I indicates roles that must be kept informed."),
  makeTable(
    ["Process", "Campaign Director", "DD Data", "DD Field", "DD Comms", "DD Finance"],
    [
      ["Voter data strategy", "A", "R", "C", "I", "I"],
      ["Field operations planning", "A", "C", "R", "I", "I"],
      ["Campaign messaging", "A", "C", "C", "R", "I"],
      ["Budget approval", "A", "I", "I", "I", "R"],
      ["Incident response (critical)", "A", "I", "R", "C", "I"],
      ["Election day operations", "A", "C", "R", "C", "I"],
      ["Media relations", "A", "I", "C", "R", "I"],
      ["Donor reporting", "A", "I", "I", "I", "R"],
    ]
  ),
  tableCaption("Table 15: RACI Matrix for Key Campaign Processes"),

  // ═══════════════════════════════════════════════════════════════
  // 9. IMPLEMENTATION ROADMAP
  // ═══════════════════════════════════════════════════════════════
  h1("9. Implementation Roadmap and Milestones"),
  body("The implementation follows a structured twelve-week phased approach that balances the urgency of campaign preparation with the need for thorough testing, training, and quality assurance. Each phase builds on the deliverables of the previous phase, creating a cumulative progression toward full operational capability. The roadmap is designed with built-in review gates at each phase transition, allowing the campaign leadership to assess progress and approve advancement to the next phase."),
  h2("9.1 Phase 1: Foundation (Weeks 1-3)"),
  body("The foundation phase focuses on establishing the physical and digital infrastructure required for campaign operations. Key activities during this phase include securing and preparing the office location, procuring and installing computing and networking equipment, deploying the core technology platform components (Voter Intelligence Database, basic Analytics Dashboard), and initiating the voter data consolidation process. The data team will begin by collecting existing voter records from all local government areas, standardising data formats, and loading records into the central database. Simultaneously, the logistics team will establish vendor relationships for campaign materials and begin procurement of essential supplies. The security module will be configured with initial role definitions, user accounts for core staff, and encryption key management. By the end of Week 3, the office should be physically operational with basic technology infrastructure in place and at least 50 percent of available voter data loaded into the system."),
  h2("9.2 Phase 2: Activation (Weeks 4-7)"),
  body("The activation phase shifts focus to staffing, training, and system integration. Recruitment of core office staff and zonal coordinators will be completed during Weeks 4 and 5, followed by an intensive two-week training programme covering platform usage, data collection protocols, communication procedures, and security awareness. The Field Coordination Mobile Application will be deployed to all zonal and ward coordinators, with hands-on training sessions conducted at the state office and through regional workshops. The Communication Hub, Volunteer Management System, and Financial Tracking Module will be deployed and configured. During this phase, the communications unit will establish media relationships, develop the initial campaign messaging framework, and set up social media channels. The analytics dashboard will be populated with initial data and made available to the campaign director and deputy directors for review and feedback."),
  h2("9.3 Phase 3: Scale-Up (Weeks 8-10)"),
  body("The scale-up phase extends the campaign's reach to all local government areas and ward levels. Ward coordinators will be recruited, trained, and equipped with mobile devices and campaign materials. The volunteer recruitment drive will be launched through the VMS, targeting 5,000 registered volunteers within three weeks. The field operations team will conduct systematic voter outreach using the routes and schedules generated by the platform's route optimisation feature. Real-time monitoring dashboards will be activated, and daily reporting routines will be established across all zones. The Election Monitoring System will be configured with incident taxonomies, escalation rules, and observer assignments. The communications unit will begin targeted messaging campaigns based on voter segmentation data, and the logistics team will execute the first round of campaign material distribution to all polling units."),
  h2("9.4 Phase 4: Operational Excellence (Weeks 11-12)"),
  body("The final phase focuses on stress-testing all systems, refining processes based on operational experience, and preparing for peak campaign intensity. Full-scale simulation exercises will test the election monitoring system, incident response protocols, and communication chains under realistic conditions. The financial module will undergo end-to-end testing of expense workflows from submission through approval to payment. The volunteer management system will conduct a mock mobilisation exercise to validate scheduling, task assignment, and performance tracking capabilities. Any identified gaps or weaknesses will be addressed through targeted interventions. Contingency plans will be finalised for scenarios including technology failure, security incidents, and last-minute regulatory changes. The campaign office will reach full operational capability by the end of Week 12."),
  makeTable(
    ["Phase", "Timeline", "Modules Deployed", "Key Milestones", "Deliverables"],
    [
      ["Foundation", "Weeks 1-3", "VID, Basic Dashboard, Security", "Office operational, 50% voter data loaded, core team hired", "Operational office, database v1, vendor contracts"],
      ["Activation", "Weeks 4-7", "Field App, Comms Hub, VMS, Finance", "Staff trained, mobile app deployed, messaging active", "Trained workforce, functional dashboard, media plan"],
      ["Scale-Up", "Weeks 8-10", "Election Monitoring, full Analytics", "Ward-level coverage, 5,000 volunteers, monitoring active", "Full field coverage, messaging campaigns active"],
      ["Operational Excellence", "Weeks 11-12", "All modules stress-tested", "Simulation exercises complete, all systems validated", "Contingency plans, full operational readiness"],
    ]
  ),
  tableCaption("Table 16: Implementation Roadmap with Module Deployment Timeline"),

  // ═══════════════════════════════════════════════════════════════
  // 10. RESOURCE REQUIREMENTS AND BUDGET
  // ═══════════════════════════════════════════════════════════════
  h1("10. Resource Requirements and Budget"),
  h2("10.1 Personnel Requirements"),
  body("The campaign office requires a dedicated team of professionals and political operatives to function effectively. The core team based at the state office will consist of approximately twenty-eight full-time staff, supplemented by a network of zonal and ward coordinators across all local government areas."),
  makeTable(
    ["Category", "Headcount", "Duration", "Estimated Cost (N)"],
    [
      ["State Campaign Director", "1", "6 months", "【Please fill in】"],
      ["Deputy Directors (5 units)", "5", "6 months", "【Please fill in】"],
      ["Data Analysts", "4", "6 months", "【Please fill in】"],
      ["Communication Officers", "3", "6 months", "【Please fill in】"],
      ["Field Operations Staff", "5", "6 months", "【Please fill in】"],
      ["Logistics & Admin Staff", "4", "6 months", "【Please fill in】"],
      ["Finance Officers", "2", "6 months", "【Please fill in】"],
      ["IT Support", "2", "6 months", "【Please fill in】"],
      ["Zonal Coordinators (LGA)", "【Please fill in】", "4 months", "【Please fill in】"],
      ["Ward Coordinators", "【Please fill in】", "3 months", "【Please fill in】"],
      ["Election Day Observers", "【Please fill in】", "1 week", "【Please fill in】"],
    ]
  ),
  tableCaption("Table 17: Personnel Requirements and Cost Estimates"),
  h2("10.2 Technology and Infrastructure Budget"),
  makeTable(
    ["Item", "Description", "Estimated Cost (N)"],
    [
      ["Platform Development", "8 modules: VID, Dashboard, Field App, Monitoring, Comms Hub, VMS, Finance, Security", "【Please fill in】"],
      ["Cloud Hosting (6 months)", "Scalable servers, databases, Elasticsearch, Redis, CDN, SSL certificates", "【Please fill in】"],
      ["Office Equipment", "24 workstations, 4 large-format displays, printers, networking gear, projector", "【Please fill in】"],
      ["Power Infrastructure", "20KVA generator, 10KVA solar inverter, 3KVA UPS systems, battery bank", "【Please fill in】"],
      ["Mobile Devices", "200 smartphones for coordinators, 20 tablets for zonal coordinators, accessories", "【Please fill in】"],
      ["Internet Connectivity", "Fibre (100Mbps), 4G/5G failover router, VSAT satellite (election day)", "【Please fill in】"],
      ["Office Setup", "Furniture, fixtures, security systems, branding, air conditioning", "【Please fill in】"],
      ["Software Licenses", "Productivity suite, CRM, analytics, project management tools", "【Please fill in】"],
      ["Security Infrastructure", "Firewall, VPN, encryption key management, penetration testing", "【Please fill in】"],
    ]
  ),
  tableCaption("Table 18: Technology and Infrastructure Budget"),
  h2("10.3 Operational and Contingency Budget"),
  body("Beyond technology and personnel, the campaign office requires operational funding for day-to-day activities including transportation for field coordinators, venue hire for training events and stakeholder meetings, printing and production of campaign materials, utility bills and consumables, and security provisions. A detailed line-item operational budget will be developed during Phase 1 based on actual local costs and the specific requirements of the state. A contingency reserve of fifteen percent of the total budget is recommended to address unforeseen expenses, emergency situations, and strategic opportunities that may arise during the campaign period. This reserve provides the flexibility needed to respond to a dynamic electoral environment without delaying critical operational activities due to budget constraints."),
  makeTable(
    ["Category", "Description", "Estimated Cost (N)"],
    [
      ["Transportation", "Fuel, vehicle hire, maintenance for field operations", "【Please fill in】"],
      ["Training and Events", "Venue hire, catering, training materials, stakeholder meetings", "【Please fill in】"],
      ["Campaign Materials", "Posters, flyers, banners, branded merchandise, print production", "【Please fill in】"],
      ["Utilities and Consumables", "Power, internet, water, office supplies, printing costs", "【Please fill in】"],
      ["Security", "Physical security personnel, CCTV, access control systems", "【Please fill in】"],
      ["Contingency Reserve", "15% of total budget for unforeseen expenses", "【Please fill in】"],
    ]
  ),
  tableCaption("Table 19: Operational and Contingency Budget"),

  // ═══════════════════════════════════════════════════════════════
  // 11. RISK ANALYSIS & MITIGATION
  // ═══════════════════════════════════════════════════════════════
  h1("11. Risk Analysis and Mitigation"),
  body("A comprehensive risk assessment has been conducted to identify potential threats to the successful implementation and operation of the campaign office. Each risk has been evaluated based on its likelihood of occurrence and potential impact on campaign objectives, with corresponding mitigation strategies designed to reduce either the probability or the consequence of each risk to an acceptable level."),
  makeTable(
    ["Risk", "Likelihood", "Impact", "Mitigation Strategy"],
    [
      ["Data Breach / Information Leak", "Medium", "Critical", "End-to-end encryption, RBAC, security audits, NDAs, audit logging"],
      ["Technology Platform Failure", "Low", "High", "Redundant cloud hosting, offline-capable mobile app, automated backups"],
      ["Staff Attrition", "Medium", "Medium", "Competitive compensation, clear career path, knowledge documentation"],
      ["Regulatory / Legal Challenges", "Low", "High", "Legal compliance review, INEC guidelines adherence, documentation"],
      ["Insufficient Funding", "Medium", "High", "Phased implementation, prioritised spending, donor engagement"],
      ["Opposition Disruption", "Medium", "Medium", "Physical security, counter-intelligence monitoring, legal support"],
      ["Community Resistance", "Low", "Medium", "Stakeholder engagement, community liaison officers, cultural sensitivity"],
      ["Power / Connectivity Outages", "High", "Medium", "Generator + solar + UPS backup, offline-first architecture, 4G/VSAT fallback"],
      ["Insufficient Volunteer Recruitment", "Medium", "Medium", "Early recruitment drive, gamification incentives, community partnerships"],
      ["Low User Adoption of Technology", "Medium", "High", "Intensive training, intuitive UI design, on-site support, champions program"],
      ["Data Quality Issues", "High", "Medium", "Automated validation, deduplication algorithms, quality dashboards, cleanup sprints"],
      ["Vendor / Supplier Failure", "Low", "Medium", "Multiple vendor options, contractual SLAs, pre-qualified supplier list"],
    ]
  ),
  tableCaption("Table 20: Comprehensive Risk Assessment Matrix"),
  body("The risk management approach follows a continuous monitoring model, with weekly risk reviews conducted by the campaign director and deputy directors. Emerging risks are documented, assessed, and assigned to responsible owners with clear mitigation actions and deadlines. The contingency budget provides financial resources for rapid response to any risk event that exceeds planned mitigation capacity. Additionally, the platform's monitoring capabilities serve an early warning function, detecting anomalies in field reporting patterns, data quality, or system performance that may indicate emerging risks before they materialise into actual incidents."),

  // ═══════════════════════════════════════════════════════════════
  // 12. EXPECTED BENEFITS & EVALUATION
  // ═══════════════════════════════════════════════════════════════
  h1("12. Expected Benefits and Evaluation"),
  h2("12.1 Quantifiable Benefits"),
  body("The proposed campaign office solution is expected to deliver measurable improvements across multiple dimensions of campaign performance. The following table presents the projected benefits with their associated measurement methodologies and timelines for realisation. These projections are based on benchmarks from comparable political campaign operations in Nigeria and other African democracies that have adopted similar technology-enabled approaches."),
  makeTable(
    ["Benefit Area", "Current State", "Projected Improvement", "Measurement Method"],
    [
      ["Voter Data Coverage", "Estimated 30-40% digitised", "90% digitised within 8 weeks", "Database record count vs. INEC voter register"],
      ["Field Report Speed", "24-48 hours average", "Under 15 minutes (real-time)", "Platform timestamp analysis"],
      ["Voter Outreach Coverage", "Estimated 25% of registered voters", "70% of registered voters", "Canvassing logs and interaction records"],
      ["Volunteer Mobilisation", "Ad-hoc, undocumented", "5,000+ registered, 80% retention", "VMS metrics and performance scores"],
      ["Incident Response", "Hours to days", "Under 30 minutes for critical issues", "Incident reporting system timestamps"],
      ["Material Distribution", "30-40% wastage estimated", "Under 15% wastage", "Inventory tracking and audit reports"],
      ["Financial Transparency", "Manual ledgers, opaque", "100% digital tracking, real-time visibility", "Financial module audit reports"],
      ["Communication Reach", "Unmeasured", "Trackable delivery to target segments", "Communication Hub analytics"],
    ]
  ),
  tableCaption("Table 21: Projected Campaign Performance Improvements"),
  h2("12.2 Long-Term Strategic Value"),
  body("Beyond the immediate electoral cycle, the campaign office infrastructure represents a significant long-term investment in the party's organisational capacity. The voter database, communication networks, and trained personnel will persist as party assets that can be leveraged for governance engagement between elections, membership recruitment and retention, policy consultation with party supporters, and rapid mobilisation for future electoral contests including local government, state, and national elections. The technology platform can be adapted for non-electoral functions such as community development project monitoring, constituency service delivery tracking, and party membership management, providing ongoing value that extends well beyond any single election cycle."),
  body("The accumulated data across multiple election cycles creates an increasingly valuable strategic asset. Historical voter engagement data, combined with election results, enables progressively more accurate predictive models that can identify shifting voter dynamics, emerging opposition strengths, and untapped mobilisation opportunities years before the next election. This data-driven approach to party building transforms the APC from a campaign-dependent organisation into a permanently data-enabled political institution."),
  h2("12.3 Evaluation Framework"),
  makeTable(
    ["Evaluation Activity", "Frequency", "Participants", "Outputs"],
    [
      ["Operational Review", "Weekly", "Deputy Directors", "Action items, status updates, risk register updates"],
      ["Strategic Review", "Bi-weekly", "Campaign Director + DDs", "Strategy adjustments, resource reallocation decisions"],
      ["Performance Report", "Monthly", "Campaign Director → State Chairman", "KPI dashboard, variance analysis, recommendations"],
      ["Data Quality Audit", "Monthly", "DD (Data) + IT", "Data completeness scores, deduplication reports"],
      ["User Satisfaction Survey", "Monthly", "All platform users", "Usability scores, feature requests, adoption metrics"],
      ["Security Audit", "Quarterly", "IT Admin + external auditor", "Vulnerability assessment, penetration test results"],
      ["Post-Election Assessment", "Once (post-election)", "Full team + party leadership", "Lessons learned, recommendations, data archive"],
    ]
  ),
  tableCaption("Table 22: Evaluation Framework Schedule"),
  body("The evaluation framework also incorporates a lessons-learned process that captures operational insights throughout the campaign for incorporation into future campaign planning. This institutional knowledge management approach ensures that the party builds cumulative expertise in campaign operations, avoiding the common pattern where valuable field experience is lost when temporary campaign structures are dismantled after each election cycle. The result is a permanently stronger party organisation that improves its campaign capabilities with each successive electoral contest."),
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
    // SECTION 1: COVER
    {
      properties: {
        page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } },
      },
      children: [buildCoverR1({
        title: "APC State Campaign Office Solution",
        subtitle: "A Comprehensive Proposal for Modern Campaign Infrastructure",
        englishLabel: "STRATEGIC PROPOSAL",
        metaLines: [
          "All Progressives Congress (APC)",
          "State Campaign Directorate",
          "Prepared: August 2026",
          "Classification: Party Confidential",
        ],
        footerLeft: "APC State Campaign Directorate",
        footerRight: "August 2026",
        palette: palette.cover,
      })],
    },
    // SECTION 2: TOC — Roman numerals
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: "upperRoman" } },
      },
      footers: { default: romanFooter() },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER, spacing: { before: 480, after: 360 },
          children: [new TextRun({ text: "Table of Contents", bold: true, size: 32, font: { ascii: "Times New Roman" }, color: c(palette.primary) })],
        }),
        new TableOfContents("Table of Contents", {
          hyperlink: true, headingStyleRange: "1-3",
        }),
        new Paragraph({
          spacing: { before: 200 },
          children: [new TextRun({
            text: "Note: This Table of Contents is generated via field codes. To ensure page number accuracy after editing, please right-click the TOC and select \"Update Field.\"",
            italics: true, size: 18, color: "888888", font: { ascii: "Calibri" },
          })],
        }),
        new Paragraph({ children: [new PageBreak()] }),
      ],
    },
    // SECTION 3: BODY — Arabic numerals
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: "decimal" } },
      },
      headers: { default: bodyHeader() },
      footers: { default: arabicFooter() },
      children: bodyContent,
    },
  ],
});

// ═══════════════════════════════════════════════════════════════
// GENERATE FILE
// ═══════════════════════════════════════════════════════════════

const OUTPUT = "/home/z/my-project/download/APC-State-Campaign-Office-Proposal.docx";
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUTPUT, buf);
  console.log("Document generated:", OUTPUT);
}).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
