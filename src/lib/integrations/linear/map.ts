import type { ClearEsgTask } from "@/lib/integrations/workTrackers/types";

import type { LinearIssueCreatePayload } from "./types";

const ISSUE_CREATE_MUTATION = `mutation IssueCreate($input: IssueCreateInput!) {
  issueCreate(input: $input) {
    success
    issue {
      id
      identifier
      title
      url
    }
  }
}`;

/**
 * Pure mapper: ClearESG task → Linear GraphQL issueCreate payload.
 * No I/O.
 */
export function mapClearEsgTaskToLinearIssue(
  task: ClearEsgTask,
  options: { teamId: string },
): LinearIssueCreatePayload {
  const teamId = options.teamId.trim();
  if (!teamId) {
    throw new Error("Linear team id is required");
  }

  const title = `[ClearESG] ${task.title}`.replace(/\s+/g, " ").trim();
  const lines: string[] = [
    task.description.trim(),
    "",
    `Entity: ${task.entityType} / ${task.entityId}`,
  ];
  if (task.status) lines.push(`ClearESG status: ${task.status}`);
  if (task.organisationName) lines.push(`Organisation: ${task.organisationName}`);
  if (task.sourceUrl) lines.push(`Open in ClearESG: ${task.sourceUrl}`);
  lines.push("", "Created by ClearESG work-tracker sync.");

  const input: LinearIssueCreatePayload["variables"]["input"] = {
    title: title || "[ClearESG] Task",
    description: lines.join("\n").trim(),
    teamId,
  };

  if (task.dueDate) {
    const day = task.dueDate.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      input.dueDate = day;
    }
  }

  return {
    query: ISSUE_CREATE_MUTATION,
    variables: { input },
  };
}

export const LINEAR_VIEWER_QUERY = `query Viewer {
  viewer {
    id
    name
    email
  }
}`;
