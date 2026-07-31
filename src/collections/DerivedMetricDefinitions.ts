import type { Access, CollectionConfig, PayloadRequest, Where } from "payload";

import { accessibleOrgIds, canWriteOrg } from "@/lib/access/membership";

function orgIdFromData(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const org = (data as { organisation?: string | { id: string } }).organisation;
  if (!org) return null;
  return typeof org === "string" ? org : org.id;
}

async function loadDocSource(
  req: PayloadRequest,
  id: string | number,
): Promise<{ source: string; organisationId: string | null } | null> {
  try {
    const doc = (await req.payload.findByID({
      collection: "derived-metric-definitions",
      id: String(id),
      depth: 0,
      overrideAccess: true,
    })) as {
      source?: string | null;
      organisation?: string | { id: string } | null;
    };
    const org = doc.organisation;
    const organisationId = !org ? null : typeof org === "string" ? org : org.id;
    const source =
      typeof doc.source === "string" ? doc.source : organisationId ? "custom" : "system";
    return { source, organisationId };
  } catch {
    return null;
  }
}

/** System registry rows + org-scoped custom metrics the member can see. */
const derivedMetricRead: Access = async ({ req }) => {
  if (!req.user) return false;
  const ids = await accessibleOrgIds(req);
  const clauses: Where[] = [
    { source: { equals: "system" } },
    // Legacy seeded rows before source field existed
    { source: { exists: false } },
  ];
  if (ids.length > 0) {
    clauses.push({
      and: [{ source: { equals: "custom" } }, { organisation: { in: ids } }],
    });
  }
  return { or: clauses };
};

/** Create only org-scoped custom metrics (admin+). System rows stay seed-only. */
const derivedMetricCreate: Access = async ({ req, data }) => {
  if (!req.user) return false;
  const orgId = orgIdFromData(data);
  if (!orgId) return false;
  if (data && typeof data === "object") {
    const source = (data as { source?: string }).source;
    if (source === "system") return false;
  }
  return canWriteOrg(req, orgId, "admin");
};

/** Update/delete custom org metrics only — never system registry rows. */
function derivedMetricWrite(): Access {
  return async ({ req, id, data }) => {
    if (!req.user) return false;

    if (id) {
      const existing = await loadDocSource(req, id);
      if (!existing) return false;
      if (existing.source === "system" || !existing.organisationId) return false;
      return canWriteOrg(req, existing.organisationId, "admin");
    }

    const orgId = orgIdFromData(data);
    if (!orgId) return false;
    return canWriteOrg(req, orgId, "admin");
  };
}

/**
 * Derived metric registry — system ESRS mappings (seeded) plus org-authored
 * custom formula metrics. System rows are read-only via Membership; custom
 * create/update/delete requires org admin.
 */
