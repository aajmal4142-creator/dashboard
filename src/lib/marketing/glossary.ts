export type GlossaryTerm = {
  slug: string;
  term: string;
  /** 40–60 word answer-first lead */
  answer: string;
  body: string[];
  related: string[];
  updatedAt: string;
};

export const GLOSSARY: GlossaryTerm[] = [
  {
    slug: "scope-3",
    term: "Scope 3",
    answer:
      "Scope 3 covers indirect GHG emissions in a company's value chain — purchased goods, transport, waste, travel, and use of sold products. Under CSRD/ESRS E1 it is usually the largest share of a company's footprint and the hardest to measure without supplier data.",
    body: [
      "The GHG Protocol splits Scope 3 into 15 categories. Most SMEs start with purchased goods and services, upstream transport, business travel, and waste.",
      "ClearESG collects supplier-reported tCO2e via branded request links and rolls responses into Scope 3 without inventing zeros for missing suppliers.",
    ],
    related: ["double-materiality", "esrs-e1", "csrd"],
    updatedAt: "2026-07-01",
  },
  {
    slug: "double-materiality",
    term: "Double materiality",
    answer:
      "Double materiality means assessing both impact materiality (how the company affects people and the environment) and financial materiality (how sustainability topics affect the company's cash flows and enterprise value). CSRD requires both lenses; a topic is in-scope if either side is material.",
    body: [
      "ESRS 1 sets the process. Impact scores typically combine severity, scope, and irremediability. Financial scores combine magnitude and likelihood.",
      "ClearESG's materiality workshop stores scores with an audit trail and writes a narrative from the matrix — not marketing copy.",
    ],
    related: ["csrd", "esrs-e1", "scope-3"],
    updatedAt: "2026-07-01",
  },
  {
    slug: "esrs-e1",
    term: "ESRS E1",
    answer:
      "ESRS E1 is the European Sustainability Reporting Standard on climate change. It covers GHG emissions (Scopes 1–3), energy, transition plans, and climate-related risks and opportunities. It is the most commonly material environmental topic for manufacturing and logistics SMEs.",
    body: [
      "E1 datapoints are numerous; ClearESG maps collected activity data through a derivation layer rather than forcing raw meter readings into ESRS codes 1:1.",
      "Emission factors come from a versioned registry with source and year — never silent fallbacks.",
    ],
    related: ["csrd", "scope-3", "emission-factor"],
    updatedAt: "2026-07-01",
  },
  {
    slug: "csrd",
    term: "CSRD",
    answer:
      "The Corporate Sustainability Reporting Directive (CSRD) is the EU law requiring in-scope companies to publish sustainability information under the ESRS. Timing depends on size and listing status; many large companies report from FY2024/25, with later waves for listed SMEs and value-chain pressure on non-EU suppliers.",
    body: [
      "Even companies outside direct CSRD scope often receive questionnaires from banks, buyers, and consultants who are in scope.",
      "ClearESG targets that pressure: collect once, derive ESRS views, publish a living report link.",
    ],
    related: ["double-materiality", "esrs-e1", "vsme"],
    updatedAt: "2026-07-01",
  },
  {
    slug: "emission-factor",
    term: "Emission factor",
    answer:
      "An emission factor converts activity data (kWh, litres, tonnes-km) into greenhouse gas emissions (usually tCO2e). Factors are region- and year-specific. Using the wrong grid factor or an outdated DEFRA row is a common audit finding.",
    body: [
      "ClearESG resolves factors from a registry with a documented ladder. Missing factors throw — they never silently become zero.",
      "Sources include open datasets (e.g. DEFRA). Licensed commercial factors are flagged before commercial redistribution.",
    ],
    related: ["scope-3", "esrs-e1"],
    updatedAt: "2026-07-01",
  },
  {
    slug: "vsme",
    term: "VSME",
    answer:
      "The Voluntary ESRS for SMEs (VSME) is a lighter sustainability reporting standard for companies not yet in mandatory CSRD waves. It is designed to answer buyer and bank requests without the full Set 1 datapoint load.",
    body: [
      "ClearESG can publish CSRD Simplified / VSME-oriented snapshots while keeping Datapoint storage framework-agnostic.",
    ],
    related: ["csrd", "brsr"],
    updatedAt: "2026-07-01",
  },
  {
    slug: "brsr",
    term: "BRSR",
    answer:
      "Business Responsibility and Sustainability Reporting (BRSR) is India's SEBI-mandated ESG disclosure format for listed companies, organised around nine principles. Value-chain partners of BRSR reporters increasingly face informal data requests.",
    body: [
      "ClearESG keeps BRSR as a view over datapoints. India pricing (INR / Razorpay) remains an open product decision before Phase 12 commercialisation there.",
    ],
    related: ["csrd", "vsme"],
    updatedAt: "2026-07-01",
  },
];

export function glossaryBySlug(slug: string): GlossaryTerm | undefined {
  return GLOSSARY.find((t) => t.slug === slug);
}
