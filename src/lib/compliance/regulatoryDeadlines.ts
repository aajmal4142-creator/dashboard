import { getPayload } from "payload";
import config from "@/payload.config";

export interface DeadlineDetails {
  id: string;
  name: string;
  description?: string;
  jurisdiction: string;
  framework: string;
  dueDate: string;
  status: string;
  colour: string;
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
}

export interface CalendarView {
  year: number;
  month: number;
  days: Array<{
    date: string;
    deadlines: DeadlineDetails[];
    isToday: boolean;
    isOverdue: boolean;
  }>;
}

export interface ListViewOptions {
  view: "upcoming" | "overdue" | "all";
  jurisdiction?: string;
  framework?: string;
  status?: string;
  searchQuery?: string;
}

/**
 * Regulatory deadlines service for fetching, filtering, and managing deadlines.
 */
export class RegulatoryDeadlinesService {
  private payloadPromise = getPayload({ config });

  /**
   * Get all deadlines for an organization.
   */
  async getDeadlines(organisationId: string): Promise<DeadlineDetails[]> {
    try {
      const payload = await this.payloadPromise;
      const result = await payload.find({
        collection: "regulatory-deadlines",
        where: {
          organisation: {
            equals: organisationId,
          },
        },
        limit: 100,
      });

      return (result.docs || []).map((doc) => ({
        id: doc.id,
        name: doc.name,
        description: doc.description ?? undefined,
        jurisdiction: doc.jurisdiction,
        framework: doc.framework,
        dueDate: doc.dueDate,
        status: doc.status,
        colour: doc.colour ?? "gray",
        linkedReport:
          typeof doc.linkedReport === "object" && doc.linkedReport !== null
            ? doc.linkedReport.id
            : typeof doc.linkedReport === "string"
              ? doc.linkedReport
              : undefined,
        completedDate: doc.completedDate ?? undefined,
        submittedDate: doc.submittedDate ?? undefined,
        verifiedDate: doc.verifiedDate ?? undefined,
        verifiedBy:
          typeof doc.verifiedBy === "object" && doc.verifiedBy !== null
            ? doc.verifiedBy.id
            : typeof doc.verifiedBy === "string"
              ? doc.verifiedBy
              : undefined,
        notificationsSent: (doc.notificationsSent || []).map((n) => ({
          daysUntilDeadline: n.daysUntilDeadline ?? 0,
          sentAt: n.sentAt ?? undefined,
          retryCount: n.retryCount ?? undefined,
          status: n.status ?? undefined,
        })),
        tags: (doc.tags || [])
          .filter(
            (t): t is { tag: string; id?: string | null } => typeof t.tag === "string",
          )
          .map((t) => ({ tag: t.tag })),
        recurrenceRule: doc.recurrenceRule ?? undefined,
      }));
    } catch (error) {
      console.error("Error fetching deadlines:", error);
      return [];
    }
  }

  /**
   * Get calendar view for a specific month.
   */
  async getCalendarView(
    organisationId: string,
    year: number,
    month: number,
  ): Promise<CalendarView> {
    const deadlines = await this.getDeadlines(organisationId);
    const days: CalendarView["days"] = [];

    // Get number of days in month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Build calendar days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = date.toISOString().split("T")[0];
      const isToday = dateStr === todayStr;
      const isOverdue = dateStr < todayStr;

      // Find deadlines for this day
      const dayDeadlines = deadlines.filter((d) => d.dueDate === dateStr);

      days.push({
        date: dateStr,
        deadlines: dayDeadlines,
        isToday,
        isOverdue,
      });
    }

