import { getPayload, type CollectionSlug } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { Scope3Validator } from "@/lib/scope3/validation";
import type { ActivityDataField } from "@/lib/scope3/types";
import config from "@/payload.config";

const SCOPE3_SOURCES = "scope3-sources" as CollectionSlug;

interface Scope3SourceDoc {
  organisation: string | { id: string };
  activityDataFields: ActivityDataField[];
}

export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "create",
    "datapoint",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    sourceId?: string;
    activityData?: Record<string, string | number>;
  };

  const { sourceId, activityData } = body;

  if (!sourceId) {
    return NextResponse.json({ error: "sourceId required" }, { status: 400 });
  }

  if (!activityData || typeof activityData !== "object") {
    return NextResponse.json({ error: "activityData required" }, { status: 400 });
  }

  const payload = await getPayload({ config });

  // Fetch source
  const source = await payload.findByID({
    collection: SCOPE3_SOURCES,
    id: sourceId,
    overrideAccess: true,
  });

  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  const sourceDoc = source as unknown as Scope3SourceDoc;

  // Check org access
  if (String(sourceDoc.organisation) !== ctx.activeOrg.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Validate
  const validator = new Scope3Validator();
  const result = await validator.validateActivity(
    activityData,
    sourceDoc.activityDataFields,
  );

  return NextResponse.json({
    valid: result.valid,
    errors: result.errors,
    normalizedData: result.normalizedData,
  });
}
