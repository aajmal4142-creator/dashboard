export type AnswerPage = {
  slug: string;
  question: string;
  /** 40–60 word standalone answer under the H1 */
  answer: string;
  sections: Array<{ h2: string; body: string }>;
  related: string[];
  updatedAt: string;
};

export const ANSWERS: AnswerPage[] = [
  {
    slug: "does-csrd-apply-outside-eu",
    question: "Does CSRD apply to companies outside the EU?",
    answer:
      "Direct CSRD obligations target EU companies (and some non-EU groups with substantial EU turnover and an EU subsidiary/branch). Non-EU SMEs are often pulled in indirectly when EU buyers, banks, or consultants demand ESRS-aligned data from their value chain.",
    sections: [
      {
        h2: "Who is directly in scope?",
        body: "Large EU undertakings and listed SMEs enter in waves defined by employee count, balance sheet, and turnover thresholds. Exact thresholds and dates should be checked against the latest Commission / national transposition text — regulations change.",
      },
      {
        h2: "How do non-EU suppliers get affected?",
        body: "Scope 3 and value-chain due diligence push questionnaires downstream. A manufacturer in India or the UK selling into an EU group commonly receives requests for energy, emissions, and social metrics even if CSRD does not name them.",
      },
      {
        h2: "What should a non-EU SME do first?",
        body: "Map who is asking (buyer vs bank vs consultant), collect activity data for electricity and fuels, and run a double-materiality starter. ClearESG's free CSRD scope checker and Scope 2 calculator are ungated for that first pass.",
      },
    ],
    related: ["what-is-double-materiality", "csrd-filing-deadline-uk"],
    updatedAt: "2026-07-01",
  },
  {
    slug: "what-is-double-materiality",
    question: "What is double materiality in CSRD?",
    answer:
      "Double materiality combines impact materiality (outward effects on people and planet) and financial materiality (inward effects on enterprise value). Under ESRS, a sustainability topic is material if either dimension clears the threshold — not only if investors care.",
    sections: [
      {
        h2: "How do you score it?",
        body: "Impact scores usually combine severity, scope, and irremediability. Financial scores combine magnitude and likelihood. Document rationale; auditors look for process evidence, not just a coloured matrix.",
      },
      {
        h2: "Is climate always material?",
        body: "For most manufacturers and logistics firms, ESRS E1 climate is material on at least one side. Still score it formally — do not assume.",
      },
    ],
    related: ["does-csrd-apply-outside-eu"],
    updatedAt: "2026-07-01",
  },
  {
    slug: "csrd-filing-deadline-uk",
    question: "What is the CSRD filing deadline for UK companies?",
    answer:
      "The UK is not an EU member state, so CSRD does not apply as EU law. UK companies may still face EU CSRD pressure via EU parents, customers, or branch/turnover tests, and separately face UK SDR / ISSB-aligned reporting timelines as those regimes finalise.",
    sections: [
      {
        h2: "Practical takeaway",
        body: "Treat EU buyer questionnaires as real deadlines even when UK statute is still settling. Track each customer's request date rather than a single national CSRD clock.",
      },
    ],
    related: ["does-csrd-apply-outside-eu"],
    updatedAt: "2026-07-01",
  },
  {
    slug: "how-to-calculate-scope-2",
    question: "How do I calculate Scope 2 emissions from electricity?",
    answer:
      "Multiply metered kWh by a location-based grid emission factor for the region and year (tCO2e/kWh), then sum. Market-based Scope 2 uses contractual instruments (e.g. GOs/RECs) where allowed. Always record the factor source and year.",
    sections: [
      {
        h2: "Location-based vs market-based",
        body: "ESRS E1 expects both where relevant. Start with location-based if you only have bills; add market-based when you have contractual evidence.",
      },
      {
        h2: "Try it ungated",
        body: "Use ClearESG's Scope 2 calculator — enter kWh and region, get tCO2e with the cited factor. Save and track over time in the app when ready.",
      },
    ],
    related: ["does-csrd-apply-outside-eu"],
    updatedAt: "2026-07-01",
  },
];

export function answerBySlug(slug: string): AnswerPage | undefined {
  return ANSWERS.find((a) => a.slug === slug);
}
