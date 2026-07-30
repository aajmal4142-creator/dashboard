import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { processInboundEmailImport } from "@/lib/emailImport";
import config from "@/payload.config";

/**
 * POST /api/app/email-import/process
 *
 * Membership-authenticated path to exercise the inbound CSV pipeline
 * without Resend (ops / dry-run). Body:
 * {
 *   formId, from, csvText, subject?, dryRun?, skipReply?
 * }
 */
export async function POST(request: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await requirePermission(
      ctx.user.id,
      ctx.activeOrg.id,
      "create",
      "datapoints",
      ctx.activeOrg.id,
      "organisation",
    );
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as {
      formId?: string;
      from?: string;
      csvText?: string;
      filename?: string;
      subject?: string;
      dryRun?: boolean;
      skipReply?: boolean;
    };

    if (!body.formId || !body.from || !body.csvText) {
      return NextResponse.json(
        { error: "formId, from, and csvText are required" },
        { status: 400 },
      );
    }

    const payload = await getPayload({ config });
    const form = await payload.findByID({
      collection: "email-data-collection-forms",
      id: body.formId,
      depth: 0,
      overrideAccess: true,
    });

    const orgId =
      typeof form.organisation === "string" ? form.organisation : form.organisation?.id;
    if (orgId !== ctx.activeOrg.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await processInboundEmailImport({
      raw: {
        from: body.from,
        formId: body.formId,
        subject: body.subject ?? "[ClearESG process]",
        csvText: body.csvText,
        filename: body.filename ?? "import.csv",
      },
      formIdOverride: body.formId,
      dryRun: body.dryRun === true,
      skipReply: body.skipReply === true,
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(
      "email-import process error:",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
