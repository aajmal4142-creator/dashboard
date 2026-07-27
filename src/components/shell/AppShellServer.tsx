import { AppShell } from "@/components/shell/AppShell";
import { getCurrentContext } from "@/lib/auth";
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
  const orgs = ctx.memberships.map((m) => ({
    id: m.organisationId,
    name: m.organisationName || m.organisationId,
  }));

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
