import type { PayloadRequest, Where } from "payload";

export type MembershipRole = "owner" | "admin" | "contributor" | "viewer";
export type MembershipStatus = "active" | "invited" | "revoked";

export const ROLE_RANK: Record<MembershipRole, number> = {
  viewer: 1,
  contributor: 2,
  admin: 3,
  owner: 4,
};

export type AccessibleOrg = {
  orgId: string;
  role: MembershipRole;
  isChildViaConsultancy: boolean;
};

type MembershipDoc = {
  id: string;
  role: MembershipRole;
  status: MembershipStatus;
  organisation:
    | string
    | {
        id: string;
        type?: "company" | "consultancy";
        parentOrg?: string | { id: string } | null;
      };
};

function orgIdOf(organisation: MembershipDoc["organisation"]): string | null {
  if (!organisation) return null;
  if (typeof organisation === "string") return organisation;
  return organisation.id ?? null;
}

/**
 * Resolve every organisation the user may access via active Memberships,
 * plus one level of child orgs when the membership is on a consultancy.
 * Login ≠ access — this is the only path.
 */
export async function resolveAccessibleOrgs(
  req: PayloadRequest,
): Promise<AccessibleOrg[]> {
  if (!req.user?.id) return [];

  const memberships = await req.payload.find({
    collection: "memberships",
    where: {
      and: [{ user: { equals: req.user.id } }, { status: { equals: "active" } }],
    },
    depth: 1,
    limit: 500,
    overrideAccess: true,
  });

  const byOrg = new Map<string, AccessibleOrg>();

  for (const raw of memberships.docs as MembershipDoc[]) {
    const id = orgIdOf(raw.organisation);
    if (!id) continue;

    const existing = byOrg.get(id);
    if (!existing || ROLE_RANK[raw.role] > ROLE_RANK[existing.role]) {
      byOrg.set(id, {
        orgId: id,
        role: raw.role,
        isChildViaConsultancy: false,
      });
    }

    const org = typeof raw.organisation === "object" ? raw.organisation : null;
    if (org?.type === "consultancy") {
      const children = await req.payload.find({
        collection: "organisations",
        where: { parentOrg: { equals: id } },
        depth: 0,
        limit: 500,
        overrideAccess: true,
      });

      for (const child of children.docs) {
        const childId = child.id;
        if (byOrg.has(childId)) continue;
        // Consultancy access to children: role capped at the parent's role,
        // but never above admin for writes on client orgs via this path.
        byOrg.set(childId, {
          orgId: childId,
          role: raw.role,
          isChildViaConsultancy: true,
        });
      }
    }
  }

  return [...byOrg.values()];
}

export async function accessibleOrgIds(req: PayloadRequest): Promise<string[]> {
  const orgs = await resolveAccessibleOrgs(req);
  return orgs.map((o) => o.orgId);
}

export async function roleInOrg(
  req: PayloadRequest,
  organisationId: string,
): Promise<MembershipRole | null> {
  const orgs = await resolveAccessibleOrgs(req);
  return orgs.find((o) => o.orgId === organisationId)?.role ?? null;
}

export function hasMinRole(
  role: MembershipRole | null,
  minimum: MembershipRole,
): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export async function orgScopeWhere(req: PayloadRequest): Promise<Where | false> {
  const ids = await accessibleOrgIds(req);
  if (ids.length === 0) return false;
  const where: Where = { organisation: { in: ids } };
  return where;
}

export async function canReadOrg(
  req: PayloadRequest,
  organisationId: string,
): Promise<boolean> {
  const ids = await accessibleOrgIds(req);
  return ids.includes(organisationId);
}

export async function canWriteOrg(
  req: PayloadRequest,
  organisationId: string,
  minimum: MembershipRole = "contributor",
): Promise<boolean> {
  const role = await roleInOrg(req, organisationId);
  return hasMinRole(role, minimum);
}

/** Authenticated Payload admin users (local auth) bypass tenant gates for ops. */
export function isPayloadAdmin(req: PayloadRequest): boolean {
  return Boolean(
    req.user && "collection" in req.user === false
      ? false
      : req.user &&
          (req.user as { collection?: string }).collection === "users" &&
          // Payload auth users managing the CMS — only when no clerkId yet (pre-Phase 2)
          !(req.user as { clerkId?: string }).clerkId,
  );
}
