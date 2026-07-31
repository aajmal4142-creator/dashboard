import { getPayload } from "payload";
import { notFound } from "next/navigation";

import { InteractiveHtmlReport } from "@/components/reports/InteractiveHtmlReport";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import type { ReportSnapshot } from "@/lib/reports";
import config from "@/payload.config";

export const metadata = {
  title: "HTML report",
};

export default async function ReportHtmlPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ embed?: string }>;
}) {
  const auth = await getCurrentContext();
  if (!auth.activeOrg) notFound();

  const allowed = await requirePermission(
    auth.user.id,
    auth.activeOrg.id,
    "view",
    "report",
    auth.activeOrg.id,
    "organisation",
  );
  if (!allowed) notFound();

  const { id } = await params;
  const sp = await searchParams;
  const embedded = sp.embed === "1" || sp.embed === "true";

  const payload = await getPayload({ config });
  let report;
  try {
    report = await payload.findByID({
      collection: "reports",
      id,
      depth: 0,
      overrideAccess: true,
    });
  } catch {
    notFound();
  }

  const orgId =
    typeof report.organisation === "object" && report.organisation !== null
      ? report.organisation.id
      : String(report.organisation);
  if (orgId !== auth.activeOrg.id) notFound();

  const snapshot = report.snapshot as ReportSnapshot | null;
  if (!snapshot) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-ink">
        <p className="label-caps">HTML report</p>
        <h1 className="font-display mt-4 text-3xl">No snapshot</h1>
        <p className="mt-4 text-ink-muted">
          This report has no snapshot yet. Generate a draft or publish first.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-canvas text-ink">
      <InteractiveHtmlReport
        snapshot={snapshot}
        embedded={embedded}
        generatedAtIso={new Date().toISOString()}
      />
    </main>
  );
}
