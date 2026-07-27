import { redirect } from "next/navigation";
import { getPayload } from "payload";

import { getCurrentContext } from "@/lib/auth";
import { calculate, type FactorRecord } from "@/lib/calc";
import { detectAnomalies } from "@/lib/governance/anomalies";
import { calmStatus, readinessBreakdown } from "@/lib/governance/calmStatus";
import { rankGaps } from "@/lib/governance/gaps";
import { plainGapCopy } from "@/lib/governance/plainGaps";
import { hasBaselineDrift, parseRevenueBand } from "@/lib/obligations";
import { metricsAndCompositionFromDatapoints, spendCoveragePct } from "@/lib/suppliers";
import config from "@/payload.config";

import { daysUntil, isPastDue } from "./runway/format";
import { RunwayView } from "./runway/RunwayView";

export default async function RunwayPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    redirect("/dashboard/onboarding");
  }
  if (!ctx.activeOrg.onboardedAt) {
    redirect("/dashboard/onboarding");
  }

  const payload = await getPayload({ config });
  const obligations = await payload.find({
    collection: "compliance-obligations",
    where: { organisation: { equals: ctx.activeOrg.id } },
    limit: 10,
    sort: "filingDeadline",
    overrideAccess: true,
  });
  // Nearest binding deadline first; voluntary (null deadline) sorts last in Mongo.
  const withDeadline = obligations.docs.filter((o) => o.filingDeadline);
  const obligation = withDeadline[0] ?? obligations.docs[0];
  const secondary = withDeadline.slice(1);
  const deadlineIso = obligation?.filingDeadline
    ? String(obligation.filingDeadline)
    : null;
  const days = deadlineIso ? daysUntil(deadlineIso) : null;
  const filingOverdue = deadlineIso ? isPastDue(deadlineIso) : false;
  const canManage = ctx.role === "owner" || ctx.role === "admin";

  const orgDoc = await payload.findByID({
    collection: "organisations",
    id: ctx.activeOrg.id,
    depth: 0,
    overrideAccess: true,
  });
  const drift = obligation
    ? hasBaselineDrift(
        obligation.derivedInputs
          ? {
              country: obligation.derivedInputs.country ?? "",
              headcount: obligation.derivedInputs.headcount ?? null,
              revenueBand: parseRevenueBand(obligation.derivedInputs.revenueBand),
              asOf: obligation.derivedInputs.asOf ?? "",
            }
          : null,
        {
          country: orgDoc.country,
          employeeCount: orgDoc.employeeCount ?? null,
          revenueBand: parseRevenueBand(orgDoc.revenueBand),
        },
      )
    : false;

  const periods = await payload.find({
    collection: "reporting-periods",
    where: {
      and: [
        { organisation: { equals: ctx.activeOrg.id } },
        { status: { equals: "open" } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  });
  const period = periods.docs[0];

  const dps = period
    ? await payload.find({
        collection: "datapoints",
        where: {
          and: [
            { organisation: { equals: ctx.activeOrg.id } },
            { period: { equals: period.id } },
          ],
        },
        limit: 200,
        depth: 0,
        overrideAccess: true,
      })
    : { docs: [] };

  const present = new Set(
    dps.docs
      .filter((d) => d.quality !== "missing" && d.value != null)
      .map((d) => d.metricKey),
  );
  const gaps = rankGaps(present);
  const collected = gaps.collected;
  const required = gaps.total;

  const suppliers = await payload.find({
    collection: "suppliers",
    where: { organisation: { equals: ctx.activeOrg.id } },
    limit: 200,
    overrideAccess: true,
  });
  const coveragePct = spendCoveragePct(
    suppliers.docs.map((s) => ({
      annualSpend: s.annualSpend,
      requestStatus: s.requestStatus ?? "not_sent",
    })),
  );

  const velocityPerDay = collected > 0 ? collected / 30 : 0.2;
  const remaining = Math.max(0, required - collected);
  const daysNeeded = velocityPerDay > 0 ? Math.ceil(remaining / velocityPerDay) : 999;
  const projectedMiss = days !== null && daysNeeded > days ? daysNeeded - days : 0;

  const sectorPrefix = (ctx.activeOrg.sector ?? "C").charAt(0).toUpperCase();
  const cohort = await payload.find({
    collection: "benchmark-stats",
    where: {
      and: [
        { sector: { equals: sectorPrefix } },
        { metricKey: { equals: "electricity_kwh" } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  });
  const median = cohort.docs[0]?.p50 ?? null;
  const cohortSize = cohort.docs[0]?.cohortSize ?? null;

  const anomalies = detectAnomalies(
    dps.docs.map((d) => ({
      metricKey: d.metricKey,
      value: d.value,
      unit: d.unit,
      evidenceCount: Array.isArray(d.evidence) ? d.evidence.length : 0,
      cohortMedian: d.metricKey === "electricity_kwh" ? median : null,
      cohortSize: d.metricKey === "electricity_kwh" ? cohortSize : null,
    })),
  );

  const assignedToMe = dps.docs.filter((d) => {
    const id = typeof d.assignedTo === "string" ? d.assignedTo : d.assignedTo?.id;
    return id === ctx.user.id && d.taskStatus !== "approved";
  });
  const overdue = assignedToMe.filter((d) => d.dueDate && isPastDue(String(d.dueDate)));

  const approvalByMetric: Record<string, string> = {};
  for (const d of dps.docs) {
    approvalByMetric[d.metricKey] = d.approvalState ?? "pending";
  }

  const nextActions = [
    ...gaps.missing.slice(0, 5).map((g) => {
      const plain = plainGapCopy(g.metricKey, g.label);
      return {
        label: plain.action,
        need: plain.need,
        href:
          g.metricKey === "supplier_reported_tco2e"
            ? "/dashboard/suppliers"
            : `/dashboard/data#${g.metricKey}`,
        meta: `impact×ease ${g.rank}`,
        metricKey: g.metricKey,
      };
    }),
    ...anomalies.slice(0, 3).map((a) => ({
      label: `Review unusual figure: ${a.metricKey}`,
      need: a.reason,
      href: `/dashboard/data#${a.metricKey}`,
      meta: a.reason,
      metricKey: a.metricKey,
    })),
  ].slice(0, 8);

  if (nextActions.length === 0) {
    nextActions.push({
      label: "Publish a living report",
      need: "Required runway metrics are present. Share a living link.",
      href: "/dashboard/reports",
      meta: "All required runway metrics present",
      metricKey: "",
    });
  }

  const primaryAction = nextActions[0]!;
  const calm = calmStatus({ daysLeft: days, collected, required });
  const readiness = readinessBreakdown(collected, required);

  const pendingApproval = dps.docs.filter(
    (d) => (d.approvalState ?? "pending") === "pending" && d.quality !== "missing",
  ).length;

  // Live calc — never hardcode Gauge or stack widths
  const { metrics, composition: scope3Composition } = metricsAndCompositionFromDatapoints(
    dps.docs.map((d) => ({
      id: d.id,
      metricKey: d.metricKey,
      value: d.value,
      quality: d.quality,
      unit: d.unit,
      provenance: d.provenance,
      supplierKey: d.supplierKey,
      supplier: d.supplier,
    })),
    suppliers.docs.map((s) => s.id),
  );
  const year = period
    ? new Date(String(period.endDate)).getFullYear()
    : new Date().getFullYear();
  const region = ctx.activeOrg.country || "GB";
  const factorsResult = await payload.find({
    collection: "emission-factors",
    limit: 500,
    overrideAccess: true,
  });
  const factors: FactorRecord[] = factorsResult.docs.map((f) => ({
    id: f.id,
    key: f.key,
    value: f.value,
    unit: f.unit,
    source: f.source,
    publicationYear: f.publicationYear,
    region: f.region,
    validFrom: f.validFrom ? String(f.validFrom) : undefined,
    validUntil: f.validUntil ? String(f.validUntil) : undefined,
  }));

  let overall = 0;
  let scope1 = 0;
  let scope2 = 0;
  let scope3 = 0;
  let calcOk = false;
  try {
    const calc = calculate({ metrics, context: { region, year } }, factors);
    overall = calc.scores.overall;
    scope1 = calc.emissions.scope1.value;
    scope2 = calc.emissions.scope2.value;
    scope3 = calc.emissions.scope3.value;
    calcOk = true;
  } catch {
    calcOk = false;
  }

  const totalEmissions = scope1 + scope2 + scope3;
  const s1Pct = totalEmissions > 0 ? (scope1 / totalEmissions) * 100 : 0;
  const s2Pct = totalEmissions > 0 ? (scope2 / totalEmissions) * 100 : 0;
  const s3Pct = totalEmissions > 0 ? (scope3 / totalEmissions) * 100 : 0;

  return (
    <RunwayView
      periodLabel={
        period
          ? `${String(period.startDate).slice(0, 10)} → ${String(period.endDate).slice(0, 10)}`
          : null
      }
      calm={calm}
      primaryAction={primaryAction}
      days={days}
      filingOverdue={filingOverdue}
      deadlineIso={deadlineIso}
      standardVersion={obligation?.standardVersion ?? null}
      wave={obligation?.wave ?? null}
      readiness={readiness}
      coveragePct={coveragePct}
      pendingApproval={pendingApproval}
      assignedCount={assignedToMe.length}
      overdueCount={overdue.length}
      collected={collected}
      required={required}
      projectedMiss={projectedMiss}
      calcOk={calcOk}
      overall={overall}
      scope1={scope1}
      scope2={scope2}
      scope3={scope3}
      s1Pct={s1Pct}
      s2Pct={s2Pct}
      s3Pct={s3Pct}
      totalEmissions={totalEmissions}
      primarySharePct={scope3Composition.primarySharePct}
      hasScope3Composition={scope3Composition.totalTco2e > 0}
      nextActions={nextActions}
      approvalByMetric={approvalByMetric}
      anomalies={anomalies.map((a) => ({ metricKey: a.metricKey, reason: a.reason }))}
      secondary={secondary.map((o) => ({
        id: o.id,
        standardVersion: o.standardVersion,
        filingDeadline: o.filingDeadline ? String(o.filingDeadline) : null,
      }))}
      derivationReason={obligation?.derivationReason ?? null}
      hasObligation={Boolean(obligation)}
      obligationId={obligation?.id ?? null}
      canManage={canManage}
      needsConfirmation={Boolean(
        obligation &&
        obligation.confidence === "needs_confirmation" &&
        obligation.source !== "manual",
      )}
      baselineDrift={drift && obligation?.source === "manual"}
      obligationSource={obligation?.source ?? null}
      baselineIncomplete={
        !orgDoc.country || orgDoc.employeeCount == null || !orgDoc.revenueBand
      }
      missingCountry={!orgDoc.country}
      missingHeadcount={orgDoc.employeeCount == null}
      missingRevenue={!orgDoc.revenueBand}
    />
  );
}
