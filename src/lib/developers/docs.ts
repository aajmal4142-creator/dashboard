/**
 * Curated OpenAPI-style catalog for org developer APIs (F35).
 * Static, typed — not generated from route files.
 */

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiDocGroup = "ingest" | "bi" | "webhooks" | "factors" | "keys";

export type ApiEndpointDoc = {
  id: string;
  method: HttpMethod;
  path: string;
  summary: string;
  description: string;
  group: ApiDocGroup;
  /** How callers authenticate (session Membership, BI key, signature, etc.). */
  auth: string;
  query?: { name: string; required?: boolean; description: string }[];
  notes?: string[];
};

export type ApiDocGroupMeta = {
  id: ApiDocGroup;
  label: string;
  blurb: string;
};

/** In-app settings surface for BI API key management. */
export const API_KEYS_HREF = "/settings" as const;

/** Sandbox playground (F39) — placeholder until that route ships. */
export const API_SANDBOX_HREF = "/developers/sandbox" as const;

export const API_DOC_GROUPS: readonly ApiDocGroupMeta[] = [
  {
    id: "ingest",
    label: "Ingest",
    blurb: "Push datapoints into the active organisation period.",
  },
  {
    id: "bi",
    label: "BI",
    blurb:
      "Read-only extracts for Power BI and Tableau. Recipes: docs/bi/POWER_BI.md, docs/bi/TABLEAU.md.",
  },
  {
    id: "webhooks",
    label: "Webhooks",
    blurb:
      "Outbound event registrations, deliveries, and replay. Zapier/Make recipes: docs/integrations/ZAPIER.md, docs/integrations/MAKE.md.",
  },
  {
    id: "factors",
    label: "Factors",
    blurb: "Emission factor registry browse and org custom factors.",
  },
  {
    id: "keys",
    label: "API keys",
    blurb: "Create and revoke BI keys for programmatic access.",
  },
] as const;

