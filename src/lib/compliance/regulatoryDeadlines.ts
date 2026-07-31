import { getPayload } from "payload";

import config from "@/payload.config";
import { parseRevenueBand } from "@/lib/obligations";
import {
  calculateDaysRemaining,
  isDeadlineApplicable,
  isUrgentDeadline,
  isWithinUpcomingWindow,
  toApiStatus,
  toStoredStatus,
  type ApiDeadlineStatus,
  type DeadlineApplicabilityRule,
  type OrgDeadlineProfile,
  type StoredDeadlineStatus,
  UPCOMING_WINDOW_DAYS,
} from "./deadlineApplicability";

export type DeadlineType = "CSRD" | "ISSB" | "SBTi" | "Taxonomy" | "Other";
export type DeadlineSeverity = "critical" | "high" | "medium";

export type PrerequisiteTask = {
  id?: string;
  task: string;
  done: boolean;
};

export type DeadlineDetails = {
  id: string;
  catalogKey?: string;
  name: string;
  description?: string;
  documentationUrl?: string;
  type: DeadlineType;
  jurisdiction: string;
  country?: string;
  framework: string;
  dueDate: string;
  scope: string;
  severity: DeadlineSeverity;
  status: ApiDeadlineStatus;
  storedStatus: string;
  colour: string;
  daysRemaining: number;
  urgent: boolean;
  prerequisiteTasks: PrerequisiteTask[];
  linkedReport?: string;
  completedDate?: string;
  submittedDate?: string;
  verifiedDate?: string;
  verifiedBy?: string;
  notificationsSent: Array<{
    daysUntilDeadline: number;
    sentAt?: string;
    retryCount?: number;
    status?: string;
  }>;
  tags?: Array<{ tag: string }>;
  recurrenceRule?: string;
  isCatalog?: boolean;
};

export type CalendarView = {
  year: number;
  month: number;
  days: Array<{
    date: string;
    deadlines: DeadlineDetails[];
    isToday: boolean;
    isOverdue: boolean;
  }>;
};

export type ListViewOptions = {
  view: "upcoming" | "overdue" | "all" | "today";
  jurisdiction?: string;
  framework?: string;
  status?: string;
  searchQuery?: string;
};

type CatalogDoc = {
  id: string;
  catalogKey?: string | null;
  name: string;
  description?: string | null;
  documentationUrl?: string | null;
  type?: string | null;
  jurisdiction: string;
  country?: string | null;
  framework: string;
  dueDate: string;
  scope?: string | null;
  severity?: string | null;
  status: string;
  colour?: string | null;
  organisationApplicability?: {
    appliesTo?: string | null;
    countries?: Array<{ code?: string | null } | null> | null;
    industries?: Array<{ nacePrefix?: string | null } | null> | null;
    minEmployeeCount?: number | null;
    maxEmployeeCount?: number | null;
    revenueBands?: string[] | null;
    euOperatingOnly?: boolean | null;
    requireLargeUndertaking?: boolean | null;
  } | null;
  prerequisiteTasks?: Array<{
    id?: string | null;
    task?: string | null;
    done?: boolean | null;
  } | null> | null;
  linkedReport?: string | { id: string } | null;
  completedDate?: string | null;
  submittedDate?: string | null;
  verifiedDate?: string | null;
  verifiedBy?: string | { id: string } | null;
  notificationsSent?: Array<{
    daysUntilDeadline?: number | null;
    sentAt?: string | null;
    retryCount?: number | null;
    status?: string | null;
  } | null> | null;
  tags?: Array<{ tag?: string | null } | null> | null;
  recurrenceRule?: string | null;
  isCatalog?: boolean | null;
  organisation?: string | { id: string } | null;
};

function relationId(
  value: string | { id: string } | null | undefined,
): string | undefined {
  if (!value) return undefined;
  return typeof value === "string" ? value : value.id;
}

function asType(value: string | null | undefined, framework: string): DeadlineType {
  if (
    value === "CSRD" ||
    value === "ISSB" ||
    value === "SBTi" ||
    value === "Taxonomy" ||
    value === "Other"
  ) {
    return value;
  }
  if (framework === "CSRD" || framework === "ISSB" || framework === "SBTi") {
    return framework;
  }
  if (framework === "Taxonomy") return "Taxonomy";
  return "Other";
}

function asSeverity(value: string | null | undefined): DeadlineSeverity {
  if (value === "critical" || value === "high" || value === "medium") return value;
  return "medium";
}

