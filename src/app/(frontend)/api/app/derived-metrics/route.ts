import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  buildAllowedFormulaKeys,
  buildOrgCustomMetricsWhere,
  createDerivedMetricDef,
  findDerivedMetricDefs,
  findMetricDefinitionKeys,
  mapCustomMetricDoc,
  parseCreateCustomMetricBody,
  slugifyMetricKey,
} from "@/lib/derive";
import config from "@/payload.config";

/** GET /api/app/derived-metrics — list org custom metrics + available formula keys. */
export async function GET() {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await getPayload({ config });
    const rawKeys = await findMetricDefinitionKeys(payload);
    const { options: availableKeys } = buildAllowedFormulaKeys(rawKeys);

    const result = await findDerivedMetricDefs(payload, {
      where: buildOrgCustomMetricsWhere(ctx.activeOrg.id),
      sort: "-updatedAt",
      limit: 200,
    });

    const metrics = result.docs
      .map((doc) => mapCustomMetricDoc(doc))
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const enabled = metrics.filter((m) => m.enabled).length;
    const disabled = metrics.length - enabled;

    const periodsResult = await payload.find({
      collection: "reporting-periods",
      where: { organisation: { equals: ctx.activeOrg.id } },
      sort: "-startDate",
      limit: 24,
      depth: 0,
      overrideAccess: true,
    });

    const periods = periodsResult.docs.map((p) => ({
      id: p.id,
      label: p.label,
    }));

    return NextResponse.json({
      metrics,
      total: result.totalDocs,
      summary: { enabled, disabled },
      availableKeys,
      periods,
      canEdit: ctx.role === "owner" || ctx.role === "admin",
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error listing derived metrics:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST /api/app/derived-metrics — create a custom derived metric (org admin). */
export async function POST(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (ctx.role !== "owner" && ctx.role !== "admin") {
      return NextResponse.json(
        { error: "Only owners and admins can manage custom metrics." },
        { status: 403 },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const payload = await getPayload({ config });
    const rawKeys = await findMetricDefinitionKeys(payload);
    const { allowed } = buildAllowedFormulaKeys(rawKeys);

    const parsed = parseCreateCustomMetricBody(body, allowed);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    let key = parsed.data.key ?? slugifyMetricKey(parsed.data.label);
    const existing = await findDerivedMetricDefs(payload, {
      where: { key: { equals: key } },
      limit: 1,
    });
    if (existing.docs[0]) {
      key = `${key}_${Date.now().toString(36).slice(-4)}`;
    }

    const created = await createDerivedMetricDef(payload, {
      key,
      label: parsed.data.label,
      description: parsed.data.description,
      unit: parsed.data.unit,
      formula: parsed.data.formula,
      category: parsed.data.category,
      enabled: parsed.data.enabled !== false,
      usageCount: 0,
      source: "custom",
      organisation: ctx.activeOrg.id,
      createdBy: ctx.user.id,
      frameworkMappings: [],
    });

    const metric = mapCustomMetricDoc(created);
    return NextResponse.json({ metric }, { status: 201 });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error creating derived metric:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message.includes("formula") || message.includes("organisation")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
