import type {
  Access,
  CollectionConfig,
  FieldAccess,
  PayloadRequest,
  Where,
} from "payload";

import {
  accessibleOrgIds,
  canWriteOrg,
  hasMinRole,
  orgScopeWhere,
  roleInOrg,
  type MembershipRole,
} from "./membership";

function orgIdFromData(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const org = (data as { organisation?: string | { id: string } }).organisation;
  if (!org) return null;
  return typeof org === "string" ? org : org.id;
}

/** Read: documents whose organisation is in the user's accessible set. */
export const tenantRead: Access = async ({ req }) => {
  if (!req.user) return false;
  return orgScopeWhere(req);
};

/** Create/update/delete gated by minimum role on the target org. */
export function tenantWrite(minimum: MembershipRole = "contributor"): Access {
  return async ({ req, data, id }) => {
    if (!req.user) return false;

    if (id) {
      try {
        // Collection slug is unknown here — fall through to where-clause path
        // when data doesn't carry organisation. Callers with data.organisation win first.
        const fromDataEarly = orgIdFromData(data);
        if (fromDataEarly) {
          return canWriteOrg(req, fromDataEarly, minimum);
        }
      } catch {
        // continue
      }
    }

    const fromData = orgIdFromData(data);
    if (fromData) {
      return canWriteOrg(req, fromData, minimum);
    }

    // Fallback: constrain by accessible orgs at query level for bulk ops
    const ids = await accessibleOrgIds(req);
    if (ids.length === 0) return false;

    const where: Where = { organisation: { in: ids } };
    return where;
  };
}

export const denyAll: Access = () => false;

export const authenticated: Access = ({ req }) => Boolean(req.user);

export function fieldReadOnly(): FieldAccess {
  return () => false;
}

export async function assertMinRole(
  req: PayloadRequest,
  organisationId: string,
  minimum: MembershipRole,
): Promise<boolean> {
  const role = await roleInOrg(req, organisationId);
  return hasMinRole(role, minimum);
}

/** Helper to attach standard tenant access to an org-scoped collection. */
export function tenantAccess(options?: {
  writeMin?: MembershipRole;
  adminWriteMin?: MembershipRole;
}): CollectionConfig["access"] {
  const writeMin = options?.writeMin ?? "contributor";
  return {
    read: tenantRead,
    create: tenantWrite(writeMin),
    update: tenantWrite(writeMin),
    delete: tenantWrite(options?.adminWriteMin ?? "admin"),
  };
}