type RevenueBandValue = "lt_2m" | "2_10m" | "10_50m" | "50_250m" | "gt_250m";
type ColourValue = "green" | "yellow" | "red" | "blue" | "gray" | "default";

function filterRevenueBands(
  bands: string[] | null | undefined,
): RevenueBandValue[] | undefined {
  if (!bands || bands.length === 0) return undefined;
  const allowed = new Set<RevenueBandValue>([
    "lt_2m",
    "2_10m",
    "10_50m",
    "50_250m",
    "gt_250m",
  ]);
  const out = bands.filter((b): b is RevenueBandValue =>
    allowed.has(b as RevenueBandValue),
  );
  return out.length > 0 ? out : undefined;
}

function asColour(value: string | null | undefined): ColourValue {
  if (
    value === "green" ||
    value === "yellow" ||
    value === "red" ||
    value === "blue" ||
    value === "gray" ||
    value === "default"
  ) {
    return value;
  }
  return "default";
}

function mapApplicability(
  group: CatalogDoc["organisationApplicability"],
  scopeFallback: string | null | undefined,
): DeadlineApplicabilityRule {
  return {
    appliesTo:
      (group?.appliesTo as DeadlineApplicabilityRule["appliesTo"]) ??
      (scopeFallback as DeadlineApplicabilityRule["appliesTo"]) ??
      "all",
    countries: (group?.countries ?? [])
      .filter((c): c is { code: string } => Boolean(c?.code))
      .map((c) => ({ code: c.code })),
    industries: (group?.industries ?? [])
      .filter((i): i is { nacePrefix: string } => Boolean(i?.nacePrefix))
      .map((i) => ({ nacePrefix: i.nacePrefix })),
    minEmployeeCount: group?.minEmployeeCount ?? null,
    maxEmployeeCount: group?.maxEmployeeCount ?? null,
    revenueBands: group?.revenueBands ?? null,
    euOperatingOnly: group?.euOperatingOnly ?? false,
    requireLargeUndertaking: group?.requireLargeUndertaking ?? false,
  };
}

function mapTasks(tasks: CatalogDoc["prerequisiteTasks"]): PrerequisiteTask[] {
  return (tasks ?? [])
    .filter((t): t is { task: string; done?: boolean | null; id?: string | null } =>
      Boolean(t?.task),
    )
    .map((t) => ({
      id: t.id ?? undefined,
      task: t.task,
      done: Boolean(t.done),
    }));
}

function enrichDoc(doc: CatalogDoc, asOf: Date): DeadlineDetails {
  const days = calculateDaysRemaining(doc.dueDate, asOf);
  return {
    id: doc.id,
    catalogKey: doc.catalogKey ?? undefined,
    name: doc.name,
    description: doc.description ?? undefined,
    documentationUrl: doc.documentationUrl ?? undefined,
    type: asType(doc.type, doc.framework),
    jurisdiction: doc.jurisdiction,
    country: doc.country ?? undefined,
    framework: doc.framework,
    dueDate: doc.dueDate.slice(0, 10),
    scope: doc.scope ?? "all",
    severity: asSeverity(doc.severity),
    status: toApiStatus(doc.status),
    storedStatus: doc.status,
    colour: doc.colour ?? "default",
    daysRemaining: days,
    urgent: isUrgentDeadline(days),
    prerequisiteTasks: mapTasks(doc.prerequisiteTasks),
    linkedReport: relationId(doc.linkedReport),
    completedDate: doc.completedDate ?? undefined,
    submittedDate: doc.submittedDate ?? undefined,
    verifiedDate: doc.verifiedDate ?? undefined,
    verifiedBy: relationId(doc.verifiedBy),
    notificationsSent: (doc.notificationsSent ?? [])
      .filter((n): n is NonNullable<typeof n> => Boolean(n))
      .map((n) => ({
        daysUntilDeadline: n.daysUntilDeadline ?? 0,
        sentAt: n.sentAt ?? undefined,
        retryCount: n.retryCount ?? undefined,
        status: n.status ?? undefined,
      })),
    tags: (doc.tags ?? [])
      .filter((t): t is { tag: string } => typeof t?.tag === "string")
      .map((t) => ({ tag: t.tag })),
    recurrenceRule: doc.recurrenceRule ?? undefined,
    isCatalog: Boolean(doc.isCatalog),
  };
}

