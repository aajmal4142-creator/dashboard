import { sanitizeWorkTrackerError } from "@/lib/integrations/workTrackers/sanitize";

import { LINEAR_VIEWER_QUERY } from "./map";
import type {
  LinearIssueCreatePayload,
  LinearIssueCreateResult,
  LinearIssueNode,
} from "./types";

const LINEAR_API = "https://api.linear.app/graphql";

function assertLinearEndpoint(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error("Linear API URL is invalid");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Linear API URL must use HTTPS");
  }
  if (parsed.hostname.toLowerCase() !== "api.linear.app") {
    throw new Error("Linear calls must use api.linear.app only");
  }
}

async function linearGraphql(
  apiToken: string,
  body: { query: string; variables?: Record<string, unknown> },
  endpoint = LINEAR_API,
): Promise<Response> {
  assertLinearEndpoint(endpoint);
  return fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: apiToken.trim(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
}

type GraphqlEnvelope = {
  data?: Record<string, unknown>;
  errors?: Array<{ message?: string }>;
};

async function readLinearEnvelope(
  res: Response,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; message: string }> {
  let envelope: GraphqlEnvelope;
  try {
    envelope = (await res.json()) as GraphqlEnvelope;
  } catch {
    return { ok: false, message: sanitizeWorkTrackerError(`Linear HTTP ${res.status}`) };
  }

  if (!res.ok) {
    const msg = envelope.errors?.[0]?.message || `Linear HTTP ${res.status}`;
    return { ok: false, message: sanitizeWorkTrackerError(msg) };
  }

  if (Array.isArray(envelope.errors) && envelope.errors.length > 0) {
    const msg = envelope.errors
      .map((e) => e.message || "Linear GraphQL error")
      .join("; ");
    return { ok: false, message: sanitizeWorkTrackerError(msg) };
  }

  if (!envelope.data || typeof envelope.data !== "object") {
    return { ok: false, message: "Linear response missing data" };
  }

  return { ok: true, data: envelope.data };
}

/** Query viewer — validates Linear personal API key. */
export async function testLinearConnection(input: {
  apiToken: string;
  baseUrl?: string | null;
}): Promise<
  | { ok: true; viewer: { id: string; name: string | null } }
  | { ok: false; message: string }
> {
  if (!input.apiToken.trim()) {
    return { ok: false, message: "Linear API key is required" };
  }

  try {
    const endpoint = (input.baseUrl || LINEAR_API).trim() || LINEAR_API;
    const res = await linearGraphql(
      input.apiToken,
      { query: LINEAR_VIEWER_QUERY },
      endpoint.endsWith("/graphql")
        ? endpoint
        : `${endpoint.replace(/\/+$/, "")}/graphql`,
    );
    const parsed = await readLinearEnvelope(res);
    if (!parsed.ok) return parsed;

    const viewer = parsed.data.viewer as
      { id?: string; name?: string } | null | undefined;
    if (!viewer?.id) {
      return { ok: false, message: "Linear viewer response missing id" };
    }
    return {
      ok: true,
      viewer: {
        id: viewer.id,
        name: typeof viewer.name === "string" ? viewer.name : null,
      },
    };
  } catch (err) {
    return { ok: false, message: sanitizeWorkTrackerError(err) };
  }
}

/** Mutation issueCreate */
export async function createLinearIssue(input: {
  apiToken: string;
  payload: LinearIssueCreatePayload;
  baseUrl?: string | null;
}): Promise<{ ok: true; issue: LinearIssueNode } | { ok: false; message: string }> {
  if (!input.apiToken.trim()) {
    return { ok: false, message: "Linear API key is required" };
  }

  try {
    const endpoint = (input.baseUrl || LINEAR_API).trim() || LINEAR_API;
    const res = await linearGraphql(
      input.apiToken,
      {
        query: input.payload.query,
        variables: input.payload.variables as unknown as Record<string, unknown>,
      },
      endpoint.endsWith("/graphql")
        ? endpoint
        : `${endpoint.replace(/\/+$/, "")}/graphql`,
    );
    const parsed = await readLinearEnvelope(res);
    if (!parsed.ok) return parsed;

    const created = parsed.data.issueCreate as LinearIssueCreateResult | undefined;
    if (!created?.success || !created.issue?.id) {
      return {
        ok: false,
        message: "Linear issueCreate did not return a successful issue",
      };
    }
    return { ok: true, issue: created.issue };
  } catch (err) {
    return { ok: false, message: sanitizeWorkTrackerError(err) };
  }
}

export { LINEAR_API };
