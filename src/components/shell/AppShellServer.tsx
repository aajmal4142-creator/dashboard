import { AppShell } from "@/components/shell/AppShell";
import { getCurrentContext } from "@/lib/auth";
import { flattenHierarchyForSwitcher, getHierarchyTree } from "@/lib/consolidation";
import config from "@/payload.config";
import { getPayload } from "payload";

/** Server wrapper — lifts shell into layout with real Membership context. */
export async function AppShellServer({
  children,
  logoUrl = null,
}: {
  children: React.ReactNode;
  logoUrl?: string | null;
}) {
  const ctx = await getCurrentContext();
  const membershipOrgs = ctx.memberships.map((m) => ({
    id: m.organisationId,
    name: m.organisationName || m.organisationId,
  }));

  let orgs: Array<{ id: string; name: string; label?: string; depth?: number }> =
    membershipOrgs;

  // Hierarchy-aware switcher labels (Membership-filtered only)
  if (membershipOrgs.length > 1) {
    try {
      const payload = await getPayload({ config });
      const { forest } = await getHierarchyTree(
        payload,
        membershipOrgs.map((o) => o.id),
      );
      const flat = flattenHierarchyForSwitcher(forest);
      if (flat.length > 0) {
        const ordered: typeof orgs = [];
        const seen = new Set<string>();
        for (const f of flat) {
          const m = membershipOrgs.find((o) => o.id === f.id);
          if (!m) continue;
          ordered.push({
            id: m.id,
            name: m.name,
            label: f.label,
            depth: f.depth,
          });
          seen.add(m.id);
        }
        for (const o of membershipOrgs) {
          if (!seen.has(o.id)) ordered.push(o);
        }
        orgs = ordered;
      }
    } catch {
      /* fall back to flat membership list */
    }
  }

  let badges = { requests: 0, questionnaires: 0 };
  if (ctx.activeOrg) {
    try {
      const payload = await getPayload({ config });
      const openRequests = await payload.find({
        collection: "internal-data-requests",
        where: {
          and: [
            { organisation: { equals: ctx.activeOrg.id } },
            { status: { equals: "open" } },
          ],
        },
        limit: 0,
        overrideAccess: true,
      });
      badges = {
        requests: openRequests.totalDocs,
        questionnaires: 0,
      };
    } catch {
      /* collection may be empty / unavailable in some envs */
    }
  }

  return (
    <AppShell
      orgs={orgs}
      activeOrgId={ctx.activeOrg?.id ?? null}
      activeOrgName={ctx.activeOrg?.name ?? null}
      logoUrl={logoUrl ?? ctx.activeOrg?.brand.branding.logoUrl ?? null}
      role={ctx.role}
      orgType={ctx.activeOrg?.type ?? null}
      onboarded={Boolean(ctx.activeOrg?.onboardedAt)}
      badges={badges}
    >
      {children}
    </AppShell>
  );
}