async function loadOrgProfile(
  organisationId: string,
): Promise<OrgDeadlineProfile | null> {
  const payload = await getPayload({ config });
  const org = await payload.findByID({
    collection: "organisations",
    id: organisationId,
    depth: 0,
    overrideAccess: true,
  });
  if (!org) return null;
  return {
    country: org.country ?? "",
    sector: org.sector ?? "",
    employeeCount: org.employeeCount ?? null,
    revenueBand: parseRevenueBand(org.revenueBand),
  };
}

async function filedFrameworks(organisationId: string): Promise<Set<DeadlineType>> {
  const payload = await getPayload({ config });
  const filed = new Set<DeadlineType>();

  const reports = await payload.find({
    collection: "reports",
    where: {
      and: [
        { organisation: { equals: organisationId } },
        { status: { equals: "published" } },
      ],
    },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  });

  for (const r of reports.docs) {
    const fw = r.framework;
    if (fw === "CSRD_SET1" || fw === "CSRD_SIMPLIFIED") {
      filed.add("CSRD");
    }
  }

  const issb = await payload.find({
    collection: "issb-disclosures",
    where: {
      and: [
        { organisation: { equals: organisationId } },
        { status: { equals: "final" } },
      ],
    },
    limit: 20,
    depth: 0,
    overrideAccess: true,
  });
  if ((issb.docs?.length ?? 0) > 0) {
    filed.add("ISSB");
  }

  return filed;
}

/**
 * Regulatory deadlines service — applicability, urgency, catalog materialisation.
 */
export class RegulatoryDeadlinesService {
  /**
   * Ensure org has copies of applicable catalog deadlines, then return enriched list.
   */
  async getApplicableDeadlines(organisationId: string): Promise<DeadlineDetails[]> {
    const payload = await getPayload({ config });
    const profile = await loadOrgProfile(organisationId);
    if (!profile) return [];

    const asOf = new Date();
    const filed = await filedFrameworks(organisationId);

    const catalog = await payload.find({
      collection: "regulatory-deadlines",
      where: { isCatalog: { equals: true } },
      limit: 200,
      depth: 0,
      overrideAccess: true,
    });

    const orgRows = await payload.find({
      collection: "regulatory-deadlines",
      where: {
        and: [
          { organisation: { equals: organisationId } },
          { isCatalog: { not_equals: true } },
        ],
      },
      limit: 200,
      depth: 0,
      overrideAccess: true,
    });

    const byKey = new Map<string, CatalogDoc>();
    for (const doc of orgRows.docs as CatalogDoc[]) {
      if (doc.catalogKey) byKey.set(doc.catalogKey, doc);
    }

    for (const raw of catalog.docs as CatalogDoc[]) {
      const rule = mapApplicability(raw.organisationApplicability, raw.scope);
      if (!isDeadlineApplicable(rule, profile)) continue;

      const key = raw.catalogKey ?? `catalog:${raw.id}`;
      if (byKey.has(key)) continue;

      const created = await payload.create({
        collection: "regulatory-deadlines",
        data: {
          organisation: organisationId,
          isCatalog: false,
          catalogKey: key,
          name: raw.name,
          type: asType(raw.type, raw.framework),
          description: raw.description ?? undefined,
          documentationUrl: raw.documentationUrl ?? undefined,
          jurisdiction: raw.jurisdiction as
            "EU" | "IN" | "GB" | "US" | "GLOBAL" | "OTHER",
          country: raw.country ?? undefined,
          framework: raw.framework as
            | "CSRD"
            | "ISSB"
            | "SBTi"
            | "Taxonomy"
            | "BRSR"
            | "GRI"
            | "SASB"
            | "TCFD"
            | "ISO14064"
            | "OTHER",
          dueDate: raw.dueDate,
          scope: (raw.scope as "all" | "industry" | "size" | "country") ?? "all",
          severity: asSeverity(raw.severity),
          status: "pending",
          organisationApplicability: raw.organisationApplicability
            ? {
                appliesTo:
                  (raw.organisationApplicability.appliesTo as
                    "all" | "industry" | "size" | "country") ?? "all",
                countries: (raw.organisationApplicability.countries ?? [])
                  .filter((c): c is { code: string } => Boolean(c?.code))
                  .map((c) => ({ code: c.code })),
                industries: (raw.organisationApplicability.industries ?? [])
                  .filter((i): i is { nacePrefix: string } => Boolean(i?.nacePrefix))
                  .map((i) => ({ nacePrefix: i.nacePrefix })),
                minEmployeeCount: raw.organisationApplicability.minEmployeeCount,
                maxEmployeeCount: raw.organisationApplicability.maxEmployeeCount,
                revenueBands: filterRevenueBands(
                  raw.organisationApplicability.revenueBands,
                ),
                euOperatingOnly: raw.organisationApplicability.euOperatingOnly ?? false,
                requireLargeUndertaking:
                  raw.organisationApplicability.requireLargeUndertaking ?? false,
              }
            : undefined,
          prerequisiteTasks: mapTasks(raw.prerequisiteTasks).map((t) => ({
            task: t.task,
            done: false,
          })),
          colour: asColour(raw.colour),
          recurrenceRule: raw.recurrenceRule ?? undefined,
          tags: (raw.tags ?? [])
            .filter((t): t is { tag: string } => typeof t?.tag === "string")
            .map((t) => ({ tag: t.tag })),
        },
        overrideAccess: true,
      });
      byKey.set(key, created as CatalogDoc);
    }

    // Auto-complete when CSRD/ISSB reports filed
    for (const [key, doc] of byKey) {
      const dtype = asType(doc.type, doc.framework);
      const api = toApiStatus(doc.status);
      if (api === "completed") continue;
      if (
        (dtype === "CSRD" && filed.has("CSRD")) ||
        (dtype === "ISSB" && filed.has("ISSB"))
      ) {
        const updated = await payload.update({
          collection: "regulatory-deadlines",
          id: doc.id,
          data: {
            status: "completed",
            completedDate: new Date().toISOString().slice(0, 10),
          },
          overrideAccess: true,
        });
        byKey.set(key, updated as CatalogDoc);
      }
    }

    // Also include org-only deadlines without catalogKey that still apply
    for (const doc of orgRows.docs as CatalogDoc[]) {
      const key = doc.catalogKey ?? `org:${doc.id}`;
      if (!byKey.has(key)) {
        const rule = mapApplicability(doc.organisationApplicability, doc.scope);
        if (isDeadlineApplicable(rule, profile) || !doc.organisationApplicability) {
          byKey.set(key, doc);
        }
      }
    }

    const list = Array.from(byKey.values()).map((d) => enrichDoc(d, asOf));
    list.sort((a, b) => a.daysRemaining - b.daysRemaining);
    return list;
  }

