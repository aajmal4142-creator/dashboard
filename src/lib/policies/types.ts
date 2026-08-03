/** Org policy document registry types — pure, no I/O. */

export const POLICY_CATEGORIES = [
  "climate",
  "travel",
  "supplier_code",
  "environment",
  "health_safety",
  "ethics",
  "other",
] as const;

export type PolicyCategory = (typeof POLICY_CATEGORIES)[number];

export const POLICY_STATUSES = ["draft", "active", "retired"] as const;
export type PolicyStatus = (typeof POLICY_STATUSES)[number];

export type PolicyRecord = {
  id: string;
  title: string;
  category: PolicyCategory;
  status: PolicyStatus;
  version: string;
  owner: string;
  effectiveDate: string;
  documentId: string | null;
  documentUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PolicyFilter = {
  category?: PolicyCategory;
  status?: PolicyStatus;
  query?: string;
};

export const POLICY_CATEGORY_LABELS: Record<PolicyCategory, string> = {
  climate: "Climate",
  travel: "Travel",
  supplier_code: "Supplier code",
  environment: "Environment",
  health_safety: "Health & safety",
  ethics: "Ethics",
  other: "Other",
};

export const POLICY_STATUS_LABELS: Record<PolicyStatus, string> = {
  draft: "Draft",
  active: "Active",
  retired: "Retired",
};

export function isPolicyCategory(value: unknown): value is PolicyCategory {
  return (
    typeof value === "string" && (POLICY_CATEGORIES as readonly string[]).includes(value)
  );
}

export function isPolicyStatus(value: unknown): value is PolicyStatus {
  return (
    typeof value === "string" && (POLICY_STATUSES as readonly string[]).includes(value)
  );
}

/** Pure list filter for category / status / title search. */
export function filterPolicies(
  policies: readonly PolicyRecord[],
  filter: PolicyFilter = {},
): PolicyRecord[] {
  const q = filter.query?.trim().toLowerCase() ?? "";
  return policies.filter((p) => {
    if (filter.category && p.category !== filter.category) return false;
    if (filter.status && p.status !== filter.status) return false;
    if (q) {
      const hay = `${p.title} ${p.owner} ${p.version} ${p.notes ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
