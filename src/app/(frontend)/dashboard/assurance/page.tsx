import { redirect } from "next/navigation";
import { getPayload } from "payload";

import { AssuranceRoomView } from "@/components/assurance/AssuranceRoomView";
import { EmptyState, PageFrame } from "@/components/shell/PageFrame";
import { getCurrentContext } from "@/lib/auth";
import { loadAssurancePayload } from "@/lib/assurance/loadAssurance";
import { ensureAssuranceToken } from "@/lib/reports/ensureAssuranceToken";
import config from "@/payload.config";

export default async function AssuranceDashboardPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/dashboard/onboarding");

  const payload = await getPayload({ config });
  const reports = await payload.find({
    collection: "reports",
    where: {
      and: [
        { organisation: { equals: ctx.activeOrg.id } },
        { status: { equals: "published" } },
      ],
    },
    sort: "-version",
    limit: 1,
    overrideAccess: true,
  });
  const report = reports.docs[0];
  if (!report) {
    return (
      <PageFrame
        eyebrow="Assurance"
        title="Assurance Room"
        help="Publish a report version first. The Assurance Room is read-only against frozen snapshots."
      >
        <EmptyState
          title="No published report yet"
          body="Publish from Reports, then return here for figure lineage."
        />
      </PageFrame>
    );
  }

  const data = await loadAssurancePayload(payload, report);
  if (!data) {
    return (
      <PageFrame eyebrow="Assurance" title="Assurance Room">
        <EmptyState
          title="Snapshot missing"
          body="Published report has no snapshot. Re-publish from Reports."
        />
      </PageFrame>
    );
  }

  const assuranceToken = await ensureAssuranceToken(payload, report);

  return (
    <AssuranceRoomView
      snapshot={data.snapshot}
      figures={data.figures}
      versionLabel={data.versionLabel}
      sharePath={assuranceToken ? `/a/${assuranceToken}` : null}
    />
  );
}
