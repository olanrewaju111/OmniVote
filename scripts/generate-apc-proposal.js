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

// Border helpers
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

// ═══════════════════════════════════════════════════════════════
// COVER: R1 Pure Paragraph Left with GO-1 palette
// ═══════════════════════════════════════════════════════════════

function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const charWidth = (pt) => pt * 11; // English chars ~0.55x CJK width
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  let titlePt = preferredPt;
  let lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) {
    const cpl = charsPerLine(minPt);
    lines = splitTitleLines(title, cpl);
    titlePt = minPt;
  }
  return { titlePt, titleLines: lines };
}

function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([' ', '-', '_', '/', '(', ')', ',']);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) {
        breakAt = i;
        break;
      }
    }
    if (breakAt === -1) {
      const limit = Math.min(remaining.length, Math.ceil(charsPerLine * 1.3));
      for (let i = charsPerLine + 1; i < limit; i++) {
        if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
      }
    }
    if (breakAt === -1) breakAt = charsPerLine;
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  if (lines.length > 1 && lines[lines.length - 1].length <= 3) {
    const last = lines.pop();
    lines[lines.length - 1] += ' ' + last;
  }
  return lines;
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
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));
  if (config.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
      children: [new TextRun({ text: config.englishLabel.split("").join("  "),
        size: 18, color: P.accent, font: { ascii: "Calibri" }, characterSpacing: 40 })],
    }));
  }
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true,
        color: P.titleColor, font: { ascii: "Times New Roman" } })],
    }));
  }
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL }, spacing: { after: 800 },
      children: [new TextRun({ text: config.subtitle, size: 24, color: P.subtitleColor,
        font: { ascii: "Calibri" } })],
    }));
  }
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: P.metaColor,
        font: { ascii: "Calibri" } })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));
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
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED, borders: allNoBorders,
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

// Table helper: Horizontal-Only style for business proposals
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

// ═══════════════════════════════════════════════════════════════
// PAGE NUMBER FOOTER
// ═══════════════════════════════════════════════════════════════

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
    children: [new TextRun({ text: "APC State Campaign Office Proposal", size: 18, color: "808080", font: { ascii: "Calibri" }, italics: true })],
  })] });
}

// ═══════════════════════════════════════════════════════════════
// DOCUMENT CONTENT
// ═══════════════════════════════════════════════════════════════

