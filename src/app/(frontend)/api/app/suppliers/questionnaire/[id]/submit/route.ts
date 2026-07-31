import { NextResponse } from "next/server";

import { parseResponses, submitPublicResponses } from "@/lib/suppliers";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/app/suppliers/questionnaire/[id]/submit
 * Public submit / draft save. No auth. No deletion.
 */
export async function POST(req: Request, ctx: Ctx) {
  const { id: token } = await ctx.params;
  if (!token || token.length < 8) {
    return NextResponse.json({ error: "Invalid link" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    responses?: unknown;
    draft?: boolean;
  };

  const responses = parseResponses(body.responses);
  try {
    const result = await submitPublicResponses({
      token,
      responses,
      draft: body.draft === true,
    });

    if (!body.draft && result.missing.length > 0) {
      return NextResponse.json(
        {
          error: "Required fields missing",
          missing: result.missing,
          completionPercent: result.completionPercent,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      status: result.status,
      completionPercent: result.completionPercent,
      missing: result.missing,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Submit failed";
    const status = message.includes("not found")
      ? 404
      : message.includes("expired") ||
          message.includes("archived") ||
          message.includes("reviewed")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
