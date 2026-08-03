/** Bank / buyer FAQ pack — linked from living report + Reports. */

export const BUYER_FAQ = [
  {
    q: "How did you calculate Scope 2?",
    a: "ClearESG always dual-reports Scope 2 per the GHG Protocol. Location-based = electricity × grid emission factor from the versioned registry for the reporting year and region. Market-based = contractual instruments (RECs, GOs, supplier-specific rates) for matched kWh, with unmatched kWh × residual-mix factor when the registry has one; otherwise the unmatched portion is marked missing — never silently zeroed or substituted with the location grid factor.",
  },
  {
    q: "Where is the evidence?",
    a: "Each material figure links to uploaded source documents in the evidence vault. Open any datapoint to see proof.",
  },
  {
    q: "Is this assured?",
    a: "ClearESG supports traceability for assurance. External assurance is a separate engagement — see your auditor disclaimer.",
  },
  {
    q: "How current is this report?",
    a: "A living report updates when you change datapoints. The trust strip shows last updated time and calculation context.",
  },
] as const;
