import type { Access, CollectionConfig, Where } from "payload";

import { denyAll } from "@/lib/access";
import { canWriteOrg } from "@/lib/access/membership";

export const DATAPOINT_VERSIONS_SLUG = "datapoint-versions" as const;

const datapointVersionsRead: Access = async ({ req }) => {
  if (!req.user) return false;
  const { resolveAccessibleOrgs } = await import("@/lib/access/membership");
  const orgs = await resolveAccessibleOrgs(req);
  const orgIds = orgs.map((o) => o.orgId);
  if (orgIds.length === 0) return false;
  const where: Where = { organisation: { in: orgIds } };
  return where;
};

/**
 * Append-only field-level history for datapoints.
 * Distinct from report immutable snapshots — this tracks datapoint create/update/delete.
 */
export const DatapointVersions: CollectionConfig = {
  slug: DATAPOINT_VERSIONS_SLUG,
  admin: {
    defaultColumns: [
      "datapointId",
      "versionNumber",
      "changeType",
      "changedAt",
      "changedBy",
    ],
    description:
      "Field-level datapoint version history (create / update / delete / rollback)",
  },
  access: {
    read: datapointVersionsRead,
    create: async ({ req, data }) => {
      if (!req.user) return false;
      const org =
        typeof data?.organisation === "string"
          ? data.organisation
          : (data?.organisation as { id?: string } | undefined)?.id;
      if (!org) return false;
      return canWriteOrg(req, org, "contributor");
    },
    update: denyAll,
    delete: denyAll,
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
      name: "datapoint",
      type: "relationship",
      relationTo: "datapoints",
      index: true,
      admin: {
        description: "Live relationship when the datapoint still exists",
      },
    },
    {
      name: "datapointId",
      type: "text",
      required: true,
      index: true,
      admin: {
        description: "Stable id — survives datapoint delete",
      },
    },
    {
      name: "versionNumber",
      type: "number",
      required: true,
      index: true,
      admin: { description: "Monotonic per datapointId, starting at 1" },
    },
    {
      name: "changeType",
      type: "select",
      required: true,
      index: true,
      options: [
        { label: "Create", value: "create" },
        { label: "Update", value: "update" },
        { label: "Delete", value: "delete" },
        { label: "Rollback", value: "rollback" },
      ],
    },
    {
      name: "oldValue",
      type: "json",
      admin: { description: "Snapshot before the change (null on create)" },
    },
    {
      name: "newValue",
      type: "json",
      admin: { description: "Snapshot after the change (null on delete)" },
    },
    {
      name: "changedBy",
      type: "text",
      index: true,
      admin: {
        description: "User id or system actor label (e.g. iot:device-1)",
      },
    },
    {
      name: "changedAt",
      type: "date",
      required: true,
      index: true,
    },
    {
      name: "reason",
      type: "textarea",
      admin: { description: "Optional change reason" },
    },
  ],
  timestamps: true,
};
