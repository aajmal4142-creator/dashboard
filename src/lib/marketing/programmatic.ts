export type SectorPage = {
  slug: string;
  name: string;
  nace: string;
  answer: string;
  focusTopics: string[];
  updatedAt: string;
};

export const CSRD_SECTORS: SectorPage[] = [
  {
    slug: "manufacturing",
    name: "Manufacturing",
    nace: "C",
    answer:
      "CSRD compliance for manufacturers centres on ESRS E1 climate (energy, fuels, process emissions), E2/E5 where chemicals or waste are material, and S1 workforce. Scope 3 purchased goods usually dominates once Tier-1 suppliers respond.",
    focusTopics: [
      "E1 Climate",
      "E5 Circular economy",
      "S1 Own workforce",
      "G1 Business conduct",
    ],
    updatedAt: "2026-07-01",
  },
  {
    slug: "logistics",
    name: "Logistics & transport",
    nace: "H",
    answer:
      "CSRD for logistics firms typically materials Scope 1 fleet fuels, Scope 2 depot electricity, and Scope 3 upstream/downstream transport. Double materiality almost always flags climate and own workforce safety.",
    focusTopics: ["E1 Climate", "S1 Own workforce", "S2 Workers in value chain"],
    updatedAt: "2026-07-01",
  },
  {
    slug: "professional-services",
    name: "Professional services",
    nace: "M",
    answer:
      "Professional services CSRD programmes are lighter on process emissions but still need Scope 2 office electricity, business travel Scope 3, and strong G1/S1 disclosures. Buyer questionnaires often arrive before formal CSRD scope.",
    focusTopics: ["E1 Climate", "S1 Own workforce", "G1 Business conduct"],
    updatedAt: "2026-07-01",
  },
];

export function sectorBySlug(slug: string): SectorPage | undefined {
  return CSRD_SECTORS.find((s) => s.slug === slug);
}

export type CompetitorPage = {
  slug: string;
  name: string;
  answer: string;
  whereTheyWin: string[];
  whereWeWin: string[];
  updatedAt: string;
};

export const COMPETITORS: CompetitorPage[] = [
  {
    slug: "workiva",
    name: "Workiva",
    answer:
      "Workiva is a strong enterprise reporting and controls platform. ClearESG is built for SMEs and boutique consultants who need ESRS-oriented collection, supplier chains, and a living report without a six-figure implementation.",
    whereTheyWin: [
      "Large-group SOX-style controls and multi-entity narrative publishing",
      "Deep finance/close integrations at enterprise scale",
    ],
    whereWeWin: [
      "60-second baseline → runway → supplier requests in one product flow",
      "Derivation layer that refuses fake raw→ESRS mappings",
      "Consultant command centre + white-label at SME price points",
    ],
    updatedAt: "2026-07-01",
  },
  {
    slug: "persefoni",
    name: "Persefoni",
    answer:
      "Persefoni is a carbon accounting platform aimed at larger organisations needing financed emissions and institutional workflows. ClearESG focuses on mandatory disclosure readiness for SMEs — materiality, evidence, PDF/living report — not financed emissions.",
    whereTheyWin: [
      "Financed emissions / PCAF-oriented workflows",
      "Institutional carbon programmes",
    ],
    whereWeWin: [
      "Double materiality workshop with audit trail",
      "Supplier request viral loop with expiry tokens",
      "Free tier with real calc and watermarked PDF only",
    ],
    updatedAt: "2026-07-01",
  },
  {
    slug: "greenly",
    name: "Greenly",
    answer:
      "Greenly offers accessible carbon footprinting for SMEs. ClearESG overlaps on emissions but adds CSRD-oriented materiality, consultant multi-client tooling, living reports, and a hard n≥8 benchmark gate.",
    whereTheyWin: [
      "Fast consumer-grade carbon footprint UX",
      "Broad SMB brand recognition in some EU markets",
    ],
    whereWeWin: [
      "Editorial report layout with monospaced measurement discipline",
      "Dual CSRD depth + BRSR-readiness / value-chain response",
      "Consultant multi-tenant + evidence/factor defensibility",
    ],
    updatedAt: "2026-07-01",
  },
  {
    slug: "envizi",
    name: "IBM Envizi",
    answer:
      "IBM Envizi is an enterprise ESG data platform priced on facilities and account volume — Essential often quotes near USD 90k+/yr for a handful of sites. ClearESG targets the same collect → evidence → Scope 3 → publish job for SMEs and consultants at self-serve prices.",
    whereTheyWin: [
      "High data-volume / multi-facility enterprise ingestion",
      "ERP-adjacent deployments and IBM sales channel",
      "Assurance-oriented programmes at large-org scale",
    ],
    whereWeWin: [
      "Time-to-report this quarter at €0/€49/€199",
      "Supplier tokens + consultant white-label",
      "Governance (evidence, factors, approval) built for teams without a sustainability department",
    ],
    updatedAt: "2026-07-21",
  },
  {
    slug: "novisto",
    name: "Novisto",
    answer:
      "Novisto is an enterprise sustainability data system with strong assignment and multi-framework breadth. ClearESG is the audit-ready-this-quarter alternative for single-entity SMEs and boutique consultants.",
    whereTheyWin: [
      "Enterprise multi-framework breadth and assignment workflows at scale",
      "Global 2000-oriented implementations",
    ],
    whereWeWin: [
      "SME price and guided runway",
      "Consultant channel with pre-branded client invites",
      "Deterministic evidence/factor traversal without enterprise implementation",
    ],
    updatedAt: "2026-07-21",
  },
  {
    slug: "sweep",
    name: "Sweep",
    answer:
      "Sweep serves multi-entity enterprise carbon and ESG programmes. ClearESG wins where the buyer is a single-entity SME or a consultant running many SME clients — not JV consolidation or financed emissions.",
    whereTheyWin: [
      "Multi-entity groups, JVs, carve-outs, financed emissions",
      "Broad framework catalogue",
    ],
    whereWeWin: [
      "Single-entity SME focus and price",
      "Consultant command centre",
      "Approval + anomaly + gap analysis sized for non-experts",
    ],
    updatedAt: "2026-07-21",
  },
];

