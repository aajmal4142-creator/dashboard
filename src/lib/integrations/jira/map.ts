import type { ClearEsgTask } from "@/lib/integrations/workTrackers/types";

import type { JiraAdfDoc, JiraCreateIssuePayload } from "./types";

const MAX_SUMMARY = 255;

function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

/** Build Atlassian Document Format description from plain paragraphs. */
export function toJiraAdf(paragraphs: string[]): JiraAdfDoc {
  const content = paragraphs
    .map((p) => p.trim())
    .filter(Boolean)
    .map((text) => ({
      type: "paragraph" as const,
      content: [{ type: "text" as const, text }],
    }));

  if (content.length === 0) {
    return {
      type: "doc",
      version: 1,
      content: [{ type: "paragraph", content: [{ type: "text", text: "—" }] }],
    };
  }

  return { type: "doc", version: 1, content };
}

function projectRef(projectOrTeamId: string): { key: string } | { id: string } {
  const id = projectOrTeamId.trim();
  // Numeric project ids vs string keys (e.g. ESG)
  if (/^\d+$/.test(id)) return { id };
  return { key: id };
}

/**
 * Pure mapper: ClearESG task → Jira POST /rest/api/3/issue body.
 * No I/O.
 */
export function mapClearEsgTaskToJiraIssue(
  task: ClearEsgTask,
  options: {
    projectOrTeamId: string;
    issueTypeName?: string | null;
  },
): JiraCreateIssuePayload {
  const projectId = options.projectOrTeamId.trim();
  if (!projectId) {
    throw new Error("Jira project key or id is required");
  }

  const summary = truncate(`[ClearESG] ${task.title}`.replace(/\s+/g, " "), MAX_SUMMARY);

  const paragraphs: string[] = [
    task.description,
    `Entity: ${task.entityType} / ${task.entityId}`,
  ];
  if (task.status) paragraphs.push(`ClearESG status: ${task.status}`);
  if (task.organisationName) paragraphs.push(`Organisation: ${task.organisationName}`);
  if (task.sourceUrl) paragraphs.push(`Open in ClearESG: ${task.sourceUrl}`);
  paragraphs.push("Created by ClearESG work-tracker sync. No marketplace app.");

  const fields: JiraCreateIssuePayload["fields"] = {
    project: projectRef(projectId),
    summary,
    description: toJiraAdf(paragraphs),
    issuetype: { name: (options.issueTypeName || "Task").trim() || "Task" },
    labels: ["clearesg", task.entityType.replace(/_/g, "-")],
  };

  if (task.dueDate) {
    // Jira duedate is YYYY-MM-DD
    const day = task.dueDate.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      fields.duedate = day;
    }
  }

  return { fields };
}