    return { year, month, days };
  }

  /**
   * Get filtered list of deadlines.
   */
  async getFilteredDeadlines(
    organisationId: string,
    options: ListViewOptions,
  ): Promise<DeadlineDetails[]> {
    let deadlines = await this.getDeadlines(organisationId);
    const today = new Date().toISOString().split("T")[0];

    // Filter by view
    switch (options.view) {
      case "upcoming":
        deadlines = deadlines.filter((d) => d.dueDate >= today);
        break;
      case "overdue":
        deadlines = deadlines.filter((d) => d.dueDate < today);
        break;
      case "all":
        break;
    }

    // Filter by jurisdiction
    if (options.jurisdiction) {
      deadlines = deadlines.filter((d) => d.jurisdiction === options.jurisdiction);
    }

    // Filter by framework
    if (options.framework) {
      deadlines = deadlines.filter((d) => d.framework === options.framework);
    }

    // Filter by status
    if (options.status) {
      deadlines = deadlines.filter((d) => d.status === options.status);
    }

    // Filter by search query
    if (options.searchQuery) {
      const query = options.searchQuery.toLowerCase();
      deadlines = deadlines.filter(
        (d) =>
          d.name.toLowerCase().includes(query) ||
          d.description?.toLowerCase().includes(query),
      );
    }

    // Sort by due date
    deadlines.sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    );

    return deadlines;
  }

  /**
   * Get summary statistics for deadlines.
   */
  async getSummary(organisationId: string): Promise<{
    total: number;
    notStarted: number;
    inProgress: number;
    completed: number;
    submitted: number;
    verified: number;
    overdue: number;
    dueInNext7Days: number;
    dueInNext30Days: number;
  }> {
    const deadlines = await this.getDeadlines(organisationId);
    const today = new Date();
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const todayStr = today.toISOString().split("T")[0];
    const sevenDaysStr = sevenDaysFromNow.toISOString().split("T")[0];
    const thirtyDaysStr = thirtyDaysFromNow.toISOString().split("T")[0];

    return {
      total: deadlines.length,
      notStarted: deadlines.filter((d) => d.status === "not_started").length,
      inProgress: deadlines.filter((d) => d.status === "in_progress").length,
      completed: deadlines.filter((d) => d.status === "completed").length,
      submitted: deadlines.filter((d) => d.status === "submitted").length,
      verified: deadlines.filter((d) => d.status === "verified").length,
      overdue: deadlines.filter((d) => d.dueDate < todayStr).length,
      dueInNext7Days: deadlines.filter(
        (d) => d.dueDate >= todayStr && d.dueDate <= sevenDaysStr,
      ).length,
      dueInNext30Days: deadlines.filter(
        (d) => d.dueDate >= todayStr && d.dueDate <= thirtyDaysStr,
      ).length,
    };
  }

  /**
   * Generate iCal export for deadlines.
   */
  async exportToICal(organisationId: string, orgName: string): Promise<string> {
    const deadlines = await this.getDeadlines(organisationId);

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

      // Handle recurring deadlines
      if (deadline.recurrenceRule) {
        ical += `BEGIN:VEVENT
UID:${uid}
DTSTART;VALUE=DATE:${dateStr}
SUMMARY:${this.escapeICalText(deadline.name)}
DESCRIPTION:${this.escapeICalText(deadline.description || "")}
STATUS:${deadline.status === "verified" ? "CONFIRMED" : "TENTATIVE"}
CATEGORIES:${deadline.framework}
RRULE:${deadline.recurrenceRule}
END:VEVENT
`;
      } else {
        ical += `BEGIN:VEVENT
UID:${uid}
DTSTART;VALUE=DATE:${dateStr}
SUMMARY:${this.escapeICalText(deadline.name)}
DESCRIPTION:${this.escapeICalText(deadline.description || "")}
STATUS:${deadline.status === "verified" ? "CONFIRMED" : "TENTATIVE"}
CATEGORIES:${deadline.framework}
END:VEVENT
`;
      }
    }

    ical += `END:VCALENDAR`;

    return ical;
  }

  /**
   * Escape special characters in iCal text fields.
   */
  private escapeICalText(text: string): string {
    return text
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,");
  }
}

// Export singleton instance
export const regulatoryDeadlinesService = new RegulatoryDeadlinesService();
