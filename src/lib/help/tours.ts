import type { TourDefinition } from "@/lib/help/types";

/** Guided tours for major flows — targets use `[data-tour="…"]`. */
export const TOURS: readonly TourDefinition[] = [
  {
    id: "data-workspace",
    title: "Metrics workspace",
    description: "Enter figures interactively, switch modes, and check validation rules.",
    routePrefix: "/data",
    steps: [
      {
        id: "intro",
        title: "Metrics workspace",
        body: "This is where you enter emissions and activity data for the open reporting period. Interactive entry is the spine; spreadsheet import is an on-ramp.",
        target: "metrics-header",
      },
      {
        id: "modes",
        title: "Entry modes",
        body: "Use Enter here for row-by-row edits, or Use a spreadsheet to import a template. Duplicate prior structure copies last period’s metric list.",
        target: "metrics-mode",
      },
      {
        id: "table",
        title: "Metric rows",
        body: "Search, set quality and evidence, then save each row. Cmd/Ctrl+S saves the focused datapoint when editing.",
        target: "metrics-table",
      },
      {
        id: "coverage",
        title: "Framework coverage",
        body: "Coverage chips show which disclosure cells have data for your applicable frameworks.",
        target: "metrics-coverage",
      },
    ],
  },
  {
    id: "reports",
    title: "Reports & publish",
    description: "Generate drafts, publish locked finals, and export machine formats.",
    routePrefix: "/reports",
    steps: [
      {
        id: "intro",
        title: "Publish flow",
        body: "Generate regenerable drafts from live data, then publish a locked final. Published versions are immutable. ClearESG is not an assurance provider.",
        target: "reports-header",
      },
      {
        id: "actions",
        title: "Generate and publish",
        body: "Generate a CSRD draft to review gaps, then publish CSRD or BRSR-readiness when ready. Viewers cannot publish.",
        target: "reports-actions",
      },
      {
        id: "drafts",
        title: "Drafts",
        body: "Drafts regenerate from live metrics. Review gaps and approval state before locking a final.",
        target: "reports-drafts",
      },
      {
        id: "published",
        title: "Published versions",
        body: "Published reports are immutable. Export PDF, HTML, CSV, XLSX, JSON, or XML from the actions on each row.",
        target: "reports-published",
      },
    ],
  },
  {
    id: "settings",
    title: "Organisation settings",
    description: "Language, branding, portal, emissions standard, and related controls.",
    routePrefix: "/settings",
    steps: [
      {
        id: "intro",
        title: "Settings",
        body: "Organisation branding, supplier portal, emissions methodology, and BI API keys live here. Marketing site branding is separate.",
        target: "settings-header",
      },
      {
        id: "language",
        title: "Language",
        body: "Choose the interface language for your account. The preference is stored on your user record.",
        target: "settings-language",
      },
      {
        id: "theme",
        title: "Branding",
        body: "Set accent colour, logo, and related white-label tokens for the app shell and portal.",
        target: "settings-theme",
      },
      {
        id: "links",
        title: "Related settings",
        body: "Org hierarchy, custom metrics, validation rules, and alert thresholds open from the sections below.",
        target: "settings-related",
      },
    ],
  },
] as const;

export function tourById(id: string): TourDefinition | undefined {
  return TOURS.find((t) => t.id === id);
}

export function toursForPath(pathname: string): TourDefinition[] {
  return TOURS.filter(
    (t) => pathname === t.routePrefix || pathname.startsWith(`${t.routePrefix}/`),
  );
}
