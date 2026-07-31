import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { compareDatapointVersions } from "@/lib/data/recordVersion";
import config from "@/payload.config";

type Props = { params: Promise<{ id: string }> };

function parseVersionParam(raw: string | null, label: string): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`${label} must be a positive integer version number.`);
  }
  return n;
}

/**
 * GET /api/app/datapoints/[id]/versions/compare?v1=&v2=
 * Side-by-side field compare of two datapoint version snapshots (org-scoped).
 */
export async function GET(req: Request, { params }: Props) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const url = new URL(req.url);

  let v1: number;
  let v2: number;
  try {
    const parsedV1 = parseVersionParam(url.searchParams.get("v1"), "v1");
    const parsedV2 = parseVersionParam(url.searchParams.get("v2"), "v2");
    if (parsedV1 == null || parsedV2 == null) {
      return NextResponse.json(
        { error: "Query params v1 and v2 (version numbers) are required." },
        { status: 400 },
      );
    }
    v1 = parsedV1;
    v2 = parsedV2;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid version params";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const payload = await getPayload({ config });

  try {
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
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const comparison = await compareDatapointVersions(payload, {
      organisationId: ctx.activeOrg.id,
      datapointId: id,
      v1,
      v2,
    });
    return NextResponse.json(comparison);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Compare failed";
    const notFound = /not found/i.test(message);
    return NextResponse.json({ error: message }, { status: notFound ? 404 : 400 });
  }
}
