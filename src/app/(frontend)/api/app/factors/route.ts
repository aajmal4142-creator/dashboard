import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  createOrgCustomFactor,
  listOrgFactorAdmin,
  parseCreateOrgFactorBody,
  resolveOrgEmissionsStandard,
} from "@/lib/factors";
import config from "@/payload.config";

function canWriteFactors(role: string | null): boolean {
  return role === "owner" || role === "admin";
}

/**
 * GET /api/app/factors — browse org custom factors (+ optional global seeds).
 * Query: q=search, includeGlobal=1
 */
export async function GET(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? undefined;
    const includeGlobal = url.searchParams.get("includeGlobal") === "1";

    const payload = await getPayload({ config });
    const factors = await listOrgFactorAdmin(payload, ctx.activeOrg.id, {
      includeGlobal,
      q,
    });

    const custom = factors.filter((f) => f.ownership === "custom");
    const active = custom.filter((f) => f.status === "active").length;
    const deactivated = custom.length - active;

    return NextResponse.json({
      factors,
      summary: {
        custom: custom.length,
        active,
        deactivated,
        global: factors.filter((f) => f.ownership === "global").length,
      },
      canEdit: canWriteFactors(ctx.role),
      notice:
        "Missing factors still throw in calc or surface as quality missing. This admin does not invent default values.",
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error listing factors:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/app/factors — create an organisation custom registry factor (owner/admin).
 * Body: { key, value, unit, source, year, geography?, scope?, label? }
 */
export async function POST(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg || !ctx.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canWriteFactors(ctx.role)) {
      return NextResponse.json(
        { error: "Only owners and admins can create custom emission factors." },
        { status: 403 },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = parseCreateOrgFactorBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const payload = await getPayload({ config });
    const org = await payload.findByID({
      collection: "organisations",
      id: ctx.activeOrg.id,
      depth: 0,
      overrideAccess: true,
    });
    const standard = resolveOrgEmissionsStandard(org);

    const created = await createOrgCustomFactor(
      payload,
      ctx.activeOrg.id,
      parsed.data,
      standard,
    );

    return NextResponse.json(
      {
        factor: {
          id: String(created.id),
          key: created.key,
          value: created.value,
          unit: created.unit,
          source: created.source,
          publicationYear: created.publicationYear,
          region: created.region,
          status: created.status,
          ownership: "custom",
        },
        notice:
          "Custom factor saved to the registry. Calc resolves by key/region/year/standard — missing keys still throw.",
      },
      { status: 201 },
    );
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error creating factor:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
