import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

/**
 * GET /api/app/email-import/logs
 * Audit trail for inbound email CSV imports (admin).
 */
export async function GET(request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (ctx.role !== "admin" && ctx.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "view",
      "datapoints",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const formId = url.searchParams.get("formId");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? "50") || 50, 100);

    const payload = await getPayload({ config });
    const where: {
      and: Array<Record<string, { equals: string }>>;
    } = {
      and: [{ organisation: { equals: ctx.activeOrg.id } }],
    };
    if (formId) {
      where.and.push({ form: { equals: formId } });
    }

    const logs = await (
      payload.find as (args: {
        collection: "email-import-logs";
        where: typeof where;
        limit: number;
        sort: string;
        overrideAccess: true;
      }) => Promise<{
        totalDocs: number;
        docs: Array<Record<string, unknown>>;
      }>
    )({
      collection: "email-import-logs",
      where,
      limit,
      sort: "-createdAt",
      overrideAccess: true,
    });

    return NextResponse.json({
      total: logs.totalDocs,
      logs: logs.docs.map((l) => ({
        id: l.id,
        form: l.form,
        fromEmail: l.fromEmail,
        subject: l.subject,
        status: l.status,
        reason: l.reason,
        attachmentName: l.attachmentName,
        recordsParsed: l.recordsParsed,
        recordsWritten: l.recordsWritten,
        recordsRejected: l.recordsRejected,
        recordsUnchanged: l.recordsUnchanged,
        replyDelivery: l.replyDelivery,
        createdAt: l.createdAt,
      })),
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(
      "email-import logs error:",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
