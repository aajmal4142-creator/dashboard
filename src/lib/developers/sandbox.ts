/**
 * API sandbox allowlist — safe same-origin GET samples only.
 * No destructive methods; no third-party hosts.
 */

export type SandboxAuthMode = "session" | "bi-key" | "session-or-bi-key";

export type SandboxEndpoint = {
  id: string;
  method: "GET";
  /** Pathname only, always under /api/app/ */
  path: string;
  summary: string;
  auth: SandboxAuthMode;
  /** Optional query string without leading ? */
  sampleQuery?: string;
};

export const SANDBOX_ALLOWLIST: readonly SandboxEndpoint[] = [
  {
    id: "bi-emissions",
    method: "GET",
    path: "/api/app/bi/emissions",
    summary: "Period-scoped scope 1/2/3 totals (BI API key).",
    auth: "bi-key",
  },
  {
    id: "bi-datapoints",
    method: "GET",
    path: "/api/app/bi/datapoints",
    summary: "Org datapoints for BI tools (BI API key).",
    auth: "bi-key",
    sampleQuery: "limit=10&page=1",
  },
  {
    id: "bi-suppliers",
    method: "GET",
    path: "/api/app/bi/suppliers",
    summary: "Supplier list for BI tools (BI API key).",
    auth: "bi-key",
    sampleQuery: "limit=10&page=1",
  },
  {
    id: "bi-scenarios",
    method: "GET",
    path: "/api/app/bi/scenarios",
    summary: "Scenario list for BI tools (BI API key).",
    auth: "bi-key",
    sampleQuery: "limit=10&page=1",
  },
  {
    id: "bi-benchmarks",
    method: "GET",
    path: "/api/app/bi/benchmarks",
    summary: "Industry benchmarks export (BI API key).",
    auth: "bi-key",
  },
  {
    id: "bi-keys-list",
    method: "GET",
    path: "/api/app/settings/bi-keys",
    summary: "List BI API key prefixes and quota (session).",
    auth: "session",
  },
  {
    id: "emissions-factors",
    method: "GET",
    path: "/api/app/emissions-factors",
    summary: "Emission factor registry (session).",
    auth: "session",
    sampleQuery: "standard=GHGProtocol2004&scope=1",
  },
  {
    id: "webhooks-list",
    method: "GET",
    path: "/api/app/webhooks",
    summary: "Registered outbound webhooks (session).",
    auth: "session",
  },
  {
    id: "webhook-events",
    method: "GET",
    path: "/api/app/webhooks/events",
    summary: "Webhook event catalog (session).",
    auth: "session",
  },
  {
    id: "reports-list",
    method: "GET",
    path: "/api/app/reports",
    summary: "Org reports list (session).",
    auth: "session",
  },
  {
    id: "frameworks-summary",
    method: "GET",
    path: "/api/app/frameworks/summary",
    summary: "Framework coverage summary (session).",
    auth: "session",
  },
  {
    id: "billing-plans",
    method: "GET",
    path: "/api/app/billing/plans",
    summary: "Plan catalog and limits (session).",
    auth: "session",
  },
] as const;

const ALLOWED_PATHS = new Set(SANDBOX_ALLOWLIST.map((e) => e.path));

export type SandboxResolveOk = {
  ok: true;
  method: "GET";
  path: string;
  endpoint: SandboxEndpoint;
};

export type SandboxResolveErr = {
  ok: false;
  error: string;
};

export type SandboxResolveResult = SandboxResolveOk | SandboxResolveErr;

/** Strip query/hash; reject scheme-based / host-qualified URLs (same-origin relative only). */
export function normalizeSandboxPath(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Block absolute URLs — sandbox may only call same-origin relative /api/app/* paths.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;
  if (trimmed.startsWith("//")) return null;

  const withoutHash = trimmed.split("#")[0] ?? trimmed;
  const pathname = withoutHash.split("?")[0] ?? withoutHash;
  return normalizePathname(pathname);
}

function normalizePathname(pathname: string): string | null {
  if (!pathname.startsWith("/")) return null;
  if (pathname.includes("..")) return null;
  if (!pathname.startsWith("/api/app/")) return null;
  // Collapse duplicate slashes; drop trailing slash except root
  const collapsed = pathname.replace(/\/+/g, "/");
  if (collapsed.length > 1 && collapsed.endsWith("/")) {
    return collapsed.slice(0, -1);
  }
  return collapsed;
}

export function isSandboxMethodAllowed(method: string): boolean {
  return method.trim().toUpperCase() === "GET";
}

export function isSandboxPathAllowed(path: string): boolean {
  const normalized = normalizeSandboxPath(path);
  if (!normalized) return false;
  return ALLOWED_PATHS.has(normalized);
}

export function getSandboxEndpointById(id: string): SandboxEndpoint | undefined {
  return SANDBOX_ALLOWLIST.find((e) => e.id === id);
}

export function getSandboxEndpointByPath(path: string): SandboxEndpoint | undefined {
  const normalized = normalizeSandboxPath(path);
  if (!normalized) return undefined;
  return SANDBOX_ALLOWLIST.find((e) => e.path === normalized);
}

/**
 * Resolve a sandbox request. Blocks non-GET methods and non-allowlisted paths.
 */
export function resolveSandboxRequest(input: {
  method: string;
  path: string;
}): SandboxResolveResult {
  if (!isSandboxMethodAllowed(input.method)) {
    return {
      ok: false,
      error: "Sandbox only allows GET. Destructive methods are blocked.",
    };
  }

  const normalized = normalizeSandboxPath(input.path);
  if (!normalized) {
    return {
      ok: false,
      error: "Path must be a same-origin /api/app/* pathname.",
    };
  }

  if (!ALLOWED_PATHS.has(normalized)) {
    return {
      ok: false,
      error: "Path is not on the sandbox allowlist.",
    };
  }

  const endpoint = SANDBOX_ALLOWLIST.find((e) => e.path === normalized);
  if (!endpoint) {
    return {
      ok: false,
      error: "Path is not on the sandbox allowlist.",
    };
  }

  return {
    ok: true,
    method: "GET",
    path: normalized,
    endpoint,
  };
}

/** Mask a BI/API key for request previews — never show the full secret. */
export function maskApiKeyForDisplay(raw: string): string {
  const key = raw.trim();
  if (!key) return "";
  if (key.length <= 8) return "••••••••";
  const prefix = key.slice(0, Math.min(8, key.length));
  return `${prefix}${"•".repeat(Math.min(24, Math.max(8, key.length - 8)))}`;
}

/** Build a same-origin request URL from allowlisted path + optional query. */
export function buildSandboxRequestUrl(path: string, query?: string): string | null {
  const resolved = resolveSandboxRequest({ method: "GET", path });
  if (!resolved.ok) return null;
  const q = (query ?? "").trim().replace(/^\?/, "");
  return q ? `${resolved.path}?${q}` : resolved.path;
}
