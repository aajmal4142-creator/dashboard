/**
 * Global regulatory deadline catalog (30+ records).
 * Idempotent via catalogKey. Wired from src/seed/seed.ts and standalone script.
 */

import type { Payload } from "payload";

export type DeadlineSeed = {
  catalogKey: string;
  name: string;
  type: "CSRD" | "ISSB" | "SBTi" | "Taxonomy" | "Other";
  framework:
    | "CSRD"
    | "ISSB"
    | "SBTi"
    | "Taxonomy"
    | "BRSR"
    | "GRI"
    | "SASB"
    | "TCFD"
    | "ISO14064"
    | "OTHER";
  jurisdiction: "EU" | "IN" | "GB" | "US" | "GLOBAL" | "OTHER";
  country: string;
  dueDate: string;
  scope: "all" | "industry" | "size" | "country";
  severity: "critical" | "high" | "medium";
  description: string;
  documentationUrl: string;
  organisationApplicability: {
    appliesTo: "all" | "industry" | "size" | "country";
    countries?: Array<{ code: string }>;
    industries?: Array<{ nacePrefix: string }>;
    minEmployeeCount?: number;
    maxEmployeeCount?: number;
    revenueBands?: Array<"lt_2m" | "2_10m" | "10_50m" | "50_250m" | "gt_250m">;
    euOperatingOnly?: boolean;
    requireLargeUndertaking?: boolean;
  };
  prerequisiteTasks: Array<{ task: string; done: boolean }>;
};

