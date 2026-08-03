/** ClearESG → Linear GraphQL issueCreate input. */
export type LinearIssueCreateInput = {
  title: string;
  description: string;
  teamId: string;
  dueDate?: string;
};

export type LinearIssueCreatePayload = {
  query: string;
  variables: {
    input: LinearIssueCreateInput;
  };
};

export type LinearIssueNode = {
  id: string;
  identifier: string;
  title: string;
  url: string;
};

export type LinearIssueCreateResult = {
  success: boolean;
  issue: LinearIssueNode | null;
};