export const API_ENDPOINT_CATALOG: readonly ApiEndpointDoc[] = [
  {
    id: "ingest-post",
    method: "POST",
    path: "/api/app/data/ingest",
    summary: "Ingest datapoints",
    description:
      "Accept a batch of metric values for the open reporting period. Rate-limited per organisation.",
    group: "ingest",
    auth: "Session + Membership. Requires create datapoint permission on the active org.",
    notes: [
      "Missing factor keys throw — ingest does not invent defaults.",
      "Quality missing is preserved; zeros are not implied.",
    ],
  },
  {
    id: "import-post",
    method: "POST",
    path: "/api/app/data/import",
    summary: "Spreadsheet import",
    description:
      "Parse and optionally apply a workbook of datapoint rows (dry-run supported).",
    group: "ingest",
    auth: "Session + Membership. Requires create datapoint permission.",
    notes: ["Prefer dry-run before live apply."],
  },
  {
    id: "bi-emissions",
    method: "GET",
    path: "/api/app/bi/emissions",
    summary: "BI emissions totals",
    description: "Period-scoped scope 1/2/3 totals for BI tools (read-only).",
    group: "bi",
    auth: "BI API key via Authorization: Bearer <key> or X-ClearESG-Api-Key.",
    notes: [
      "Recipes: docs/bi/POWER_BI.md and docs/bi/TABLEAU.md (Get Data → Web + Bearer header).",
      "No native .mez/.taco — REST only. Manage keys in Settings → BI connectors.",
    ],
  },
  {
    id: "bi-datapoints",
    method: "GET",
    path: "/api/app/bi/datapoints",
    summary: "BI datapoints",
    description: "Paginated org datapoints for BI tools (read-only).",
    group: "bi",
    auth: "BI API key via Authorization: Bearer <key> or X-ClearESG-Api-Key.",
    notes: ["See docs/bi/POWER_BI.md and docs/bi/TABLEAU.md."],
    query: [
      { name: "limit", description: "Page size." },
      { name: "page", description: "Page number (1-based)." },
      { name: "periodId", description: "Optional reporting period filter." },
    ],
  },
  {
    id: "bi-suppliers",
    method: "GET",
    path: "/api/app/bi/suppliers",
    summary: "BI suppliers",
    description: "Paginated org suppliers for BI tools (read-only).",
    group: "bi",
    auth: "BI API key via Authorization: Bearer <key> or X-ClearESG-Api-Key.",
    query: [
      { name: "limit", description: "Page size." },
      { name: "page", description: "Page number (1-based)." },
    ],
  },
  {
    id: "bi-scenarios",
    method: "GET",
    path: "/api/app/bi/scenarios",
    summary: "BI scenarios",
    description: "Paginated org scenarios for BI tools (read-only).",
    group: "bi",
    auth: "BI API key via Authorization: Bearer <key> or X-ClearESG-Api-Key.",
    query: [
      { name: "limit", description: "Page size." },
      { name: "page", description: "Page number (1-based)." },
    ],
  },
  {
    id: "bi-benchmarks",
    method: "GET",
    path: "/api/app/bi/benchmarks",
    summary: "BI benchmarks",
    description: "Peer comparison for a metric (read-only).",
    group: "bi",
    auth: "BI API key via Authorization: Bearer <key> or X-ClearESG-Api-Key.",
    query: [
      {
        name: "metricKey",
        description: "Metric key (default electricity_kwh).",
      },
    ],
  },
  {
    id: "webhooks-list",
    method: "GET",
    path: "/api/app/webhooks",
    summary: "List webhook registrations",
    description: "List outbound webhook registrations for the active organisation.",
    group: "webhooks",
    auth: "Session + Membership (active org).",
  },
  {
    id: "webhooks-create",
    method: "POST",
    path: "/api/app/webhooks",
    summary: "Register webhook",
    description:
      "Register an outbound endpoint for datapoint.created, datapoint.updated, or report.generated.",
    group: "webhooks",
    auth: "Session + Membership. Admin role required.",
  },
  {
    id: "webhooks-register",
    method: "POST",
    path: "/api/app/webhooks/register",
    summary: "Register webhook (alias)",
    description: "Alias of POST /api/app/webhooks for registration clients.",
    group: "webhooks",
    auth: "Session + Membership. Admin role required.",
  },
  {
    id: "webhooks-delete",
    method: "DELETE",
    path: "/api/app/webhooks/[id]",
    summary: "Delete webhook",
    description: "Remove a webhook registration owned by the active organisation.",
    group: "webhooks",
    auth: "Session + Membership. Admin role required.",
  },
  {
    id: "webhooks-test",
    method: "POST",
    path: "/api/app/webhooks/[id]/test",
    summary: "Send test delivery",
    description: "Send a signed test payload with the registration's retry policy.",
    group: "webhooks",
    auth: "Session + Membership. Admin role required.",
  },
  {
    id: "webhooks-deliveries",
    method: "GET",
    path: "/api/app/webhooks/deliveries",
    summary: "Delivery log",
    description: "Inspect delivery attempts and the dead-letter queue.",
    group: "webhooks",
    auth: "Session + Membership. Admin role required to manage.",
    query: [
      { name: "status", description: "success | failed | retrying." },
      { name: "webhook_id", description: "Filter by registration id." },
      { name: "dead_letter", description: "1/true to show dead-letter only." },
      { name: "limit", description: "Max rows (1–200)." },
    ],
  },
  {
    id: "webhooks-replay",
    method: "POST",
    path: "/api/app/webhooks/deliveries/[logId]/replay",
    summary: "Replay dead-letter delivery",
    description: "Re-send a failed delivery from the dead-letter queue.",
    group: "webhooks",
    auth: "Session + Membership. Admin role required.",
  },
  {
    id: "emissions-factors-get",
    method: "GET",
    path: "/api/app/emissions-factors",
    summary: "Browse registry factors",
    description:
      "List emission factors filtered by methodology standard, optional scope and key.",
    group: "factors",
    auth: "Session + Membership (active org).",
    query: [
      { name: "standard", description: "Methodology standard (e.g. GHGProtocol2004)." },
      { name: "scope", description: "Optional scope filter (1 | 2 | 3)." },
      { name: "key", description: "Optional factor key." },
    ],
    notes: ["Missing keys still throw in calc — this list does not invent defaults."],
  },
  {
    id: "factors-list",
    method: "GET",
    path: "/api/app/factors",
    summary: "Org factor admin list",
    description:
      "Browse organisation custom factors and optional global seeds for the factor admin.",
    group: "factors",
    auth: "Session + Membership (active org).",
    query: [
      { name: "q", description: "Search string." },
      { name: "includeGlobal", description: "1 to include global seed rows." },
    ],
  },
  {
    id: "factors-create",
    method: "POST",
    path: "/api/app/factors",
    summary: "Create custom factor",
    description:
      "Create an organisation custom registry factor (key, value, unit, source, year).",
    group: "factors",
    auth: "Session + Membership. Owner or admin only.",
    notes: ["Global seed rows remain read-only."],
  },
  {
    id: "factors-deactivate",
    method: "POST",
    path: "/api/app/factors/[id]/deactivate",
    summary: "Deactivate custom factor",
    description:
      "Deactivate an organisation custom factor. Global seeds cannot be deactivated.",
    group: "factors",
    auth: "Session + Membership. Owner or admin only.",
  },
  {
    id: "bi-keys-list",
    method: "GET",
    path: "/api/app/settings/bi-keys",
    summary: "List BI API keys",
    description: "List BI API keys and plan quota usage for the active organisation.",
    group: "keys",
    auth: "Session + Membership (active org).",
    notes: ["Plaintext secrets are never returned after create."],
  },
  {
    id: "bi-keys-create",
    method: "POST",
    path: "/api/app/settings/bi-keys",
    summary: "Create BI API key",
    description: "Create a BI API key. Returns the plaintext secret once.",
    group: "keys",
    auth: "Session + Membership. Owner or admin only.",
    notes: ["Store the secret immediately — it is not shown again."],
  },
  {
    id: "bi-keys-revoke",
    method: "DELETE",
    path: "/api/app/settings/bi-keys/[id]",
    summary: "Revoke BI API key",
    description: "Revoke a BI API key for the active organisation.",
    group: "keys",
    auth: "Session + Membership. Owner or admin only.",
  },
] as const;

