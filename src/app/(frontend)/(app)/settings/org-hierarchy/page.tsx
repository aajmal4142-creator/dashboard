import { redirect } from "next/navigation";
import { getPayload } from "payload";

import { OrgHierarchyClient } from "@/app/(frontend)/(app)/settings/org-hierarchy/OrgHierarchyClient";
import { PageFrame } from "@/components/shell/PageFrame";
import { getCurrentContext } from "@/lib/auth";
import { getHierarchyTree } from "@/lib/consolidation";
import config from "@/payload.config";

export default async function OrgHierarchySettingsPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");

  const payload = await getPayload({ config });
  const accessibleOrgIds = ctx.memberships.map((m) => m.organisationId);
  const { forest, orgs } = await getHierarchyTree(payload, accessibleOrgIds);
  const canEdit = ctx.role === "owner" || ctx.role === "admin";

  return (
    <PageFrame
      eyebrow="Settings"
      title="Org hierarchy"
      help="Link subsidiaries for consolidated emissions reporting. Parent must be set explicitly. Circular hierarchies are rejected. Only organisations you have Membership on appear here."
    >
      <OrgHierarchyClient
        activeOrgId={ctx.activeOrg.id}
        activeOrgName={ctx.activeOrg.name}
        canEdit={canEdit}
        initialForest={forest}
        initialOrgs={orgs.map((o) => ({
          id: o.id,
          name: o.name,
          parentId: o.parentId,
          consolidationMethod: o.consolidationMethod,
          ownershipPercent: o.ownershipPercent,
        }))}
      />
    </PageFrame>
  );
}
