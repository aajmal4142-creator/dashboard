import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { serializeInternalRequest } from "@/lib/internal-requests";
import config from "@/payload.config";

type RouteParams = { params: Promise<{ id: string }> };

function relId(value: string | { id?: string } | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  return value.id ? String(value.id) : null;
}

/** GET /api/app/internal-requests/[id] — detail with evidence ids + SLA. */
export async function GET(_req: Request, { params }: RouteParams) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json(
      {
        error: "No active organisation. Finish onboarding or switch organisation.",
      },
      { status: 403 },
    );
  }

  const { id } = await params;
  const payload = await getPayload({ config });
  const row = await payload.findByID({
    collection: "internal-data-requests",
    id,
    depth: 1,
    overrideAccess: true,
  });

  const orgId = relId(row.organisation);
  if (orgId !== ctx.activeOrg.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const assigneeId = relId(row.assignee);
  const isAdmin = ctx.role === "owner" || ctx.role === "admin";
  if (!isAdmin && assigneeId !== ctx.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Auto-mark opened for assignee
  if (!isAdmin && assigneeId === ctx.user.id && row.requestStatus === "sent") {
    await payload.update({
      collection: "internal-data-requests",
      id: row.id,
      data: {
        requestStatus: "opened",
        openedAt: new Date().toISOString(),
      },
      overrideAccess: true,
    });
    row.requestStatus = "opened";
  }

  const evidence = (row.evidence ?? []).map((e) => {
    if (typeof e === "string") {
      return { id: e, filename: null as string | null };
    }
    return {
      id: e.id,
      filename: "filename" in e && typeof e.filename === "string" ? e.filename : null,
    };
  });

  return NextResponse.json({
    request: serializeInternalRequest(row),
    evidence,
  });
}