export function getApiDocGroupMeta(id: ApiDocGroup): ApiDocGroupMeta {
  const found = API_DOC_GROUPS.find((g) => g.id === id);
  if (!found) {
    throw new Error(`Unknown API doc group: ${id}`);
  }
  return found;
}

export function getApiEndpointById(id: string): ApiEndpointDoc | undefined {
  return API_ENDPOINT_CATALOG.find((e) => e.id === id);
}

export function filterApiEndpointCatalog(opts: {
  query?: string;
  group?: ApiDocGroup | "all";
}): ApiEndpointDoc[] {
  const q = (opts.query ?? "").trim().toLowerCase();
  const group = opts.group ?? "all";

  return API_ENDPOINT_CATALOG.filter((entry) => {
    if (group !== "all" && entry.group !== group) return false;
    if (!q) return true;
    const hay = [
      entry.id,
      entry.method,
      entry.path,
      entry.summary,
      entry.description,
      entry.auth,
      entry.group,
      ...(entry.notes ?? []),
      ...(entry.query?.map((p) => `${p.name} ${p.description}`) ?? []),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

/** Stable identity for uniqueness checks: method + path. */
export function endpointIdentity(entry: Pick<ApiEndpointDoc, "method" | "path">): string {
  return `${entry.method} ${entry.path}`;
}