  /** @deprecated Prefer getApplicableDeadlines — kept for calendar export callers. */
  async getDeadlines(organisationId: string): Promise<DeadlineDetails[]> {
    return this.getApplicableDeadlines(organisationId);
  }

  async getCalendarView(
    organisationId: string,
    year: number,
    month: number,
  ): Promise<CalendarView> {
    const deadlines = await this.getApplicableDeadlines(organisationId);
    const days: CalendarView["days"] = [];
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const todayStr = new Date().toISOString().slice(0, 10);

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayDeadlines = deadlines.filter((d) => d.dueDate === dateStr);
      days.push({
        date: dateStr,
        deadlines: dayDeadlines,
        isToday: dateStr === todayStr,
        isOverdue: dateStr < todayStr,
      });
    }

    return { year, month, days };
  }

  async getFilteredDeadlines(
    organisationId: string,
    options: ListViewOptions,
  ): Promise<DeadlineDetails[]> {
    let deadlines = await this.getApplicableDeadlines(organisationId);

    switch (options.view) {
      case "upcoming":
        deadlines = deadlines.filter((d) => d.daysRemaining >= 0);
        break;
      case "overdue":
        deadlines = deadlines.filter((d) => d.daysRemaining < 0);
        break;
      case "today":
        // Urgency list: incomplete first (overdue then soonest), exclude completed/missed archive noise
        deadlines = deadlines.filter(
          (d) => d.status !== "completed" && d.status !== "missed",
        );
        deadlines.sort((a, b) => a.daysRemaining - b.daysRemaining);
        break;
      case "all":
        break;
    }

    if (options.jurisdiction) {
      deadlines = deadlines.filter((d) => d.jurisdiction === options.jurisdiction);
    }
    if (options.framework) {
      deadlines = deadlines.filter((d) => d.framework === options.framework);
    }
    if (options.status) {
      const want = toApiStatus(options.status);
      deadlines = deadlines.filter((d) => d.status === want);
    }
    if (options.searchQuery) {
      const q = options.searchQuery.toLowerCase();
      deadlines = deadlines.filter(
        (d) =>
          d.name.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q),
      );
    }

    if (options.view !== "today") {
      deadlines.sort((a, b) => a.daysRemaining - b.daysRemaining);
    }

    return deadlines;
  }

  async getUpcoming(
    organisationId: string,
    windowDays: number = UPCOMING_WINDOW_DAYS,
  ): Promise<DeadlineDetails[]> {
    const deadlines = await this.getApplicableDeadlines(organisationId);
    return deadlines
      .filter((d) => isWithinUpcomingWindow(d.daysRemaining, windowDays))
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  }

  async getSummary(organisationId: string): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    missed: number;
    overdue: number;
    urgent: number;
    dueInNext7Days: number;
    dueInNext30Days: number;
  }> {
    const deadlines = await this.getApplicableDeadlines(organisationId);
    return {
      total: deadlines.length,
      pending: deadlines.filter((d) => d.status === "pending").length,
      inProgress: deadlines.filter((d) => d.status === "in-progress").length,
      completed: deadlines.filter((d) => d.status === "completed").length,
      missed: deadlines.filter((d) => d.status === "missed").length,
      overdue: deadlines.filter((d) => d.daysRemaining < 0 && d.status !== "completed")
        .length,
      urgent: deadlines.filter((d) => d.urgent && d.status !== "completed").length,
      dueInNext7Days: deadlines.filter(
        (d) => d.daysRemaining >= 0 && d.daysRemaining <= 7,
      ).length,
      dueInNext30Days: deadlines.filter(
        (d) => d.daysRemaining >= 0 && d.daysRemaining < 30,
      ).length,
    };
  }

  async updateDeadlineStatus(
    organisationId: string,
    deadlineId: string,
    statusInput: string,
    userId?: string,
  ): Promise<DeadlineDetails | null> {
    const payload = await getPayload({ config });
    const deadline = await payload.findByID({
      collection: "regulatory-deadlines",
      id: deadlineId,
      depth: 0,
      overrideAccess: true,
    });
    if (!deadline) return null;

    const orgId = relationId(deadline.organisation as string | { id: string } | null);
    if (orgId !== organisationId) return null;
    if (deadline.isCatalog) return null;

    const stored = toStoredStatus(statusInput);
    const data: {
      status: StoredDeadlineStatus;
      completedDate?: string;
    } = { status: stored };

    if (stored === "completed") {
      data.completedDate = new Date().toISOString().slice(0, 10);
    }

    await payload.update({
      collection: "regulatory-deadlines",
      id: deadlineId,
      data,
      overrideAccess: true,
    });

    // Touch user for audit trail when verifying/completing
    if (userId && stored === "completed") {
      await payload.update({
        collection: "regulatory-deadlines",
        id: deadlineId,
        data: { verifiedBy: userId },
        overrideAccess: true,
      });
    }

    const list = await this.getApplicableDeadlines(organisationId);
    return list.find((d) => d.id === deadlineId) ?? null;
  }

  async exportToICal(organisationId: string, orgName: string): Promise<string> {
    const deadlines = await this.getApplicableDeadlines(organisationId);

    let ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ClearESG//Regulatory Deadlines//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:${orgName} - Regulatory Deadlines
X-WR-TIMEZONE:UTC
`;

    for (const deadline of deadlines) {
      const dateStr = deadline.dueDate.replace(/-/g, "");
      const uid = `deadline-${deadline.id}@clearesg.com`;
      const desc = [
        deadline.description || "",
        `Days remaining: ${deadline.daysRemaining}`,
        deadline.urgent ? "URGENT (<30 days)" : "",
      ]
        .filter(Boolean)
        .join("\\n");

      if (deadline.recurrenceRule) {
        ical += `BEGIN:VEVENT
UID:${uid}
DTSTART;VALUE=DATE:${dateStr}
SUMMARY:${this.escapeICalText(deadline.name)}
DESCRIPTION:${this.escapeICalText(desc)}
STATUS:${deadline.status === "completed" ? "CONFIRMED" : "TENTATIVE"}
CATEGORIES:${deadline.framework}
RRULE:${deadline.recurrenceRule}
END:VEVENT
`;
      } else {
        ical += `BEGIN:VEVENT
UID:${uid}
DTSTART;VALUE=DATE:${dateStr}
SUMMARY:${this.escapeICalText(deadline.name)}
DESCRIPTION:${this.escapeICalText(desc)}
STATUS:${deadline.status === "completed" ? "CONFIRMED" : "TENTATIVE"}
CATEGORIES:${deadline.framework}
END:VEVENT
`;
      }
    }

    ical += `END:VCALENDAR`;
    return ical;
  }

  private escapeICalText(text: string): string {
    return text
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,");
  }
}

export const regulatoryDeadlinesService = new RegulatoryDeadlinesService();
