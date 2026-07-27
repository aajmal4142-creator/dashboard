import Link from "next/link";
import { getPayload } from "payload";
import { redirect } from "next/navigation";

import { PageFrame } from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

import { GuideChecklist } from "./GuideChecklist";

const STEPS = [
  {
    id: "sector",
    label: "Confirm sector and country",
    href: "/dashboard/onboarding",
  },
  {
    id: "baseline",
    label: "Finish organisation baseline",
    href: "/dashboard/onboarding",
  },
  {
    id: "top3",
    label: "Enter your top three metrics",
    href: "/dashboard/data",
  },
  { id: "supplier", label: "Request one supplier", href: "/dashboard/suppliers" },
  { id: "publish", label: "Publish a living report", href: "/dashboard/reports" },
] as const;

async function deriveDone(organisationId: string): Promise<Record<string, boolean>> {
  const payload = await getPayload({ config });
  const org = await payload.findByID({
    collection: "organisations",
    id: organisationId,
    depth: 0,
    overrideAccess: true,
  });

  const saved =
    org.guideProgress &&
    typeof org.guideProgress === "object" &&
    !Array.isArray(org.guideProgress)
      ? (org.guideProgress as Record<string, boolean>)
      : {};

  const sectorDone = Boolean(org.sector && org.country) || Boolean(saved.sector);
  const baselineDone = Boolean(org.onboardedAt) || Boolean(saved.baseline);

  let top3Done = Boolean(saved.top3);
  try {
    const periods = await payload.find({
      collection: "reporting-periods",
      where: {
        and: [
          { organisation: { equals: organisationId } },
          { status: { equals: "open" } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    });
    const periodId = periods.docs[0]?.id;
    if (periodId && !top3Done) {
      const present = await payload.find({
        collection: "datapoints",
        where: {
          and: [
            { organisation: { equals: organisationId } },
            { period: { equals: periodId } },
          ],
        },
        limit: 50,
        overrideAccess: true,
      });
      const filled = present.docs.filter(
        (d) => d.quality !== "missing" && d.value != null,
      ).length;
      top3Done = filled >= 3;
    }
  } catch {
    /* keep saved */
  }

  let supplierDone = Boolean(saved.supplier);
  try {
    const suppliers = await payload.find({
      collection: "suppliers",
      where: { organisation: { equals: organisationId } },
      limit: 1,
      overrideAccess: true,
    });
    supplierDone = suppliers.totalDocs > 0 || supplierDone;
  } catch {
    /* keep saved */
  }

  let publishDone = Boolean(saved.publish);
  try {
    const reports = await payload.find({
      collection: "reports",
      where: { organisation: { equals: organisationId } },
      limit: 1,
      overrideAccess: true,
    });
    publishDone = reports.totalDocs > 0 || publishDone;
  } catch {
    /* keep saved */
  }

  return {
    sector: sectorDone,
    baseline: baselineDone,
    top3: top3Done,
    supplier: supplierDone,
    publish: publishDone,
  };
}

export default async function GuidePage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/dashboard/onboarding");

  const done = await deriveDone(ctx.activeOrg.id);
  const completed = STEPS.filter((s) => done[s.id]).length;
  const next = STEPS.find((s) => !done[s.id]);

  return (
    <PageFrame
      eyebrow="Getting started"
      title="First report — do this with me"
      help="Checklist from empty to published. Steps complete automatically when the work is done; you can also tick them manually."
      rail={
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Progress
          </p>
          <p className="mt-2 font-data text-[28px] font-bold text-ink">
            {completed}/{STEPS.length}
          </p>
          <div className="mt-3 h-1.5 w-full rounded-[2px] bg-surface-2">
            <div
              className="h-full rounded-[2px] bg-accent transition-[width]"
              style={{ width: `${(completed / STEPS.length) * 100}%` }}
            />
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {next ? (
          <p className="text-[13px] text-ink">
            Next:{" "}
            <Link
              href={next.href}
              className="font-medium text-accent underline-offset-2 hover:underline"
            >
              {next.label}
            </Link>
          </p>
        ) : (
          <p className="text-[13px] text-signal">Checklist complete.</p>
        )}
        <GuideChecklist steps={[...STEPS]} initialDone={done} />
        {next ? (
          <Button asChild size="sm">
            <Link href={next.href}>Continue — {next.label}</Link>
          </Button>
        ) : null}
      </div>
    </PageFrame>
  );
}
