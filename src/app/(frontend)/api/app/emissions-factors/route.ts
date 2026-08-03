import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import {
  EMISSIONS_STANDARDS,
  isEmissionsStandard,
  loadEmissionFactors,
  type EmissionsStandard,
} from "@/lib/factors";
import config from "@/payload.config";

/**
 * GET /api/app/emissions-factors?standard=GHGProtocol2004&scope=1&key=diesel
 * Registry factors filtered by methodology standard (and optional scope/key).
 */
export async function GET(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const url = new URL(req.url);
  const standardParam = url.searchParams.get("standard");
  const scope = url.searchParams.get("scope");
  const key = url.searchParams.get("key");

  let standard: EmissionsStandard | undefined;
  if (standardParam) {
    if (!isEmissionsStandard(standardParam)) {
      return NextResponse.json(
        {
          error: `Invalid standard. Allowed: ${EMISSIONS_STANDARDS.join(", ")}`,
        },
        { status: 400 },
      );
    }
    standard = standardParam;
  }

  const payload = await getPayload({ config });
  let factors = await loadEmissionFactors(payload, {
    standard,
    limit: 500,
    organisationId: ctx.activeOrg.id,
  });

  if (scope === "1" || scope === "2" || scope === "3") {
    const scoped = await payload.find({
      collection: "emission-factors",
      where: {
        and: [
          ...(standard ? [{ standard: { equals: standard } }] : []),
          { scope: { equals: scope } },
        ],
      },
      limit: 500,
      overrideAccess: true,
    });
    const ids = new Set(scoped.docs.map((d) => String(d.id)));
    factors = factors.filter((f) => ids.has(f.id));
  }

  if (key) {
    factors = factors.filter((f) => f.key === key);
  }

  return NextResponse.json({
    standard: standard ?? null,
    count: factors.length,
    factors,
  });
}