export const DerivedMetricDefinitions: CollectionConfig = {
  slug: "derived-metric-definitions",
  admin: {
    useAsTitle: "label",
    defaultColumns: ["key", "source", "unit", "enabled"],
  },
  access: {
    read: derivedMetricRead,
    create: derivedMetricCreate,
    update: derivedMetricWrite(),
    delete: derivedMetricWrite(),
  },
  hooks: {
    beforeValidate: [
      ({ data, operation, originalDoc }) => {
        if (!data) return data;

        const existingSource =
          originalDoc && typeof originalDoc === "object"
            ? (originalDoc as { source?: string }).source
            : undefined;

        if (existingSource === "system" && operation === "update") {
          // Seed / admin override may update mappings; block formula injection on system rows.
          if (data.formula != null && data.formula !== "") {
            throw new Error("System derived metrics cannot carry a user formula.");
          }
          data.source = "system";
          return data;
        }

        const org =
          data.organisation ??
          (originalDoc as { organisation?: unknown } | undefined)?.organisation;
        const hasOrg = Boolean(org);

        if (operation === "create") {
          if (hasOrg) {
            data.source = "custom";
            if (typeof data.formula !== "string" || !data.formula.trim()) {
              throw new Error("Custom derived metrics require a formula.");
            }
            if (data.enabled === undefined) data.enabled = true;
            if (data.usageCount === undefined) data.usageCount = 0;
            if (data.category === undefined) data.category = "other";
            if (!data.frameworkMappings) data.frameworkMappings = [];
          } else {
            data.source = data.source === "custom" ? "custom" : "system";
            if (data.source === "custom") {
              throw new Error("Custom derived metrics require an organisation.");
            }
          }
        }

        if (operation === "update" && hasOrg) {
          data.source = "custom";
          if (data.formula !== undefined) {
            if (typeof data.formula !== "string" || !data.formula.trim()) {
              throw new Error("Custom derived metrics require a formula.");
            }
          }
        }

        return data;
      },
    ],
  },
  fields: [
    { name: "key", type: "text", required: true, unique: true, index: true },
    { name: "label", type: "text", required: true },
    { name: "description", type: "textarea", required: true },
    { name: "unit", type: "text", required: true },
    {
      name: "source",
      type: "select",
      required: true,
      defaultValue: "system",
      index: true,
      options: [
        { label: "System (seeded)", value: "system" },
        { label: "Custom (org)", value: "custom" },
      ],
      admin: {
        description:
          "System rows are seeded ESRS mappings. Custom rows are org formulas.",
      },
    },
    {
      name: "organisation",
      type: "relationship",
      relationTo: "organisations",
      index: true,
      admin: {
        description: "Required for custom metrics. Empty for system registry rows.",
      },
    },
    {
      name: "formula",
      type: "text",
      index: true,
      admin: {
        description:
          'User formula, e.g. "(electricity_kwh) / employees_total". Required when source is custom.',
      },
    },
    {
      name: "category",
      type: "select",
      defaultValue: "other",
      options: [
        { label: "Intensity", value: "intensity" },
        { label: "Efficiency", value: "efficiency" },
        { label: "Ratio", value: "ratio" },
        { label: "Total", value: "total" },
        { label: "Other", value: "other" },
      ],
    },
    {
      name: "enabled",
      type: "checkbox",
      defaultValue: true,
      index: true,
    },
    {
      name: "usageCount",
      type: "number",
      defaultValue: 0,
      admin: { readOnly: true },
    },
    {
      name: "createdBy",
      type: "relationship",
      relationTo: "users",
    },
    {
      name: "frameworkMappings",
      type: "array",
      fields: [
        {
          name: "framework",
          type: "select",
          required: true,
          options: [
            { label: "CSRD Set 1", value: "CSRD_SET1" },
            { label: "CSRD Simplified", value: "CSRD_SIMPLIFIED" },
            { label: "BRSR", value: "BRSR" },
            { label: "VSME", value: "VSME" },
            { label: "GRI", value: "GRI" },
            { label: "ISSB S1", value: "ISSB_S1" },
            { label: "ISSB S2", value: "ISSB_S2" },
            { label: "EU Taxonomy", value: "EU_TAXONOMY" },
          ],
        },
        {
          name: "datapointRef",
          type: "text",
          required: true,
          admin: {
            description:
              "Disclosure code (product alias: disclosureCode). Not a datapoint document id.",
          },
        },
        {
          name: "label",
          type: "text",
          admin: { description: "Human disclosure name (counsel placeholder OK)." },
        },
        { name: "required", type: "checkbox", defaultValue: false },
        {
          name: "contributionOnly",
          type: "checkbox",
          defaultValue: true,
          admin: {
            description:
              "When true, data contributes to this disclosure — never alone satisfies it.",
          },
        },
        { name: "validFrom", type: "date" },
        { name: "validUntil", type: "date" },
        { name: "sourceDoc", type: "text", required: true },
        { name: "sourceSheet", type: "text", required: true },
        { name: "sourceRow", type: "number", required: true },
        { name: "extractedAt", type: "date", required: true },
        {
          name: "approved",
          type: "checkbox",
          required: true,
          defaultValue: false,
          admin: { description: "Must be true to surface in product mappings" },
        },
      ],
    },
  ],
  timestamps: true,
};
