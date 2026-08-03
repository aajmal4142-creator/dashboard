import type { ContextTip } from "@/lib/help/types";

const DEFAULT_TIP: ContextTip = {
  title: "ClearESG",
  tips: [
    "Press Cmd/Ctrl+/ for Help (shortcuts, tours, FAQ).",
    "Cmd/Ctrl+K opens search across metrics, reports, and settings.",
    "Open Guide for the first-report checklist.",
  ],
};

/** Pathname → contextual tips for the Help center. */
const TIPS: { match: (path: string) => boolean; tip: ContextTip }[] = [
  {
    match: (p) => p === "/data" || p.startsWith("/data/"),
    tip: {
      title: "Metrics workspace",
      tips: [
        "Enter figures for the open period; quality missing means no silent zeros.",
        "Cmd/Ctrl+S saves the active datapoint while editing.",
        "Spreadsheet import is an on-ramp — interactive entry is the product.",
      ],
      relatedTourId: "data-workspace",
    },
  },
  {
    match: (p) => p === "/reports" || p.startsWith("/reports/"),
    tip: {
      title: "Reports",
      tips: [
        "Drafts regenerate from live data; publish locks an immutable final.",
        "Export PDF, HTML, and machine formats from published rows.",
        "Include subsidiaries rolls up linked entities — measured only; missing stays missing.",
        "Download evidence pack for board or auditor hand-off (ZIP of PDF + CSV).",
        "ClearESG does not provide assurance or audit opinions.",
      ],
      relatedTourId: "reports",
    },
  },
  {
    match: (p) => p === "/assurance" || p.startsWith("/assurance/"),
    tip: {
      title: "Assurance Room",
      tips: [
        "Lineage is read-only against the latest published snapshot — factors stay pinned.",
        "Download evidence pack assembles emissions, gaps, factor versions, and evidence IDs.",
        "Open /assurance/engagements for limited vs reasonable pathway checklists.",
        "ClearESG is not an assurance provider; browse partners when you need an opinion.",
      ],
    },
  },
  {
    match: (p) => p.startsWith("/settings/org-hierarchy"),
    tip: {
      title: "Org hierarchy",
      tips: [
        "Set an explicit consolidation parent — never inferred from consultancy parentOrg.",
        "Full, proportional, or equity method; ownership % scales along the path.",
        "Preview and Reports → Include subsidiaries sum measured entities only; missing stays missing.",
      ],
    },
  },
  {
    match: (p) => p === "/settings" || p.startsWith("/settings/"),
    tip: {
      title: "Settings",
      tips: [
        "Language preference is stored on your user account.",
        "Branding tokens apply to the app shell and supplier portal.",
        "Org hierarchy links subsidiaries for consolidated reports — missing data never rolls up as zero.",
        "Emission factors, validation rules, and custom metrics open from the sections below.",
        "Missing factor keys still throw in calc — the factor admin does not invent defaults.",
      ],
      relatedTourId: "settings",
    },
  },
  {
    match: (p) => p === "/guide" || p.startsWith("/guide/"),
    tip: {
      title: "Getting started guide",
      tips: [
        "Steps complete when the work is done; you can also tick them manually.",
        "Next incomplete step links into Metrics, Suppliers, or Reports.",
      ],
    },
  },
  {
    match: (p) => p === "/developers" || p.startsWith("/developers/"),
    tip: {
      title: "Developer API",
      tips: [
        "Browse curated ingest, BI, webhook, and factor endpoints for your organisation.",
        "Manage BI API keys under Settings. Try sample GETs in the sandbox.",
        "Docs are behind login; mutations still require Membership server-side.",
      ],
    },
  },
  {
    match: (p) => p === "/suppliers" || p.startsWith("/suppliers/"),
    tip: {
      title: "Suppliers",
      tips: [
        "Add a supplier, send a questionnaire, then review responses.",
        "Risk and supply-chain views live under Collaborate in the nav.",
      ],
    },
  },
  {
    match: (p) => p.startsWith("/operations/waste-water"),
    tip: {
      title: "Waste & water",
      tips: [
        "Enter operational waste and water by period; blank means not tracked, not zero.",
        "Cat 5 GHG appears only when landfill/recycling factors are seeded.",
        "Open Metrics for the full grid, including employees_total for water intensity.",
      ],
    },
  },
  {
    match: (p) => p === "/" || p === "",
    tip: {
      title: "Runway",
      tips: [
        "The gauge summarises readiness for the open period.",
        "Use Help tours for Metrics, Reports, and Settings walkthroughs.",
      ],
    },
  },
  {
    match: (p) => p.startsWith("/onboarding"),
    tip: {
      title: "Onboarding",
      tips: [
        "Complete sector and baseline once; this wizard is separate from Help tours.",
        "After onboarded, the Guide checklist covers first-report steps.",
      ],
    },
  },
  {
    match: (p) => p.startsWith("/analytics"),
    tip: {
      title: "Analytics",
      tips: [
        "Compare YoY, by department, supplier, or metric under Compare.",
        "Pathway and scenario tools sit alongside peer benchmarks.",
        "Multi-entity roll-ups live on Reports → Include subsidiaries (measured only; missing stays missing).",
      ],
    },
  },
  {
    match: (p) => p === "/social" || p.startsWith("/social/"),
    tip: {
      title: "Social metrics",
      tips: [
        "Coverage maps workforce, H&S, training, fair pay, and labour indicators to Metrics keys.",
        "Unmapped rows (living wage, pay gap, turnover) stay gaps until metrics ship.",
        "Enter values in Metrics or via the social values API for mapped keys only.",
      ],
    },
  },
  {
    match: (p) => p === "/engagement" || p.startsWith("/engagement/"),
    tip: {
      title: "Employee engagement",
      tips: [
        "Create campaigns with a participant count or tCO₂e goal — missing goals show quality missing, never silent zero.",
        "Record participation with +1; optional commute challenges link to Scope 3 travel & commute.",
        "No WhatsApp BSP or paid HRIS — organisers track counts in ClearESG only.",
      ],
    },
  },
  {
    match: (p) =>
      p.startsWith("/integrations/email-import") || p === "/integrations/email-import",
    tip: {
      title: "Email data collection",
      tips: [
        "Share import+TOKEN@… and [ClearESG:TOKEN] in the subject with site managers and suppliers.",
        "Whitelist every sender; attach CSV with metricKey,value,unit,quality.",
        "Use dry-run before Apply. Live inbound rejects non-whitelisted mail automatically.",
        "Internal requests and supplier engagement are alternatives when email is not suitable.",
      ],
    },
  },
];

export function getContextTip(pathname: string): ContextTip {
  const path = pathname.split("?")[0] ?? pathname;
  for (const entry of TIPS) {
    if (entry.match(path)) return entry.tip;
  }
  return DEFAULT_TIP;
}
