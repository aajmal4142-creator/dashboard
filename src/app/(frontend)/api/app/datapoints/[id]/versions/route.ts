import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { listDatapointVersions } from "@/lib/data/recordVersion";
import config from "@/payload.config";

type Props = { params: Promise<{ id: string }> };

/**
 * GET /api/app/datapoints/[id]/versions — version history for one datapoint.
 */
export async function GET(_req: Request, { params }: Props) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const payload = await getPayload({ config });

  const dp = await payload.findByID({
    collection: "datapoints",
    id,
    depth: 0,
    overrideAccess: true,
  });
  const orgId =
    typeof dp.organisation === "string" ? dp.organisation : dp.organisation?.id;
  if (orgId !== ctx.activeOrg.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const versions = await listDatapointVersions(payload, {
    organisationId: ctx.activeOrg.id,
    datapointId: id,
  });

  return NextResponse.json({
    datapointId: id,
    metricKey: dp.metricKey,
    versions,
  });
}
