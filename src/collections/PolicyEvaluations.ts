import type { CollectionConfig } from "payload";

/**
 * Audit log for policy evaluations.
 * Lightweight structure (no embedded docs) for efficient MongoDB queries.
 */
export const PolicyEvaluations: CollectionConfig = {
  slug: "policy-evaluations",
  admin: {
    useAsTitle: "userId",
    defaultColumns: ["userId", "action", "resource", "decision", "evaluatedAt"],
  },
  fields: [
    {
      name: "userId",
      type: "text",
      required: true,
      index: true,
      admin: {
        description: "User ID who attempted the action",
      },
    },
    {
      name: "organisationId",
      type: "text",
      required: true,
      index: true,
      admin: {
        description: "Organisation context",
      },
    },
    {
      name: "action",
      type: "text",
      required: true,
      index: true,
      admin: {
        description: "Action attempted (view, create, edit, delete, etc)",
      },
    },
    {
      name: "resource",
      type: "text",
      required: true,
      index: true,
      admin: {
        description: "Resource type (datapoint, report, organisation, etc)",
      },
    },
    {
      name: "resourceId",
      type: "text",
      required: true,
      index: true,
      admin: {
        description: "ID of the specific resource",
      },
    },
    {
      name: "decision",
      type: "select",
      required: true,
      index: true,
      options: [
        { label: "Allowed", value: "allowed" },
        { label: "Denied", value: "denied" },
      ],
      admin: {
        description: "Whether the action was allowed or denied",
      },
    },
    {
      name: "reason",
      type: "text",
      admin: {
        description:
          "Brief explanation of decision (e.g., 'role does not have permission')",
      },
    },
    {
      name: "userRole",
      type: "text",
      admin: {
        description: "User's role at time of evaluation",
      },
    },
    {
      name: "evaluatedAt",
      type: "date",
      required: true,
      index: true,
      admin: {
        description: "When this action was evaluated",
      },
    },
    {
      name: "ip",
      type: "text",
      admin: {
        description: "IP address of the request",
      },
    },
  ],
  timestamps: false, // We use evaluatedAt instead
};
