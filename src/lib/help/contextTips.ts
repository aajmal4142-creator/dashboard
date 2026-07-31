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
        "ClearESG does not provide assurance or audit opinions.",
      ],
      relatedTourId: "reports",
    },
  },
  {
    match: (p) => p === "/settings" || p.startsWith("/settings/"),
    tip: {
      title: "Settings",
      tips: [
        "Language preference is stored on your user account.",
        "Branding tokens apply to the app shell and supplier portal.",
        "Validation rules and custom metrics open from the sections below.",
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
