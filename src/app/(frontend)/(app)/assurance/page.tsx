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
  if (!ctx.activeOrg) redirect("/onboarding");

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
    depth: 1,
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
          body="Publish from Reports, then return here for figure lineage. Meanwhile, browse the curated assurance partner directory or start a limited/reasonable pathway."
          action={
            <div className="flex flex-wrap gap-3">
              <a
                href="/assurance/engagements"
                className="editorial-link text-accent text-[13px]"
              >
                Assurance pathways
              </a>
              <a
                href="/assurance-partners"
                className="editorial-link text-accent text-[13px]"
              >
                Browse assurance partners
              </a>
            </div>
          }
        />
      </PageFrame>
    );
  }

  const data = await loadAssurancePayload(
    payload,
    report as unknown as {
      id: string;
      version: number;
      snapshot?: unknown;
      organisation: string | { id: string };
      period: string | { id: string };
    },
  );
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

  const periodId = typeof report.period === "string" ? report.period : report.period?.id;

  return (
    <AssuranceRoomView
      snapshot={data.snapshot}
      figures={data.figures}
      versionLabel={data.versionLabel}
      sharePath={assuranceToken ? `/a/${assuranceToken}` : null}
      reportId={report.id}
      periodId={periodId ?? null}
    />
  );
}