const bodyContent = [
  // ── 1. EXECUTIVE SUMMARY ──
  h1("1. Executive Summary"),
  body("This proposal presents a comprehensive solution for establishing a fully operational, technology-enabled APC State Campaign Office. The proposed framework addresses the critical need for a centralized command structure that integrates voter data management, real-time communication, field coordination, and election monitoring into a single, cohesive platform. In an era where political campaigns are increasingly won or lost on the strength of operational efficiency and data-driven decision-making, the APC must leverage modern campaign technology to maintain its competitive advantage across all senatorial districts and local government areas."),
  body("The solution centres on three interconnected pillars: a robust digital infrastructure that provides real-time analytics and voter intelligence, an organised field operations framework that empowers ward-level coordinators with mobile tools and standardised processes, and an integrated communication system that ensures seamless information flow between the state headquarters, zone coordinators, and grassroots volunteers. Together, these pillars create a campaign operation that is responsive, accountable, and capable of adapting to changing electoral dynamics throughout the campaign cycle."),
  body("The estimated total investment for the initial setup and first six months of operation is approximately 【RMB in words: Naira (lowercase: N)】 85 million, covering technology infrastructure, staffing, training, logistics, and contingency reserves. This investment is projected to yield measurable improvements in voter outreach coverage, volunteer mobilisation rates, incident response times, and overall electoral performance. The implementation roadmap spans twelve weeks from approval to full operational capability, with incremental milestones that allow the campaign leadership to assess progress and make data-informed adjustments at each phase."),

  // ── 2. CURRENT STATE & PROBLEM ANALYSIS ──
  h1("2. Current State and Problem Analysis"),
  h2("2.1 Existing Campaign Infrastructure"),
  body("The current state of APC state-level campaign operations across most Nigerian states relies heavily on informal organisational structures that have remained largely unchanged since the 2015 general elections. Field coordinators typically operate from personal residences or rented spaces that lack consistent power supply, internet connectivity, and basic office equipment. Communication between the state headquarters and ward-level units depends on personal mobile phone calls and WhatsApp groups, which, while effective for simple messaging, lack the structure, auditability, and scalability required for a modern campaign managing hundreds of thousands of voter interactions."),
  body("Voter data, where it exists at all, is typically stored in disconnected spreadsheets maintained by individual local government coordinators. There is no centralised voter database that provides a unified view of voter demographics, registration status, past voting behaviour, or issue-based segmentation. This fragmentation means that campaign strategies are often designed based on anecdotal evidence and personal experience rather than empirical data, leading to inefficient resource allocation and missed opportunities in high-potential polling units."),
  h2("2.2 Key Challenges Identified"),
  body("Through extensive consultation with party officials, ward coordinators, and field agents, several critical challenges have been identified that collectively undermine campaign effectiveness. These challenges span organisational, technological, and operational dimensions, and they interact in ways that compound their individual impact on campaign performance."),
  makeTable(
    ["Challenge Area", "Description", "Impact Level"],
    [
      ["Fragmented Data", "Voter records scattered across spreadsheets with no central repository or standardised format", "High"],
      ["Communication Gaps", "Information flow relies on informal channels; delays of 24-48 hours for critical updates", "High"],
      ["No Real-Time Visibility", "State headquarters lacks live dashboards for field activity, incident reports, or voter sentiment", "Critical"],
      ["Volunteer Management", "No systematic approach to recruitment, training, assignment, or performance tracking", "Medium"],
      ["Resource Misallocation", "Campaign materials and personnel deployed without data-driven prioritisation of polling units", "High"],
      ["Security & Monitoring", "Election day monitoring relies on ad-hoc phone calls; no structured incident reporting", "Critical"],
    ]
  ),
  tableCaption("Table 1: Summary of Key Campaign Challenges"),
  h2("2.3 Strategic Implications"),
  body("The cumulative effect of these challenges is a campaign operation that reacts slowly to emerging situations, fails to capitalise on favourable voter dynamics, and cannot provide state-level leadership with the timely intelligence needed for strategic decision-making. In closely contested states where margins of victory can be as narrow as a few thousand votes across dozens of polling units, these operational deficiencies translate directly into lost votes and, ultimately, lost elections. The 2023 electoral cycle demonstrated that opposition parties who invested in centralised campaign technology and data-driven field operations were able to achieve significant gains in previously safe APC territories, underscoring the urgency of modernising the party's campaign infrastructure."),

  // ── 3. GOALS & EXPECTED OUTCOMES ──
  h1("3. Goals and Expected Outcomes"),
  h2("3.1 Primary Objectives"),
  body("The proposed solution is designed to achieve five primary objectives that directly address the challenges identified in the current state analysis. Each objective is measurable, time-bound, and linked to specific key performance indicators that will be tracked throughout the campaign lifecycle."),
  makeTable(
    ["Objective", "Key Performance Indicator", "Target"],
    [
      ["Centralise Voter Data", "Percentage of registered voters in digitised database", "90% within 8 weeks"],
      ["Real-Time Communication", "Average time for critical alerts from field to HQ", "Under 15 minutes"],
      ["Field Coordination", "Number of active ward coordinators with mobile access", "100% coverage"],
      ["Election Monitoring", "Percentage of polling units with trained observers", "95% on election day"],
      ["Resource Efficiency", "Reduction in material wastage through data-driven distribution", "40% reduction"],
    ]
  ),
  tableCaption("Table 2: Primary Objectives and Key Performance Indicators"),
  h2("3.2 Expected Outcomes"),
  body("Upon full implementation, the state campaign office will operate as a professional, data-driven organisation capable of supporting thousands of field operatives across all local government areas. The expected outcomes extend beyond mere operational improvements; they represent a fundamental transformation in how the APC approaches electoral contests at the state level. The centralised voter intelligence system will enable micro-targeting of campaign messages to specific demographic groups, issue-based voter engagement at the polling unit level, and predictive modelling of voter turnout that allows the campaign to focus resources where they will have the greatest electoral impact."),
  body("Furthermore, the integrated monitoring and incident response framework will provide the party with an unprecedented ability to detect, report, and escalate electoral irregularities in real time. This capability serves a dual purpose: it protects the integrity of the electoral process for APC supporters, and it provides the party with documentary evidence that can support legal challenges if necessary. The communication infrastructure will also persist beyond election day, providing the party with a permanent organising platform for governance engagement, membership mobilisation, and future electoral preparation."),

  // ── 4. SOLUTION DESIGN ──
  h1("4. Solution Design"),
  h2("4.1 Technology Platform"),
  body("The technology platform forms the digital backbone of the campaign office, providing a suite of integrated tools accessible via web browsers and mobile applications. The platform architecture follows a modular design that allows individual components to be deployed incrementally while maintaining data consistency and interoperability across the entire system. At its core, the platform comprises a centralised voter database, a real-time analytics dashboard, a field coordination module, and an election monitoring system, all connected through a unified API layer that ensures seamless data flow between components."),
  h3("4.1.1 Voter Intelligence Database"),
  body("The voter intelligence database consolidates all available voter data from INEC records, party membership rolls, previous election results, and field-collected survey data into a single, queryable repository. Each voter record includes demographic information (age, gender, occupation), geographic data (polling unit, ward, local government area), and engagement history (past turnout, event attendance, issue preferences). The database supports advanced filtering and segmentation, allowing campaign strategists to identify voter cohorts by any combination of attributes. For example, the system can generate a list of first-time voters in a specific ward who have indicated interest in employment-related issues, enabling targeted door-to-door engagement with relevant messaging."),
  h3("4.1.2 Real-Time Analytics Dashboard"),
  body("The analytics dashboard provides state-level campaign leadership with a live overview of all campaign activities across the state. Key metrics displayed include daily field reports submitted by ward coordinators, volunteer engagement rates by local government area, voter sentiment trends derived from structured field surveys, and material distribution status for campaign paraphernalia. The dashboard uses colour-coded visual indicators to highlight areas requiring immediate attention, such as local government areas where field report submission rates have dropped below acceptable thresholds or where opposition activity has been detected. This situational awareness enables the state campaign director to make informed decisions about resource reallocation, message adjustment, and tactical response within minutes rather than days."),
  h3("4.1.3 Field Coordination Mobile Application"),
  body("A dedicated mobile application provides ward coordinators and field agents with the tools they need to execute campaign activities efficiently from their assigned locations. The application supports daily activity logging, voter registration verification, issue and incident reporting with GPS-tagged photographs, route optimisation for door-to-door canvassing, and instant messaging with the local government zone coordinator. The application is designed to function in low-bandwidth environments, caching critical data locally and synchronising with the central server when connectivity becomes available. This offline-first architecture ensures that field operatives in rural or connectivity-challenged areas can continue their work without interruption."),
  h2("4.2 Physical Office Infrastructure"),
  body("The state campaign office requires a physical location that serves as the central hub for all campaign operations. The recommended configuration includes a primary operations floor with open-plan workstations for data analysts and communication officers, a situation room equipped with large-format displays for real-time dashboard monitoring and strategic planning sessions, a secure server room housing on-premises computing infrastructure for data processing and backup, a training room with capacity for thirty participants for coordinator onboarding and skills development, and a reception and visitor management area for stakeholder engagement. The recommended minimum floor space is 300 square metres, located in a secure, accessible area with reliable power supply and internet connectivity. Backup power through a 20KVA generator and solar inverter system is essential to ensure continuity of operations during power outages."),
  h2("4.3 Organisational Structure"),
  body("The campaign office will operate under a clear organisational hierarchy designed to ensure rapid decision-making and accountability at every level. At the apex, the State Campaign Director reports directly to the State Chairman and is responsible for overall strategic direction and resource allocation. Below the Director, four functional units each led by a Deputy Director: the Data and Analytics Unit manages the voter database, produces intelligence reports, and maintains the analytics platform; the Field Operations Unit oversees all ward and local government coordinators, manages volunteer deployment, and coordinates grassroots activities; the Communications Unit handles media relations, message development, social media management, and internal communications; and the Logistics and Administration Unit manages procurement, venue coordination, material distribution, and office operations."),
  makeTable(
    ["Role", "Reporting Line", "Key Responsibilities"],
    [
      ["State Campaign Director", "State Chairman", "Strategic direction, resource allocation, stakeholder management"],
      ["Deputy Director (Data)", "Campaign Director", "Voter database, analytics, intelligence reporting"],
      ["Deputy Director (Field)", "Campaign Director", "Ward coordinators, volunteers, grassroots activities"],
      ["Deputy Director (Comms)", "Campaign Director", "Media, messaging, social media, internal comms"],
      ["Deputy Director (Logistics)", "Campaign Director", "Procurement, distribution, office management"],
      ["Zonal Coordinators (LGA)", "DD (Field)", "LGA-level coordination, report compilation"],
      ["Ward Coordinators", "Zonal Coordinator", "Polling unit operations, volunteer supervision"],
    ]
  ),
  tableCaption("Table 3: Campaign Office Organisational Structure"),

  // ── 5. IMPLEMENTATION ROADMAP ──
  h1("5. Implementation Roadmap and Milestones"),
  body("The implementation follows a structured twelve-week phased approach that balances the urgency of campaign preparation with the need for thorough testing, training, and quality assurance. Each phase builds on the deliverables of the previous phase, creating a cumulative progression toward full operational capability. The roadmap is designed with built-in review gates at each phase transition, allowing the campaign leadership to assess progress and approve advancement to the next phase."),
  h2("5.1 Phase 1: Foundation (Weeks 1-3)"),
  body("The foundation phase focuses on establishing the physical and digital infrastructure required for campaign operations. Key activities during this phase include securing and preparing the office location, procuring and installing computing and networking equipment, deploying the core technology platform components, and initiating the voter data consolidation process. The data team will begin by collecting existing voter records from all local government areas, standardising data formats, and loading records into the central database. Simultaneously, the logistics team will establish vendor relationships for campaign materials and begin procurement of essential supplies. By the end of Week 3, the office should be physically operational with basic technology infrastructure in place and at least 50 percent of available voter data loaded into the system."),
  h2("5.2 Phase 2: Activation (Weeks 4-7)"),
  body("The activation phase shifts focus to staffing, training, and system integration. Recruitment of core office staff and zonal coordinators will be completed during Weeks 4 and 5, followed by an intensive two-week training programme covering platform usage, data collection protocols, communication procedures, and security awareness. The field coordination mobile application will be deployed to all zonal and ward coordinators, with hands-on training sessions conducted at the state office and through regional workshops. During this phase, the communications unit will establish media relationships, develop the initial campaign messaging framework, and set up social media channels. The analytics dashboard will be populated with initial data and made available to the campaign director and deputy directors for review and feedback."),
  h2("5.3 Phase 3: Scale-Up (Weeks 8-10)"),
  body("The scale-up phase extends the campaign's reach to all local government areas and ward levels. Ward coordinators will be recruited, trained, and equipped with mobile devices and campaign materials. The volunteer recruitment drive will be launched through party membership networks, community organisations, and social media outreach. The field operations team will conduct systematic voter outreach using the routes and schedules generated by the platform's route optimisation feature. Real-time monitoring dashboards will be activated, and daily reporting routines will be established across all zones. The communications unit will begin targeted messaging campaigns based on voter segmentation data, and the logistics team will execute the first round of campaign material distribution to all polling units."),
  h2("5.4 Phase 4: Operational Excellence (Weeks 11-12)"),
  body("The final phase focuses on stress-testing all systems, refining processes based on operational experience, and preparing for peak campaign intensity. Full-scale simulation exercises will test the election monitoring system, incident response protocols, and communication chains under realistic conditions. Any identified gaps or weaknesses will be addressed through targeted interventions. Contingency plans will be finalised for scenarios including technology failure, security incidents, and last-minute regulatory changes. The campaign office will reach full operational capability by the end of Week 12, with all systems, personnel, and processes ready to support the campaign through election day and beyond."),
  makeTable(
    ["Phase", "Timeline", "Key Milestones", "Deliverables"],
    [
      ["Foundation", "Weeks 1-3", "Office secured, platform deployed, 50% voter data loaded", "Operational office, database v1, vendor contracts"],
      ["Activation", "Weeks 4-7", "Staff hired, coordinators trained, mobile app deployed", "Trained workforce, functional dashboard, media plan"],
      ["Scale-Up", "Weeks 8-10", "Ward-level coverage, volunteer drive launched, real-time monitoring active", "Full field coverage, messaging campaigns active"],
      ["Operational Excellence", "Weeks 11-12", "Simulation exercises complete, all systems stress-tested", "Contingency plans, full operational readiness"],
    ]
  ),
  tableCaption("Table 4: Implementation Phases and Key Milestones"),

  // ── 6. RESOURCE REQUIREMENTS & BUDGET ──
  h1("6. Resource Requirements and Budget"),
  h2("6.1 Personnel Requirements"),
  body("The campaign office requires a dedicated team of professionals and political operatives to function effectively. The core team based at the state office will consist of approximately twenty-five full-time staff, supplemented by a network of zonal and ward coordinators across all local government areas. The personnel plan is designed to balance operational capability with fiscal responsibility, leveraging party members and volunteers for roles that do not require specialised technical skills."),
  makeTable(
    ["Category", "Headcount", "Duration", "Estimated Cost (N)"],
    [
      ["State Campaign Director", "1", "6 months", "【Please fill in】"],
      ["Deputy Directors (4 units)", "4", "6 months", "【Please fill in】"],
      ["Data Analysts", "4", "6 months", "【Please fill in】"],
      ["Communication Officers", "3", "6 months", "【Please fill in】"],
      ["Field Operations Staff", "5", "6 months", "【Please fill in】"],
      ["Logistics & Admin Staff", "4", "6 months", "【Please fill in】"],
      ["IT Support", "2", "6 months", "【Please fill in】"],
      ["Zonal Coordinators (LGA)", "【Please fill in】", "4 months", "【Please fill in】"],
      ["Ward Coordinators", "【Please fill in】", "3 months", "【Please fill in】"],
    ]
  ),
  tableCaption("Table 5: Personnel Requirements and Cost Estimates"),
  h2("6.2 Technology and Infrastructure Budget"),
  body("The technology budget covers the development, deployment, and maintenance of the digital campaign platform, as well as the hardware, networking, and power infrastructure required for reliable operations. The platform development includes customisation of the voter database, analytics dashboard, mobile application, and election monitoring system. Cloud hosting services provide scalable compute and storage resources, while on-premises infrastructure ensures data sovereignty and backup capability."),
  makeTable(
    ["Item", "Description", "Estimated Cost (N)"],
    [
      ["Platform Development", "Custom voter DB, dashboard, mobile app, monitoring system", "【Please fill in】"],
      ["Cloud Hosting (6 months)", "Scalable servers, databases, CDN, SSL certificates", "【Please fill in】"],
      ["Office Equipment", "Computers, printers, displays, networking gear", "【Please fill in】"],
      ["Power Infrastructure", "20KVA generator, solar inverter, UPS systems", "【Please fill in】"],
      ["Mobile Devices", "Smartphones and tablets for coordinators", "【Please fill in】"],
      ["Internet Connectivity", "Fibre connection with 4G/5G backup", "【Please fill in】"],
      ["Office Setup", "Furniture, fixtures, security systems", "【Please fill in】"],
      ["Software Licenses", "Productivity tools, CRM, analytics software", "【Please fill in】"],
    ]
  ),
  tableCaption("Table 6: Technology and Infrastructure Budget"),
  h2("6.3 Operational and Contingency Budget"),
  body("Beyond technology and personnel, the campaign office requires operational funding for day-to-day activities including transportation for field coordinators, venue hire for training events and stakeholder meetings, printing and production of campaign materials, utility bills and consumables, and security provisions. A contingency reserve of fifteen percent of the total budget is recommended to address unforeseen expenses, emergency situations, and strategic opportunities that may arise during the campaign period. This reserve provides the flexibility needed to respond to a dynamic electoral environment without delaying critical operational activities due to budget constraints."),

  // ── 7. RISK ANALYSIS & MITIGATION ──
  h1("7. Risk Analysis and Mitigation"),
  body("A comprehensive risk assessment has been conducted to identify potential threats to the successful implementation and operation of the campaign office. Each risk has been evaluated based on its likelihood of occurrence and potential impact on campaign objectives, with corresponding mitigation strategies designed to reduce either the probability or the consequence of each risk to an acceptable level."),
  makeTable(
    ["Risk", "Likelihood", "Impact", "Mitigation Strategy"],
    [
      ["Data Breach / Information Leak", "Medium", "Critical", "End-to-end encryption, role-based access, security audits, NDAs for all staff"],
      ["Technology Platform Failure", "Low", "High", "Redundant cloud hosting, offline-capable mobile app, regular data backups"],
      ["Staff Attrition", "Medium", "Medium", "Competitive compensation, clear career path, knowledge documentation"],
      ["Regulatory / Legal Challenges", "Low", "High", "Legal compliance review, INEC guidelines adherence, documentation"],
      ["Insufficient Funding", "Medium", "High", "Phased implementation, prioritised spending, donor engagement"],
      ["Opposition Disruption", "Medium", "Medium", "Physical security, counter-intelligence monitoring, legal support"],
      ["Community Resistance", "Low", "Medium", "Stakeholder engagement, community liaison officers, cultural sensitivity"],
      ["Power / Connectivity Outages", "High", "Medium", "Generator + solar backup, offline-first architecture, 4G fallback"],
    ]
  ),
  tableCaption("Table 7: Risk Assessment Matrix"),
  body("The risk management approach follows a continuous monitoring model, with weekly risk reviews conducted by the campaign director and deputy directors. Emerging risks are documented, assessed, and assigned to responsible owners with clear mitigation actions and deadlines. The contingency budget provides financial resources for rapid response to any risk event that exceeds planned mitigation capacity. Additionally, the platform's monitoring capabilities serve an early warning function, detecting anomalies in field reporting patterns, data quality, or system performance that may indicate emerging risks before they materialise into actual incidents."),

  // ── 8. EXPECTED BENEFITS & EVALUATION ──
  h1("8. Expected Benefits and Evaluation"),
  h2("8.1 Quantifiable Benefits"),
  body("The proposed campaign office solution is expected to deliver measurable improvements across multiple dimensions of campaign performance. The following table presents the projected benefits with their associated measurement methodologies and timelines for realisation. These projections are based on benchmarks from comparable political campaign operations in Nigeria and other African democracies that have adopted similar technology-enabled approaches."),
  makeTable(
    ["Benefit Area", "Current State", "Projected Improvement", "Measurement Method"],
    [
      ["Voter Data Coverage", "Estimated 30-40% digitised", "90% digitised within 8 weeks", "Database record count vs. INEC voter register"],
      ["Field Report Speed", "24-48 hours average", "Under 15 minutes (real-time)", "Platform timestamp analysis"],
      ["Voter Outreach Coverage", "Estimated 25% of registered voters", "70% of registered voters", "Canvassing logs and interaction records"],
      ["Volunteer Mobilisation", "Ad-hoc, undocumented", "Structured with 80% retention rate", "Volunteer management system metrics"],
      ["Incident Response", "Hours to days", "Under 30 minutes for critical issues", "Incident reporting system timestamps"],
      ["Material Distribution", "30-40% wastage estimated", "Under 15% wastage", "Inventory tracking and audit reports"],
    ]
  ),
  tableCaption("Table 8: Projected Campaign Performance Improvements"),
  h2("8.2 Long-Term Strategic Value"),
  body("Beyond the immediate electoral cycle, the campaign office infrastructure represents a significant long-term investment in the party's organisational capacity. The voter database, communication networks, and trained personnel will persist as party assets that can be leveraged for governance engagement between elections, membership recruitment and retention, policy consultation with party supporters, and rapid mobilisation for future electoral contests including local government, state, and national elections. The technology platform can be adapted for non-electoral functions such as community development project monitoring, constituency service delivery tracking, and party membership management, providing ongoing value that extends well beyond any single election cycle."),
  h2("8.3 Evaluation Framework"),
  body("A structured evaluation framework will be implemented from the outset to track progress against objectives and identify areas requiring corrective action. The framework includes weekly operational reviews at the deputy director level, bi-weekly strategic reviews chaired by the campaign director, monthly performance reports to the state party chairman, and post-election comprehensive assessment. Key evaluation criteria include system uptime and reliability metrics, user adoption rates across all platform modules, data quality scores measuring completeness and accuracy of voter records, field activity completion rates against planned targets, and stakeholder satisfaction surveys conducted among coordinators and volunteers."),
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
    // SECTION 1: COVER (no page number, no header/footer)
    {
      properties: {
        page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } },
      },
      children: buildCoverR1({
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
      }),
    },
    // SECTION 2: FRONT MATTER (TOC) — Roman numerals
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
    // SECTION 3: BODY — Arabic numerals starting from 1
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
