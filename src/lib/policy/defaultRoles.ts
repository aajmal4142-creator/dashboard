/**
 * Default system roles and their capabilities.
 * Admin can create custom roles, but these 4 are always available.
 */

import type { Action, Scope } from "./types";

interface DefaultRole {
  name: string;
  description: string;
  isSystem: boolean;
  defaultCapabilities: Array<{
    action: Action;
    resource: string;
    scope: Scope;
  }>;
}

export const DEFAULT_ROLES: DefaultRole[] = [
  {
    name: "Admin",
    description: "Full access to all resources and settings",
    isSystem: true,
    defaultCapabilities: [
      // Datapoints
      { action: "view", resource: "datapoint", scope: "all" },
      { action: "create", resource: "datapoint", scope: "organisation" },
      { action: "edit", resource: "datapoint", scope: "all" },
      { action: "delete", resource: "datapoint", scope: "all" },
      { action: "approve", resource: "datapoint", scope: "all" },
      { action: "export", resource: "datapoint", scope: "all" },

      // Reports
      { action: "view", resource: "report", scope: "all" },
      { action: "create", resource: "report", scope: "organisation" },
      { action: "edit", resource: "report", scope: "all" },
      { action: "delete", resource: "report", scope: "all" },
      { action: "export", resource: "report", scope: "all" },

      // Organisation
      { action: "view", resource: "organisation", scope: "organisation" },
      { action: "edit", resource: "organisation", scope: "organisation" },

      // Team members
      { action: "view", resource: "user", scope: "organisation" },
      { action: "manage-users", resource: "user", scope: "organisation" },

      // Policies
      { action: "manage-policies", resource: "policy", scope: "organisation" },

      // Compliance
      { action: "view", resource: "compliance", scope: "organisation" },
      { action: "create", resource: "compliance", scope: "organisation" },
      { action: "edit", resource: "compliance", scope: "organisation" },
    ],
  },
  {
    name: "Contributor",
    description: "Can create and edit data, view reports",
    isSystem: true,
    defaultCapabilities: [
      // Datapoints
      { action: "view", resource: "datapoint", scope: "organisation" },
      { action: "create", resource: "datapoint", scope: "organisation" },
      { action: "edit", resource: "datapoint", scope: "own" },

      // Reports
      { action: "view", resource: "report", scope: "organisation" },
      { action: "export", resource: "report", scope: "organisation" },

      // Organisation
      { action: "view", resource: "organisation", scope: "organisation" },

      // Compliance
      { action: "view", resource: "compliance", scope: "organisation" },
    ],
  },
  {
    name: "Viewer",
    description: "Read-only access to all data",
    isSystem: true,
    defaultCapabilities: [
      // Datapoints
      { action: "view", resource: "datapoint", scope: "organisation" },

      // Reports
      { action: "view", resource: "report", scope: "organisation" },
      { action: "export", resource: "report", scope: "organisation" },

      // Organisation
      { action: "view", resource: "organisation", scope: "organisation" },

      // Compliance
      { action: "view", resource: "compliance", scope: "organisation" },
    ],
  },
  {
    name: "Consultant",
    description: "External consultant with limited access",
    isSystem: true,
    defaultCapabilities: [
      // Datapoints
      { action: "view", resource: "datapoint", scope: "team" },

      // Reports
      { action: "view", resource: "report", scope: "team" },
      { action: "export", resource: "report", scope: "team" },

      // Compliance
      { action: "view", resource: "compliance", scope: "team" },
    ],
  },
];
