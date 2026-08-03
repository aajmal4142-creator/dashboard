import type { FaqItem } from "@/lib/help/types";

export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    id: "what-is-clearesg",
    question: "What does ClearESG do?",
    answer:
      "ClearESG is an emissions and disclosure workspace: enter metrics, calculate with registry factors, and publish living reports for frameworks such as CSRD/ESRS and BRSR-readiness.",
    tags: ["overview", "product"],
  },
  {
    id: "login-vs-access",
    question: "Why can I sign in but not see an organisation?",
    answer:
      "Clerk handles identity; Payload Membership handles authorisation. Login is not access — you need a Membership for an organisation, then select it in the org switcher.",
    tags: ["auth", "membership"],
  },
  {
    id: "missing-quality",
    question: "Why is a metric marked missing instead of zero?",
    answer:
      "Missing data is quality missing, never silently zero. Enter a measured or estimated value, or leave it missing until you have evidence.",
    tags: ["metrics", "quality"],
  },
  {
    id: "how-to-publish",
    question: "How do I publish a report?",
    answer:
      "Open Reports, generate a draft, review gaps, then publish. Published versions are locked. Use the Reports tour from Help for a walkthrough.",
    tags: ["reports", "publish"],
  },
  {
    id: "shortcuts",
    question: "Where are keyboard shortcuts?",
    answer:
      "Press Cmd/Ctrl+/ to open Help, then the Shortcuts tab. Common chords: Cmd/Ctrl+K search, N metrics, R reports, \\ sidebar.",
    tags: ["shortcuts", "keyboard"],
  },
  {
    id: "theme",
    question: "How do I switch light and dark theme?",
    answer:
      "Use the theme toggle in the shell footer. Theme is stored in the clearesg-theme cookie only — it is never inferred from system preference.",
    tags: ["theme", "settings"],
  },
  {
    id: "first-report",
    question: "How do I get from empty to a first report?",
    answer:
      "Open Guide in the nav for the checklist: sector, baseline, top metrics, one supplier, then publish. Onboarding wizard runs once for first-time org setup.",
    tags: ["guide", "onboarding"],
  },
  {
    id: "assurance",
    question: "Does ClearESG provide assurance?",
    answer:
      "No. ClearESG is not an assurance provider. From Assurance or Reports you can download an evidence pack (emissions, factors, gaps, lineage pointers) for your auditor. Browse assurance partners when you need an opinion.",
    tags: ["assurance", "reports", "evidence"],
  },
  {
    id: "evidence-pack",
    question: "What is the evidence pack download?",
    answer:
      "One-click ZIP of PDF + CSV for board or assurance hand-off: Scope 1/2/3 (dual Scope 2 when present), missing-data register, pinned factor versions, evidence IDs/links, and approval/lock summary. It is not an audience report pack and not an audit opinion.",
    tags: ["assurance", "evidence", "export"],
  },
  {
    id: "email-import",
    question: "How do suppliers or site managers email data in?",
    answer:
      "Open Integrations → Email import. Create a form, set it active, enable inbound, and whitelist senders. Share the inbound address (import+TOKEN@…) and ask them to put [ClearESG:TOKEN] in the subject with a CSV attachment (metricKey,value,unit,quality). Non-whitelisted mail is rejected. Dry-run from the same page before applying.",
    tags: ["email", "import", "suppliers", "csv"],
  },
  {
    id: "multi-entity-consolidation",
    question: "How do I consolidate subsidiary emissions?",
    answer:
      "Under Settings → Org hierarchy, set an explicit consolidation parent, method (full / proportional / equity), and ownership %. On Reports, turn on Include subsidiaries. Totals sum measured entities only — missing subsidiaries are listed with quality missing, never rolled up as silent zeros. Single-entity orgs are unchanged when the toggle is off.",
    tags: ["reports", "consolidation", "subsidiaries", "hierarchy"],
  },
] as const;

export function filterFaq(query: string): FaqItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...FAQ_ITEMS];
  return FAQ_ITEMS.filter((item) => {
    const hay = `${item.question} ${item.answer} ${item.tags.join(" ")}`.toLowerCase();
    return hay.includes(q);
  });
}