export function competitorBySlug(slug: string): CompetitorPage | undefined {
  return COMPETITORS.find((c) => c.slug === slug);
}

export type BrsrSectorPage = {
  slug: string;
  name: string;
  answer: string;
  focusTopics: string[];
  updatedAt: string;
};

/** BRSR-readiness framing — not “file your BRSR” until XBRL tagging exists. */
export const BRSR_SECTORS: BrsrSectorPage[] = [
  {
    slug: "manufacturing",
    name: "Manufacturing",
    answer:
      "Most Indian manufacturers encounter BRSR as a value-chain request from a listed customer, not as a direct SEBI filer. ClearESG helps collect evidenced energy, waste, workforce, and supplier data so you can respond defensibly — BRSR-readiness and value-chain response, not a claim of filing-ready XBRL.",
    focusTopics: [
      "Principle 6 (environment)",
      "Energy and GHG activity data",
      "Value-chain supplier response",
      "Evidence trail",
    ],
    updatedAt: "2026-07-21",
  },
  {
    slug: "logistics",
    name: "Logistics & transport",
    answer:
      "Logistics SMEs on listed-company supply chains are asked for fleet fuel, depot electricity, and safety metrics. Treat these as operational questionnaires first; use ClearESG to map answers to BRSR-readiness datapoints with evidence.",
    focusTopics: [
      "Fleet fuels",
      "Depot electricity",
      "Safety / workforce",
      "Scope 3 requests",
    ],
    updatedAt: "2026-07-21",
  },
  {
    slug: "professional-services",
    name: "Professional services",
    answer:
      "Professional-services suppliers usually face lighter environmental asks but still need office electricity, travel, and governance answers for buyer questionnaires cascading from BRSR reporters.",
    focusTopics: [
      "Office energy",
      "Business travel",
      "Governance disclosures",
      "Buyer questionnaires",
    ],
    updatedAt: "2026-07-21",
  },
];

export function brsrSectorBySlug(slug: string): BrsrSectorPage | undefined {
  return BRSR_SECTORS.find((s) => s.slug === slug);
}

export type DeadlinePage = {
  slug: string;
  country: string;
  iso: string;
  answer: string;
  notes: string[];
  updatedAt: string;
};

export const DEADLINES: DeadlinePage[] = [
  {
    slug: "ie",
    country: "Ireland",
    iso: "IE",
    answer:
      "Ireland-transposed CSRD obligations follow EU wave timing for large undertakings and listed entities. Exact filing calendars depend on financial year end and whether the entity is in wave 1, 2, or later SME waves — verify against IAASA / Companies Registration Office guidance for the reporting year.",
    notes: [
      "Use fiscal year end + wave membership to compute days-to-filing in ClearESG Runway.",
      "Value-chain questionnaires can arrive earlier than statutory filing.",
    ],
    updatedAt: "2026-07-01",
  },
  {
    slug: "de",
    country: "Germany",
    iso: "DE",
    answer:
      "Germany implements CSRD via national law aligning with EU waves. Large German undertakings in early waves face ESRS reporting with auditor assurance requirements escalating over time. Check the current HGB / CSRD transposition text for your size class.",
    notes: [
      "Manufacturers often materialise E1 and S1 first.",
      "ClearESG deadlines/[country] pages are guidance, not legal advice.",
    ],
    updatedAt: "2026-07-01",
  },
  {
    slug: "in",
    country: "India",
    iso: "IN",
    answer:
      "India's primary listed-company ESG format is BRSR (SEBI) for the top listed cohort, filed in machine-readable XBRL. Most ClearESG India buyers are value-chain suppliers receiving BRSR-shaped data requests — not direct filers. Market the product as BRSR-readiness + value-chain response until native XBRL tagging ships.",
    notes: [
      "INR / Razorpay billing remains a WS0 open decision before India paid launch.",
      "Treat buyer questionnaires as operational deadlines.",
      "Decide Atlas region for DPDP before provisioning production Mongo.",
    ],
    updatedAt: "2026-07-01",
  },
];

export function deadlineBySlug(slug: string): DeadlinePage | undefined {
  return DEADLINES.find((d) => d.slug === slug);
}
