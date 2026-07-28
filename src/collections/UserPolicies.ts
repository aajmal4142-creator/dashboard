import type { CollectionConfig } from "payload";

/**
 * User-specific policy assignments.
 * Links a user to a role, with optional custom capability overrides.
 */
export const UserPolicies: CollectionConfig = {
  slug: "user-policies",
  admin: {
    useAsTitle: "userId",
    defaultColumns: [
      "user",
      "organisation",
      "role",
      "customCapabilityCount",
      "createdAt",
    ],
  },
  fields: [
    {
      name: "user",
      type: "relationship",
      relationTo: "users",
      required: true,
      index: true,
      admin: {
        description: "User this policy assignment applies to",
      },
    },
    {
      name: "organisation",
      type: "relationship",
      relationTo: "organisations",
      required: true,
      index: true,
      admin: {
        description:
          "Organisation context for this policy (user may have different roles per org)",
      },
    },
    {
      name: "role",
      type: "relationship",
      relationTo: "policy-roles",
      required: true,
      admin: {
        description: "Assigned role (determines default capabilities)",
      },
    },
    {
      name: "customCapabilities",
      type: "array",
      admin: {
        description:
          "Custom capability overrides. Admin can add/remove capabilities beyond the role",
      },
      fields: [
        {
          name: "action",
          type: "select",
          required: true,
          options: [
            { label: "View", value: "view" },
            { label: "Create", value: "create" },
            { label: "Edit", value: "edit" },
            { label: "Delete", value: "delete" },
            { label: "Approve", value: "approve" },
            { label: "Export", value: "export" },
            { label: "ManageUsers", value: "manage-users" },
            { label: "ManagePolicies", value: "manage-policies" },
          ],
        },
        {
          name: "resource",
          type: "text",
          required: true,
          admin: {
            description: "Resource type (e.g., datapoint, report)",
          },
        },
        {
          name: "scope",
          type: "select",
          required: true,
          options: [
            { label: "Own", value: "own" },
            { label: "Team", value: "team" },
            { label: "Organisation", value: "organisation" },
            { label: "All", value: "all" },
          ],
        },
        {
          name: "isGrant",
          type: "checkbox",
          defaultValue: true,
          admin: {
            description: "TRUE = grant this capability, FALSE = deny/revoke",
          },
        },
      ],
    },
    {
      name: "notes",
      type: "textarea",
      admin: {
        description: "Admin notes about why this custom policy was set",
      },
    },
  ],
  timestamps: true,
};
