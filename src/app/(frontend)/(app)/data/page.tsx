import { redirect } from "next/navigation";
import { getPayload } from "payload";

import { DataWorkspace, type DataRowState } from "@/components/data/DataWorkspace";
import { getCurrentContext } from "@/lib/auth";
import type { Quality } from "@/lib/calc";
import { DATA_METRICS } from "@/lib/data";
import { loadOrgEmissionFactors } from "@/lib/factors";
import {
  applicableFrameworks,
  type DatapointProvenance,
  type FrameworkId,
} from "@/lib/frameworks";
import type { ObligationStandard } from "@/lib/obligations/types";
import config from "@/payload.config";

export default async function DataPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");

  const payload = await getPayload({ config });
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
  const periodLocked = !period || period.status !== "open";

  const initialRows: DataRowState[] = [];
  if (period) {
    const dps = await payload.find({
      collection: "datapoints",
      where: {
        and: [
          { organisation: { equals: ctx.activeOrg.id } },
          { period: { equals: period.id } },
        ],
      },
      limit: 200,
      overrideAccess: true,
    });
    for (const dp of dps.docs) {
      const def = DATA_METRICS.find((m) => m.key === dp.metricKey);
      const provenance = dp.provenance as DatapointProvenance | null | undefined;
      initialRows.push({
        id: String(dp.id),
        metricKey: dp.metricKey,
        value: typeof dp.value === "number" ? dp.value : null,
        quality: dp.quality as Quality,
        unit: dp.unit ?? def?.unit ?? null,
        approvalState: dp.approvalState ?? "pending",
        evidenceCount: Array.isArray(dp.evidence) ? dp.evidence.length : 0,
        assignedTo:
          typeof dp.assignedTo === "string" ? dp.assignedTo : (dp.assignedTo?.id ?? null),
        provenance: provenance ?? null,
      });
    }
  }

  const obligations = await payload.find({
    collection: "compliance-obligations",
    where: { organisation: { equals: ctx.activeOrg.id } },
    limit: 20,
    overrideAccess: true,
  });
  const standardVersions = [
    ...new Set(obligations.docs.map((o) => o.standardVersion as ObligationStandard)),
  ];
  const voluntary =
    obligations.docs.length === 0 ||
    obligations.docs.every((o) => o.filingDeadline == null);
  const frameworksApplicable: FrameworkId[] = applicableFrameworks({
    standardVersions:
      standardVersions.length > 0 ? standardVersions : (["VSME"] as ObligationStandard[]),
    voluntary,
  });

  const orgDoc = await payload.findByID({
    collection: "organisations",
    id: ctx.activeOrg.id,
    depth: 0,
    overrideAccess: true,
  });
  const { factors, standard: emissionsStandard } = await loadOrgEmissionFactors(
    payload,
    orgDoc,
  );

  const year = period
    ? new Date(String(period.endDate)).getFullYear()
    : new Date().getFullYear();

  return (
    <DataWorkspace
      initialRows={initialRows}
      periodLocked={periodLocked}
      factors={factors}
      region={ctx.activeOrg.country || "GB"}
      year={year}
      canWrite={ctx.role !== "viewer" && ctx.role !== null}
      applicableFrameworks={frameworksApplicable}
      emissionsStandard={emissionsStandard}
    />
  );
}