export const REGULATORY_DEADLINE_SEEDS: DeadlineSeed[] = [
  {
    catalogKey: "csrd-wave1-fy2024",
    name: "CSRD Wave 1 — first sustainability statement",
    type: "CSRD",
    framework: "CSRD",
    jurisdiction: "EU",
    country: "EU",
    dueDate: "2025-12-31",
    scope: "size",
    severity: "critical",
    description:
      "Large public-interest entities already subject to NFRD: first CSRD/ESRS sustainability statement for FY2024, typically filed in 2025 with the annual report.",
    documentationUrl:
      "https://finance.ec.europa.eu/capital-markets-union-and-financial-markets/company-reporting-and-auditing/company-reporting/corporate-sustainability-reporting_en",
    organisationApplicability: {
      appliesTo: "size",
      minEmployeeCount: 500,
      euOperatingOnly: true,
      requireLargeUndertaking: true,
    },
    prerequisiteTasks: [
      { task: "Confirm NFRD legacy status", done: false },
      { task: "Map ESRS datapoints", done: false },
      { task: "Engage assurance provider", done: false },
    ],
  },
  {
    catalogKey: "csrd-wave2-fy2025",
    name: "CSRD Wave 2 — large undertakings",
    type: "CSRD",
    framework: "CSRD",
    jurisdiction: "EU",
    country: "EU",
    dueDate: "2026-12-31",
    scope: "size",
    severity: "critical",
    description:
      "Other large EU undertakings: first CSRD reporting for FY2025 (calendar placeholder — confirm Omnibus / national transposition and FYE).",
    documentationUrl:
      "https://finance.ec.europa.eu/capital-markets-union-and-financial-markets/company-reporting-and-auditing/company-reporting/corporate-sustainability-reporting_en",
    organisationApplicability: {
      appliesTo: "size",
      minEmployeeCount: 250,
      revenueBands: ["50_250m", "gt_250m"],
      euOperatingOnly: true,
      requireLargeUndertaking: true,
    },
    prerequisiteTasks: [
      { task: "Double materiality assessment", done: false },
      { task: "Scope 1–3 inventory ready", done: false },
      { task: "Governance disclosures drafted", done: false },
    ],
  },
  {
    catalogKey: "csrd-wave2-filing-2028",
    name: "CSRD Wave 2 — simplified calendar filing",
    type: "CSRD",
    framework: "CSRD",
    jurisdiction: "EU",
    country: "EU",
    dueDate: "2028-06-30",
    scope: "size",
    severity: "critical",
    description:
      "Placeholder Wave 2 filing aligned to ClearESG obligation engine (FY2027 → mid-2028). Confirm against current law.",
    documentationUrl:
      "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022L2464",
    organisationApplicability: {
      appliesTo: "all",
      euOperatingOnly: true,
      requireLargeUndertaking: true,
    },
    prerequisiteTasks: [
      { task: "Confirm fiscal year end", done: false },
      { task: "Publish sustainability statement", done: false },
    ],
  },
  {
    catalogKey: "csrd-wave3-listed-sme",
    name: "CSRD Wave 3 — listed SMEs",
    type: "CSRD",
    framework: "CSRD",
    jurisdiction: "EU",
    country: "EU",
    dueDate: "2027-12-31",
    scope: "size",
    severity: "high",
    description:
      "Listed SMEs in the EU: first CSRD reporting window (placeholder calendar — opt-out / LSME standard may apply).",
    documentationUrl: "https://www.efrag.org/Activities/210505-0630-2130/ESRS-LSME",
    organisationApplicability: {
      appliesTo: "size",
      minEmployeeCount: 50,
      maxEmployeeCount: 249,
      euOperatingOnly: true,
    },
    prerequisiteTasks: [
      { task: "Assess LSME vs full ESRS", done: false },
      { task: "Board approval of reporting plan", done: false },
    ],
  },
  {
    catalogKey: "eu-taxonomy-art8-2026",
    name: "EU Taxonomy Article 8 KPIs",
    type: "Taxonomy",
    framework: "Taxonomy",
    jurisdiction: "EU",
    country: "EU",
    dueDate: "2026-04-30",
    scope: "country",
    severity: "high",
    description:
      "Disclosure of Taxonomy-eligible and aligned turnover, CapEx, and OpEx alongside the annual financial report for in-scope undertakings.",
    documentationUrl:
      "https://finance.ec.europa.eu/sustainable-finance/tools-and-standards/eu-taxonomy-sustainable-activities_en",
    organisationApplicability: {
      appliesTo: "country",
      countries: [{ code: "EU" }],
      requireLargeUndertaking: true,
    },
    prerequisiteTasks: [
      { task: "Map economic activities to Taxonomy codes", done: false },
      { task: "DNSH and minimum safeguards checklist", done: false },
    ],
  },
  {
    catalogKey: "eu-taxonomy-capex-plan",
    name: "EU Taxonomy CapEx plan update",
    type: "Taxonomy",
    framework: "Taxonomy",
    jurisdiction: "EU",
    country: "EU",
    dueDate: "2026-12-31",
    scope: "industry",
    severity: "medium",
    description:
      "Annual refresh of CapEx plans supporting Taxonomy alignment for manufacturing and energy activities.",
    documentationUrl: "https://ec.europa.eu/sustainable-finance-taxonomy",
    organisationApplicability: {
      appliesTo: "industry",
      industries: [{ nacePrefix: "C" }, { nacePrefix: "D" }],
      euOperatingOnly: true,
    },
    prerequisiteTasks: [{ task: "Update CapEx alignment schedule", done: false }],
  },
  {
    catalogKey: "issb-s1-s2-adoption-2026",
    name: "ISSB S1/S2 first annual disclosures",
    type: "ISSB",
    framework: "ISSB",
    jurisdiction: "GLOBAL",
    country: "GLOBAL",
    dueDate: "2026-06-30",
    scope: "all",
    severity: "high",
    description:
      "First full-year ISSB IFRS S1 (general) and S2 (climate) disclosures where jurisdiction has adopted ISSB baselines.",
    documentationUrl:
      "https://www.ifrs.org/issued-standards/ifrs-sustainability-standards-navigator/",
    organisationApplicability: { appliesTo: "all" },
    prerequisiteTasks: [
      { task: "Complete GHG inventory Scope 1–3", done: false },
      { task: "Climate risk scenario narrative", done: false },
      { task: "Governance oversight documented", done: false },
    ],
  },
  {
    catalogKey: "issb-uk-sds-2026",
    name: "UK SDS / ISSB-aligned disclosure",
    type: "ISSB",
    framework: "ISSB",
    jurisdiction: "GB",
    country: "GB",
    dueDate: "2026-12-31",
    scope: "country",
    severity: "high",
    description:
      "UK Sustainability Disclosure Standards aligned to ISSB — large UK companies calendar placeholder.",
    documentationUrl:
      "https://www.gov.uk/government/publications/uk-sustainability-disclosure-standards",
    organisationApplicability: {
      appliesTo: "country",
      countries: [{ code: "GB" }],
      requireLargeUndertaking: true,
    },
    prerequisiteTasks: [
      { task: "Map SDS to existing TCFD pack", done: false },
      { task: "Board climate oversight minute", done: false },
    ],
  },
  {
    catalogKey: "issb-interim-climate-2027",
    name: "ISSB climate metrics refresh",
    type: "ISSB",
    framework: "ISSB",
    jurisdiction: "GLOBAL",
    country: "GLOBAL",
    dueDate: "2027-03-31",
    scope: "size",
    severity: "medium",
    description:
      "Annual refresh of climate-related metrics and targets under IFRS S2 for large reporters.",
    documentationUrl:
      "https://www.ifrs.org/issued-standards/ifrs-sustainability-standards-navigator/ifrs-s2-climate-related-disclosures/",
    organisationApplicability: {
      appliesTo: "size",
      minEmployeeCount: 250,
      revenueBands: ["50_250m", "gt_250m"],
    },
    prerequisiteTasks: [{ task: "Update financed / value-chain emissions", done: false }],
  },
  {
    catalogKey: "sbti-near-term-commit",
    name: "SBTi near-term target commitment window",
    type: "SBTi",
    framework: "SBTi",
    jurisdiction: "GLOBAL",
    country: "GLOBAL",
    dueDate: "2026-09-30",
    scope: "size",
    severity: "high",
    description:
      "Science Based Targets initiative: submit near-term science-based targets within the commitment window (typically 24 months from commitment letter).",
    documentationUrl: "https://sciencebasedtargets.org/",
    organisationApplicability: {
      appliesTo: "size",
      minEmployeeCount: 100,
    },
    prerequisiteTasks: [
      { task: "Sign SBTi commitment letter", done: false },
      { task: "Build Scope 3 inventory", done: false },
      { task: "Model 1.5°C pathway", done: false },
    ],
  },
  {
    catalogKey: "sbti-validation-2027",
    name: "SBTi target validation decision",
    type: "SBTi",
    framework: "SBTi",
    jurisdiction: "GLOBAL",
    country: "GLOBAL",
    dueDate: "2027-06-30",
    scope: "all",
    severity: "medium",
    description:
      "Expected validation decision timeline for near-term targets submitted to SBTi (placeholder operational deadline).",
    documentationUrl: "https://sciencebasedtargets.org/resources",
    organisationApplicability: { appliesTo: "all" },
    prerequisiteTasks: [{ task: "Respond to SBTi analyst queries", done: false }],
  },
  {
    catalogKey: "sbti-net-zero-long-term",
    name: "SBTi net-zero long-term target",
    type: "SBTi",
    framework: "SBTi",
    jurisdiction: "GLOBAL",
    country: "GLOBAL",
    dueDate: "2030-12-31",
    scope: "size",
    severity: "medium",
    description:
      "Long-term net-zero target alignment checkpoint for companies with SBTi net-zero commitments.",
    documentationUrl: "https://sciencebasedtargets.org/net-zero",
    organisationApplicability: {
      appliesTo: "size",
      revenueBands: ["50_250m", "gt_250m"],
    },
    prerequisiteTasks: [{ task: "Publish transition plan", done: false }],
  },
  {
    catalogKey: "brsr-india-fy2025",
    name: "SEBI BRSR annual filing",
    type: "Other",
    framework: "BRSR",
    jurisdiction: "IN",
    country: "IN",
    dueDate: "2026-06-30",
    scope: "country",
    severity: "critical",
    description:
      "Business Responsibility and Sustainability Report for SEBI-listed entities in India. Listing status must be confirmed — size alone does not determine BRSR.",
    documentationUrl: "https://www.sebi.gov.in/",
    organisationApplicability: {
      appliesTo: "country",
      countries: [{ code: "IN" }],
    },
    prerequisiteTasks: [
      { task: "Confirm listing status", done: false },
      { task: "Complete BRSR Core KPIs", done: false },
      { task: "Board sign-off", done: false },
    ],
  },
  {
    catalogKey: "brsr-core-assurance-2026",
    name: "BRSR Core assurance",
    type: "Other",
    framework: "BRSR",
    jurisdiction: "IN",
    country: "IN",
    dueDate: "2026-08-31",
    scope: "country",
    severity: "high",
    description:
      "Reasonable assurance on BRSR Core attributes for top listed entities (placeholder — confirm SEBI circular applicability).",
    documentationUrl: "https://www.sebi.gov.in/",
    organisationApplicability: {
      appliesTo: "country",
      countries: [{ code: "IN" }],
      minEmployeeCount: 250,
    },
    prerequisiteTasks: [
      { task: "Appoint assurance provider", done: false },
      { task: "Close evidence pack", done: false },
    ],
  },
  {
    catalogKey: "tcfd-aligned-uk-2026",
    name: "UK TCFD-aligned climate disclosure",
    type: "Other",
    framework: "TCFD",
    jurisdiction: "GB",
    country: "GB",
    dueDate: "2026-04-30",
    scope: "country",
    severity: "high",
    description:
      "Continuing UK climate-related financial disclosures (TCFD-aligned) for large companies and LLPs.",
    documentationUrl:
      "https://www.gov.uk/government/publications/climate-related-financial-disclosures-for-companies-and-limited-liability-partnerships-llps",
    organisationApplicability: {
      appliesTo: "country",
      countries: [{ code: "GB" }],
      requireLargeUndertaking: true,
    },
    prerequisiteTasks: [
      { task: "Update scenario analysis", done: false },
      { task: "Refresh metrics & targets", done: false },
    ],
  },
  {
    catalogKey: "uk-secr-directors-report-2026",
    name: "UK SECR — directors' report energy and carbon disclosure",
    type: "Other",
    framework: "OTHER",
    jurisdiction: "GB",
    country: "GB",
    dueDate: "2026-09-30",
    scope: "country",
    severity: "high",
    description:
      "Streamlined Energy and Carbon Reporting (SECR): disclose UK energy use (kWh), Scope 1/2 GHG, intensity ratio, methodology, and energy efficiency actions in the annual directors' report for large UK companies and LLPs (quoted companies also report global energy). Calendar placeholder — align to financial year end and filing date.",
    documentationUrl:
      "https://www.gov.uk/government/publications/environmental-reporting-guidelines-including-mandatory-greenhouse-gas-emissions-reporting-guidance",
    organisationApplicability: {
      appliesTo: "country",
      countries: [{ code: "GB" }],
      requireLargeUndertaking: true,
    },
    prerequisiteTasks: [
      { task: "Compile UK energy use (kWh)", done: false },
      { task: "Calculate Scope 1 and Scope 2 GHG", done: false },
      { task: "Select and disclose intensity ratio", done: false },
      { task: "Draft methodology and efficiency narrative", done: false },
      { task: "Include SECR section in directors' report", done: false },
    ],
  },
  {
    catalogKey: "sec-climate-us-2026",
    name: "US climate disclosure (SEC calendar placeholder)",
    type: "Other",
    framework: "OTHER",
    jurisdiction: "US",
    country: "US",
    dueDate: "2026-12-31",
    scope: "country",
    severity: "high",
    description:
      "Placeholder for US federal / state climate disclosure calendars. Confirm current SEC and California rules before treating as mandatory.",
    documentationUrl: "https://www.sec.gov/",
    organisationApplicability: {
      appliesTo: "country",
      countries: [{ code: "US" }],
      revenueBands: ["50_250m", "gt_250m"],
    },
    prerequisiteTasks: [
      { task: "Legal scoping memo", done: false },
      { task: "GHG inventory boundary review", done: false },
    ],
  },
  {
    catalogKey: "ca-sb253-2026",
    name: "California SB 253 GHG disclosure",
    type: "Other",
    framework: "OTHER",
    jurisdiction: "US",
    country: "US",
    dueDate: "2026-01-01",
    scope: "country",
    severity: "critical",
    description:
      "California Climate Corporate Data Accountability Act (SB 253) — Scope 1 and 2 reporting for large companies doing business in California (placeholder timing). Track checklist coverage at /compliance/california.",
    documentationUrl: "https://www.carb.ca.gov/",
    organisationApplicability: {
      appliesTo: "country",
      countries: [{ code: "US" }],
      revenueBands: ["gt_250m"],
    },
    prerequisiteTasks: [
      { task: "Confirm California nexus", done: false },
      { task: "Close Scope 1–2 activity metrics in ClearESG", done: false },
      { task: "Scope 1–2 assurance readiness", done: false },
      { task: "Review SB 253 pack gaps at /compliance/california", done: false },
    ],
  },
  {
    catalogKey: "ca-sb261-2026",
    name: "California SB 261 climate risk report",
    type: "Other",
    framework: "TCFD",
    jurisdiction: "US",
    country: "US",
    dueDate: "2026-01-01",
    scope: "country",
    severity: "high",
    description:
      "California Climate-Related Financial Risk Act (SB 261) — biennial climate risk report mapped to TCFD pillars in ClearESG (placeholder). Track checklist at /compliance/california.",
    documentationUrl: "https://www.carb.ca.gov/",
    organisationApplicability: {
      appliesTo: "country",
      countries: [{ code: "US" }],
      revenueBands: ["50_250m", "gt_250m"],
    },
    prerequisiteTasks: [
      { task: "Complete TCFD governance / strategy / risk answers", done: false },
      { task: "Draft climate risk narrative", done: false },
      { task: "Review SB 261 pack gaps at /compliance/california", done: false },
    ],
  },
  {
    catalogKey: "gri-universal-update",
    name: "GRI Universal Standards refresh",
    type: "Other",
    framework: "GRI",
    jurisdiction: "GLOBAL",
    country: "GLOBAL",
    dueDate: "2026-12-31",
    scope: "all",
    severity: "medium",
    description: "Voluntary GRI report cycle checkpoint using Universal Standards 2021.",
    documentationUrl: "https://www.globalreporting.org/standards/",
    organisationApplicability: { appliesTo: "all" },
    prerequisiteTasks: [
      { task: "Update material topics", done: false },
      { task: "Stakeholder engagement log", done: false },
    ],
  },
  {
    catalogKey: "sasb-industry-metrics",
    name: "SASB industry metrics pack",
    type: "Other",
    framework: "SASB",
    jurisdiction: "GLOBAL",
    country: "GLOBAL",
    dueDate: "2026-09-30",
    scope: "industry",
    severity: "medium",
    description:
      "Annual SASB / ISSB industry-based metrics pack for manufacturing reporters.",
    documentationUrl: "https://sasb.ifrs.org/",
    organisationApplicability: {
      appliesTo: "industry",
      industries: [{ nacePrefix: "C" }],
    },
    prerequisiteTasks: [{ task: "Select SASB industry standard", done: false }],
  },
  {
    catalogKey: "iso14064-verification",
    name: "ISO 14064-1 verification cycle",
    type: "Other",
    framework: "ISO14064",
    jurisdiction: "GLOBAL",
    country: "GLOBAL",
    dueDate: "2026-11-30",
    scope: "all",
    severity: "medium",
    description:
      "Optional third-party verification of organisational GHG inventory to ISO 14064-1.",
    documentationUrl: "https://www.iso.org/standard/66453.html",
    organisationApplicability: { appliesTo: "all" },
    prerequisiteTasks: [
      { task: "Close inventory evidence", done: false },
      { task: "Book verifier", done: false },
    ],
  },
  {
    catalogKey: "csrd-assurance-limited-2026",
    name: "CSRD limited assurance engagement",
    type: "CSRD",
    framework: "CSRD",
    jurisdiction: "EU",
    country: "EU",
    dueDate: "2026-05-31",
    scope: "size",
    severity: "critical",
    description:
      "Limited assurance on CSRD sustainability statement (placeholder for assurance window before filing).",
    documentationUrl: "https://finance.ec.europa.eu/",
    organisationApplicability: {
      appliesTo: "all",
      euOperatingOnly: true,
      requireLargeUndertaking: true,
    },
    prerequisiteTasks: [
      { task: "Issue RFP to assurance firms", done: false },
      { task: "Walkthrough controls testing", done: false },
    ],
  },
  {
    catalogKey: "eu-csddd-due-diligence",
    name: "CSDDD / due diligence readiness",
    type: "Other",
    framework: "OTHER",
    jurisdiction: "EU",
    country: "EU",
    dueDate: "2027-07-26",
    scope: "size",
    severity: "high",
    description:
      "Corporate Sustainability Due Diligence Directive readiness checkpoint for large EU companies (confirm phased application dates).",
    documentationUrl:
      "https://commission.europa.eu/business-economy-euro/doing-business-eu/sustainability-due-diligence-responsible-business/corporate-sustainability-due-diligence_en",
    organisationApplicability: {
      appliesTo: "size",
      minEmployeeCount: 1000,
      euOperatingOnly: true,
    },
    prerequisiteTasks: [
      { task: "Map high-risk value-chain tiers", done: false },
      { task: "Adopt human-rights policy", done: false },
    ],
  },
  {
    catalogKey: "sfdr-pai-finance",
    name: "SFDR PAI statement (financial sector)",
    type: "Other",
    framework: "OTHER",
    jurisdiction: "EU",
    country: "EU",
    dueDate: "2026-06-30",
    scope: "industry",
    severity: "high",
    description:
      "Principal Adverse Impact statement for financial market participants under SFDR.",
    documentationUrl:
      "https://finance.ec.europa.eu/sustainable-finance/disclosures/sustainability-related-disclosure-financial-services-sector-sfdr_en",
    organisationApplicability: {
      appliesTo: "industry",
      industries: [{ nacePrefix: "K" }],
      euOperatingOnly: true,
    },
    prerequisiteTasks: [
      { task: "Open SFDR PAI coverage pack (/compliance/sfdr)", done: false },
      { task: "Fill mapped GHG and energy metrics for PAI 1, 5, 6", done: false },
      {
        task: "Document unmapped PAI gaps (biodiversity, water, waste, pay gap, weapons)",
        done: false,
      },
      { task: "Compile PAI indicators into entity-level statement draft", done: false },
    ],
  },
  {
    catalogKey: "nl-csrd-transposition",
    name: "Netherlands CSRD national filing",
    type: "CSRD",
    framework: "CSRD",
    jurisdiction: "EU",
    country: "NL",
    dueDate: "2026-12-31",
    scope: "country",
    severity: "critical",
    description:
      "Dutch transposition calendar for CSRD sustainability reporting (placeholder — confirm AFM / KvK filing channel).",
    documentationUrl: "https://www.afm.nl/",
    organisationApplicability: {
      appliesTo: "country",
      countries: [{ code: "NL" }],
      requireLargeUndertaking: true,
    },
    prerequisiteTasks: [{ task: "Confirm national filing format", done: false }],
  },
  {
    catalogKey: "de-csrd-transposition",
    name: "Germany CSRD / CSRD-Umsetzungsgesetz",
    type: "CSRD",
    framework: "CSRD",
    jurisdiction: "EU",
    country: "DE",
    dueDate: "2026-12-31",
    scope: "country",
    severity: "critical",
    description:
      "German CSRD implementation reporting window for large undertakings (placeholder).",
    documentationUrl: "https://www.bundesanzeiger.de/",
    organisationApplicability: {
      appliesTo: "country",
      countries: [{ code: "DE" }],
      requireLargeUndertaking: true,
    },
    prerequisiteTasks: [{ task: "Engage Wirtschaftsprüfer for assurance", done: false }],
  },
  {
    catalogKey: "ie-csrd-filing",
    name: "Ireland CSRD sustainability statement",
    type: "CSRD",
    framework: "CSRD",
    jurisdiction: "EU",
    country: "IE",
    dueDate: "2026-12-31",
    scope: "country",
    severity: "critical",
    description:
      "Irish companies in CSRD scope — sustainability statement with annual return (placeholder calendar).",
    documentationUrl: "https://www.iaasa.ie/",
    organisationApplicability: {
      appliesTo: "country",
      countries: [{ code: "IE" }],
      requireLargeUndertaking: true,
    },
    prerequisiteTasks: [{ task: "File with CRO / annual report pack", done: false }],
  },
  {
    catalogKey: "taxonomy-nuclear-gas-dns",
    name: "Taxonomy complementary DA (nuclear/gas) review",
    type: "Taxonomy",
    framework: "Taxonomy",
    jurisdiction: "EU",
    country: "EU",
    dueDate: "2026-03-31",
    scope: "industry",
    severity: "medium",
    description:
      "Review of complementary delegated act activities for energy companies disclosing Taxonomy alignment.",
    documentationUrl:
      "https://finance.ec.europa.eu/publications/commission-delegated-regulation-amending-taxonomy_en",
    organisationApplicability: {
      appliesTo: "industry",
      industries: [{ nacePrefix: "D" }],
      euOperatingOnly: true,
    },
    prerequisiteTasks: [
      { task: "Re-screen activities under complementary DA", done: false },
    ],
  },
  {
    catalogKey: "issb-financed-emissions",
    name: "ISSB financed emissions (banks/insurers)",
    type: "ISSB",
    framework: "ISSB",
    jurisdiction: "GLOBAL",
    country: "GLOBAL",
    dueDate: "2027-06-30",
    scope: "industry",
    severity: "high",
    description:
      "Financed / facilitated emissions disclosures for financial institutions under ISSB S2 industry guidance.",
    documentationUrl: "https://www.ifrs.org/",
    organisationApplicability: {
      appliesTo: "industry",
      industries: [{ nacePrefix: "K" }],
    },
    prerequisiteTasks: [
      { task: "PCAF methodology selection", done: false },
      { task: "Portfolio data quality scoring", done: false },
    ],
  },
  {
    catalogKey: "sbti-flag-annual-disclosure",
    name: "SBTi annual progress disclosure",
    type: "SBTi",
    framework: "SBTi",
    jurisdiction: "GLOBAL",
    country: "GLOBAL",
    dueDate: "2026-12-15",
    scope: "all",
    severity: "medium",
    description: "Annual disclosure of progress against validated science-based targets.",
    documentationUrl: "https://sciencebasedtargets.org/",
    organisationApplicability: { appliesTo: "all" },
    prerequisiteTasks: [{ task: "Publish progress vs base year", done: false }],
  },
  {
    catalogKey: "eu-esrs-datapoint-freeze",
    name: "ESRS datapoint freeze for reporting year",
    type: "CSRD",
    framework: "CSRD",
    jurisdiction: "EU",
    country: "EU",
    dueDate: "2026-01-31",
    scope: "size",
    severity: "high",
    description:
      "Internal freeze date for ESRS quantitative datapoints ahead of assurance and board review.",
    documentationUrl: "https://www.efrag.org/",
    organisationApplicability: {
      appliesTo: "all",
      euOperatingOnly: true,
      requireLargeUndertaking: true,
    },
    prerequisiteTasks: [
      { task: "Lock emission factors version", done: false },
      { task: "Close period datapoints", done: false },
    ],
  },
  {
    catalogKey: "global-cdp-climate",
    name: "CDP Climate Change questionnaire",
    type: "Other",
    framework: "OTHER",
    jurisdiction: "GLOBAL",
    country: "GLOBAL",
    dueDate: "2026-09-17",
    scope: "all",
    severity: "medium",
    description:
      "Voluntary CDP Climate Change response deadline (annual cycle — confirm current score timeline).",
    documentationUrl: "https://www.cdp.net/",
    organisationApplicability: { appliesTo: "all" },
    prerequisiteTasks: [
      { task: "Assign CDP questionnaire owners", done: false },
      { task: "Upload evidence to CDP portal", done: false },
    ],
  },
  {
    catalogKey: "taxonomy-turnover-kpi-audit",
    name: "Taxonomy turnover KPI internal audit",
    type: "Taxonomy",
    framework: "Taxonomy",
    jurisdiction: "EU",
    country: "EU",
    dueDate: "2026-02-28",
    scope: "size",
    severity: "medium",
    description:
      "Internal audit of Taxonomy turnover KPI calculation before external disclosure.",
    documentationUrl: "https://finance.ec.europa.eu/",
    organisationApplicability: {
      appliesTo: "size",
      minEmployeeCount: 250,
      euOperatingOnly: true,
    },
    prerequisiteTasks: [
      { task: "Reconcile turnover to financial statements", done: false },
    ],
  },
];

export async function ensureRegulatoryDeadlines(payload: Payload): Promise<{
  created: string[];
  existing: string[];
}> {
  const created: string[] = [];
  const existing: string[] = [];

  for (const seed of REGULATORY_DEADLINE_SEEDS) {
    const found = await payload.find({
      collection: "regulatory-deadlines",
      where: {
        and: [
          { catalogKey: { equals: seed.catalogKey } },
          { isCatalog: { equals: true } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });

    if (found.docs.length > 0) {
      existing.push(seed.catalogKey);
      continue;
    }

    await payload.create({
      collection: "regulatory-deadlines",
      data: {
        isCatalog: true,
        catalogKey: seed.catalogKey,
        name: seed.name,
        type: seed.type,
        framework: seed.framework,
        jurisdiction: seed.jurisdiction,
        country: seed.country,
        dueDate: seed.dueDate,
        scope: seed.scope,
        severity: seed.severity,
        description: seed.description,
        documentationUrl: seed.documentationUrl,
        status: "pending",
        organisationApplicability: seed.organisationApplicability,
        prerequisiteTasks: seed.prerequisiteTasks,
        colour: "default",
      },
      overrideAccess: true,
    });
    created.push(seed.catalogKey);
  }

  return { created, existing };
}
