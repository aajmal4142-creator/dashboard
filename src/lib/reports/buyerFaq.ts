/** Bank / buyer FAQ pack — linked from living report + Reports. */

export const BUYER_FAQ = [
  {
    q: "How did you calculate Scope 2?",
    a: "Location-based electricity × grid emission factor from the versioned factor registry for the reporting year and region.",
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
