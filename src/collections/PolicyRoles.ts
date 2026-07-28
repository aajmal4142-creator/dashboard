import type { CollectionConfig } from "payload";

/**
 * Predefined roles with default capabilities.
 * Admin can assign these roles to users, then customize capabilities per-user.
 */
export const PolicyRoles: CollectionConfig = {
  slug: "policy-roles",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "description", "capabilityCount"],
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        description: "Role name (e.g., Admin, Contributor, Viewer)",
      },
    },
    {
      name: "description",
      type: "textarea",
      required: true,
      admin: {
        description: "Human-readable description of this role",
      },
    },
    {
      name: "defaultCapabilities",
      type: "array",
      required: true,
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
          admin: {
            description: "Action the role can perform",
          },
        },
        {
          name: "resource",
          type: "text",
          required: true,
          admin: {
            description: "Resource type (e.g., datapoint, report, organisation)",
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
          admin: {
            description: "Scope of access (own data, team, org-wide, or all)",
          },
        },
      ],
    },
    {
      name: "isSystem",
      type: "checkbox",
      defaultValue: false,
      admin: {
        description: "System roles (Admin, Contributor, Viewer) cannot be deleted",
      },
    },
  ],
};
