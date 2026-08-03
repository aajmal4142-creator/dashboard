/** ClearESG → Jira issue field payload (REST /rest/api/3/issue). */
export type JiraAdfDoc = {
  type: "doc";
  version: 1;
  content: Array<{
    type: "paragraph";
    content: Array<{ type: "text"; text: string }>;
  }>;
};

export type JiraCreateIssueFields = {
  project: { key: string } | { id: string };
  summary: string;
  description: JiraAdfDoc;
  issuetype: { name: string };
  duedate?: string;
  labels?: string[];
};

export type JiraCreateIssuePayload = {
  fields: JiraCreateIssueFields;
};

export type JiraCreateIssueResult = {
  id: string;
  key: string;
  self: string;
};

export type JiraMyselfResult = {
  accountId: string;
  displayName: string;
  emailAddress?: string;
};
