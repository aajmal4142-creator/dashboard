import { sanitizeWorkTrackerError } from "@/lib/integrations/workTrackers/sanitize";

import type {
  JiraCreateIssuePayload,
  JiraCreateIssueResult,
  JiraMyselfResult,
} from "./types";

function assertJiraBaseUrl(baseUrl: string): URL {
  let url: URL;
  try {
    url = new URL(baseUrl.trim().replace(/\/+$/, ""));
  } catch {
    throw new Error("Jira base URL is invalid");
  }
  if (url.protocol !== "https:") {
    throw new Error("Jira base URL must use HTTPS");
  }
  const host = url.hostname.toLowerCase();
  const allowed =
    host === "api.atlassian.com" ||
    host.endsWith(".atlassian.net") ||
    host === "atlassian.net";
  if (!allowed) {
    throw new Error(
      "Jira base URL must be *.atlassian.net or api.atlassian.com (documented REST bases only)",
    );
  }
  return url;
}

function basicAuthHeader(email: string, apiToken: string): string {
  const token = Buffer.from(`${email}:${apiToken}`, "utf8").toString("base64");
  return `Basic ${token}`;
}

async function jiraFetch(
  baseUrl: string,
  email: string,
  apiToken: string,
  path: string,
  init?: {
    method?: string;
    body?: string;
  },
): Promise<Response> {
  const root = assertJiraBaseUrl(baseUrl);
  const url = new URL(path.replace(/^\//, ""), `${root.toString()}/`);
  // Re-check final host after join
  assertJiraBaseUrl(url.origin);

  return fetch(url.toString(), {
    method: init?.method ?? "GET",
    headers: {
      Authorization: basicAuthHeader(email, apiToken),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: init?.body,
  });
}

async function readJiraError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as {
      errorMessages?: string[];
      message?: string;
      errors?: Record<string, string>;
    };
    if (Array.isArray(data.errorMessages) && data.errorMessages.length > 0) {
      return sanitizeWorkTrackerError(data.errorMessages.join("; "));
    }
    if (data.errors && typeof data.errors === "object") {
      const parts = Object.entries(data.errors).map(([k, v]) => `${k}: ${v}`);
      if (parts.length) return sanitizeWorkTrackerError(parts.join("; "));
    }
    if (typeof data.message === "string") {
      return sanitizeWorkTrackerError(data.message);
    }
  } catch {
    // fall through
  }
  return sanitizeWorkTrackerError(`Jira HTTP ${res.status}`);
}

/** GET /rest/api/3/myself — validates email + API token. */
export async function testJiraConnection(input: {
  baseUrl: string;
  email: string;
  apiToken: string;
}): Promise<{ ok: true; myself: JiraMyselfResult } | { ok: false; message: string }> {
  const email = input.email.trim();
  if (!email) {
    return { ok: false, message: "Jira account email is required" };
  }
  if (!input.apiToken.trim()) {
    return { ok: false, message: "Jira API token is required" };
  }

  try {
    assertJiraBaseUrl(input.baseUrl);
    const res = await jiraFetch(
      input.baseUrl,
      email,
      input.apiToken,
      "/rest/api/3/myself",
    );
    if (!res.ok) {
      return { ok: false, message: await readJiraError(res) };
    }
    const data = (await res.json()) as JiraMyselfResult;
    if (!data.accountId) {
      return { ok: false, message: "Jira myself response missing accountId" };
    }
    return { ok: true, myself: data };
  } catch (err) {
    return { ok: false, message: sanitizeWorkTrackerError(err) };
  }
}

/** POST /rest/api/3/issue */
export async function createJiraIssue(input: {
  baseUrl: string;
  email: string;
  apiToken: string;
  payload: JiraCreateIssuePayload;
}): Promise<
  | { ok: true; issue: JiraCreateIssueResult; browseUrl: string | null }
  | { ok: false; message: string }
> {
  const email = input.email.trim();
  if (!email) return { ok: false, message: "Jira account email is required" };

  try {
    const root = assertJiraBaseUrl(input.baseUrl);
    const res = await jiraFetch(
      input.baseUrl,
      email,
      input.apiToken,
      "/rest/api/3/issue",
      {
        method: "POST",
        body: JSON.stringify(input.payload),
      },
    );
    if (!res.ok) {
      return { ok: false, message: await readJiraError(res) };
    }
    const data = (await res.json()) as JiraCreateIssueResult;
    if (!data.id || !data.key) {
      return { ok: false, message: "Jira create issue response missing id/key" };
    }

    let browseUrl: string | null = null;
    if (root.hostname.endsWith(".atlassian.net")) {
      browseUrl = `${root.origin}/browse/${data.key}`;
    } else if (typeof data.self === "string") {
      browseUrl = data.self;
    }

    return { ok: true, issue: data, browseUrl };
  } catch (err) {
    return { ok: false, message: sanitizeWorkTrackerError(err) };
  }
}
