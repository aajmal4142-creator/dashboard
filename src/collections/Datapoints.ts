import type { CollectionConfig, PayloadRequest } from "payload";

import { tenantAccess } from "@/lib/access";
import { NO_SUPPLIER_KEY, supplierKeyFrom } from "@/lib/suppliers/supplierKey";

async function periodIsWritable(req: PayloadRequest, periodId: string): Promise<boolean> {
  const period = await req.payload.findByID({
    collection: "reporting-periods",
    id: periodId,
    depth: 0,
    overrideAccess: true,
  });
  return period.status === "open";
}

function periodIdOf(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

function orgIdOf(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

function supplierIdOf(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

export const Datapoints: CollectionConfig = {
  slug: "datapoints",
  admin: {
    defaultColumns: [
      "metricKey",
      "organisation",
      "period",
      "value",
      "quality",
      "provenance",
    ],
  },
  access: tenantAccess({ writeMin: "contributor", adminWriteMin: "admin" }),
  indexes: [
    {
      // supplierKey is "" for no-supplier rows (never null — Mongo nulls are not unique).
      fields: ["organisation", "period", "metricKey", "supplierKey"],
      unique: true,
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, req, operation, originalDoc }) => {
        const periodId = periodIdOf(data?.period ?? originalDoc?.period);
        if (!periodId) {
          throw new Error("Datapoint requires a reporting period.");
        }
        const writable = await periodIsWritable(req, periodId);
        if (!writable) {
          throw new Error(
            "Reporting period is locked or published. Datapoint writes are rejected.",
          );
        }

        const supplierId = supplierIdOf(data?.supplier ?? originalDoc?.supplier);
        data.supplierKey = supplierKeyFrom(supplierId);

        const organisationId = orgIdOf(data?.organisation ?? originalDoc?.organisation);
        const metricKey = String(data?.metricKey ?? originalDoc?.metricKey ?? "");
        if (organisationId && metricKey) {
          const existing = await req.payload.find({
            collection: "datapoints",
            where: {
              and: [
                { organisation: { equals: organisationId } },
                { period: { equals: periodId } },
                { metricKey: { equals: metricKey } },
                { supplierKey: { equals: data.supplierKey } },
              ],
            },
            limit: 1,
            overrideAccess: true,
          });
          const hit = existing.docs[0];
          const selfId =
            operation === "update" && originalDoc && "id" in originalDoc
              ? String(originalDoc.id)
              : null;
          if (hit && hit.id !== selfId) {
            throw new Error(
              "Duplicate datapoint for organisation/period/metric/supplierKey.",
            );
          }
        }

        if (operation === "create" && req.user?.id) {
          data.enteredBy = req.user.id;
          data.enteredAt = new Date().toISOString();
        }
        return data;
      },
    ],
  },
  fields: [
    {
      name: "organisation",
      type: "relationship",
      relationTo: "organisations",
      required: true,
      index: true,
    },
    {
      name: "period",
      type: "relationship",
      relationTo: "reporting-periods",
      required: true,
      index: true,
    },
    { name: "metricKey", type: "text", required: true, index: true },
    { name: "value", type: "number" },
    { name: "unit", type: "text" },
    {
      name: "quality",
      type: "select",
      required: true,
      options: [
        { label: "Measured", value: "measured" },
        { label: "Calculated", value: "calculated" },
        { label: "Estimated", value: "estimated" },
        { label: "Missing", value: "missing" },
      ],
    },
    {
      name: "provenance",
      type: "select",
      options: [
        { label: "Supplier primary", value: "supplier_primary" },
        { label: "Spend estimate", value: "spend_estimate" },
        { label: "Manual", value: "manual" },
      ],
      admin: {
        description:
          "Where this Scope 3 figure came from. Independent of quality (measured vs estimated).",
      },
    },
    {
      name: "supplier",
      type: "relationship",
      relationTo: "suppliers",
      admin: { description: "Supplier that produced this contribution, when applicable" },
    },
    {
      name: "supplierKey",
      type: "text",
      // Empty string is the no-supplier sentinel (Mongo unique index). Do not mark
      // required — Payload treats "" as missing on required text fields.
      defaultValue: NO_SUPPLIER_KEY,
      index: true,
      admin: {
        description: "Sentinel unique-index key. Empty string = no supplier. Never null.",
        readOnly: true,
      },
    },
    {
      name: "factorId",
      type: "text",
      admin: {
        description: "Pinned EmissionFactor id used when this value was derived",
      },
    },
    {
      name: "evidence",
      type: "relationship",
      relationTo: "evidence",
      hasMany: true,
    },
    {
      name: "source",
      type: "select",
      required: true,
      defaultValue: "manual",
      options: [
        { label: "Manual", value: "manual" },
        { label: "Import", value: "import" },
        { label: "Supplier", value: "supplier" },
        { label: "Estimate", value: "estimate" },
        { label: "API", value: "api" },
        { label: "Internal survey", value: "internal_survey" },
      ],
    },
    {
      name: "approvalState",
      type: "select",
      required: true,
      defaultValue: "pending",
      index: true,
      options: [
        { label: "Pending", value: "pending" },
        { label: "Approved", value: "approved" },
        { label: "Rejected", value: "rejected" },
      ],
    },
    {
      name: "approvalReason",
      type: "textarea",
      admin: { description: "Required when approvalState is rejected." },
    },
    {
      name: "assignedTo",
      type: "relationship",
      relationTo: "users",
      index: true,
    },
    { name: "dueDate", type: "date", index: true },
    {
      name: "taskStatus",
      type: "select",
      defaultValue: "open",
      options: [
        { label: "Open", value: "open" },
        { label: "Submitted", value: "submitted" },
        { label: "Approved", value: "approved" },
      ],
    },
    {
      name: "enteredBy",
      type: "relationship",
      relationTo: "users",
    },
    { name: "enteredAt", type: "date" },
    { name: "note", type: "textarea" },
  ],
};
