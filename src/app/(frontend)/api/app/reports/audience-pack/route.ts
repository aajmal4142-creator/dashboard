import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import {
  assembleAudiencePack,
  type AudiencePackFormat,
} from "@/lib/reports/assembleAudiencePack";
import { isAudienceKind } from "@/lib/reports/audiencePack";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

function parseFormat(value: unknown): AudiencePackFormat {
  if (value === "pdf" || value === "csv" || value === "zip") return value;
  return "zip";
}

/**
 * POST /api/app/reports/audience-pack
 * Body: { periodId?, reportId?, format?, audience?: board_investor|ops|auditor }
 * Assembles a stakeholder audience pack (not an assurance evidence pack).
 */
export async function POST(req: Request) {
  const auth = await getCurrentContext();
  if (!auth.activeOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allowed = await requirePermission(
    auth.user.id,
    auth.activeOrg.id,
    "view",
    "report",
    auth.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const format = parseFormat(body.format);
  const periodId =
    typeof body.periodId === "string" && body.periodId.trim()
      ? body.periodId.trim()
      : null;
  const reportId =
    typeof body.reportId === "string" && body.reportId.trim()
      ? body.reportId.trim()
      : null;
  const audience = isAudienceKind(body.audience) ? body.audience : "board_investor";

  const payload = await getPayload({ config });
  const assembled = await assembleAudiencePack({
    payload,
    organisationId: auth.activeOrg.id,
    periodId,
    reportId,
    format,
    audience,
  });

  if (!assembled.ok) {
    return NextResponse.json({ error: assembled.error }, { status: assembled.status });
  }

  const { result } = assembled;
  return new NextResponse(Buffer.from(result.buffer), {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
