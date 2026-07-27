import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, type AuthContext } from "@/lib/auth";
import {
  buildImportWorkbook,
  dryRunImport,
  parseFileToImportRows,
  writeDatapoint,
  type ExistingDatapoint,
  type ImportColumn,
  type ImportRowInput,
  IMPORT_COLUMNS,
} from "@/lib/data";
import type { Quality } from "@/lib/calc";
import { BillingDeniedError, billingDeniedResponse } from "@/lib/billing";
import { ensureOpenPeriod } from "@/lib/org/period";
import config from "@/payload.config";

async function loadExisting(
  organisationId: string,
  periodId: string,
): Promise<{ existing: ExistingDatapoint[]; periodLocked: boolean }> {
  const payload = await getPayload({ config });
  const period = await payload.findByID({
    collection: "reporting-periods",
    id: periodId,
    depth: 0,
    overrideAccess: true,
  });
  const dps = await payload.find({
    collection: "datapoints",
    where: {
      and: [
        { organisation: { equals: organisationId } },
        { period: { equals: periodId } },
      ],
    },
    limit: 500,
    overrideAccess: true,
  });
  return {
    periodLocked: period.status !== "open",
    existing: dps.docs.map((d) => ({
      metricKey: d.metricKey,
      value: typeof d.value === "number" ? d.value : null,
      unit: d.unit ?? null,
      quality: d.quality as Quality,
      approvalState: d.approvalState,
    })),
  };
}

async function requireWriteContext(): Promise<
  { ctx: AuthContext } | { response: NextResponse }
> {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return {
      response: NextResponse.json(
        {
          error: "No active organisation. Finish onboarding or switch organisation.",
        },
        { status: 403 },
      ),
    };
  }
  if (ctx.role === "viewer") {
    return {
      response: NextResponse.json(
        { error: "Viewers cannot write datapoints" },
        { status: 403 },
      ),
    };
  }
  return { ctx };
}

/** GET — download smart/blank xlsx template */
export async function GET(req: Request) {
  const gate = await requireWriteContext();
  if ("response" in gate) return gate.response;
  const { ctx } = gate;

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") === "blank" ? "blank" : "smart";
  const colsParam = url.searchParams.get("columns");
  const columns: ImportColumn[] = colsParam
    ? (colsParam
        .split(",")
        .filter((c) =>
          (IMPORT_COLUMNS as readonly string[]).includes(c),
        ) as ImportColumn[])
    : [...IMPORT_COLUMNS];

  let periodLabel = "";
  try {
    const periodId = await ensureOpenPeriod(
      ctx.activeOrg!.id,
      ctx.activeOrg!.plan,
      ctx.activeOrg!.subscriptionStatus,
    );
    const payload = await getPayload({ config });
    const period = await payload.findByID({
      collection: "reporting-periods",
      id: periodId,
      depth: 0,
      overrideAccess: true,
    });
    periodLabel = `${period.startDate}–${period.endDate}`;
  } catch {
    periodLabel = "";
  }

  const buf = buildImportWorkbook({ kind, columns, periodLabel });
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="clearesg-data-${kind}.xlsx"`,
    },
  });
}

/** POST — dry-run or commit import / bulk paste */
export async function POST(req: Request) {
  const gate = await requireWriteContext();
  if ("response" in gate) return gate.response;
  const { ctx } = gate;

  const contentType = req.headers.get("content-type") ?? "";
  let mode: "dry-run" | "commit" = "dry-run";
  let rows: ImportRowInput[] = [];
  let source: "import" | "manual" = "import";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      mode = form.get("mode") === "commit" ? "commit" : "dry-run";
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "file required" }, { status: 400 });
      }
      const buffer = await file.arrayBuffer();
      rows = parseFileToImportRows(buffer, file.name);
      source = "import";
    } else {
      const body = (await req.json()) as {
        mode?: "dry-run" | "commit";
        rows?: ImportRowInput[];
        source?: "import" | "paste";
      };
      mode = body.mode === "commit" ? "commit" : "dry-run";
      rows = body.rows ?? [];
      source = body.source === "paste" ? "manual" : "import";
    }
  } catch {
    return NextResponse.json(
      { error: "Could not parse import payload" },
      { status: 400 },
    );
  }

  let periodId: string;
  try {
    periodId = await ensureOpenPeriod(
      ctx.activeOrg!.id,
      ctx.activeOrg!.plan,
      ctx.activeOrg!.subscriptionStatus,
    );
  } catch (err) {
    if (err instanceof BillingDeniedError) {
      return NextResponse.json(billingDeniedResponse(err), { status: 402 });
    }
    throw err;
  }

  const { existing, periodLocked } = await loadExisting(ctx.activeOrg!.id, periodId);
  const diff = dryRunImport({ rows, existing, periodLocked });

  if (mode === "dry-run") {
    return NextResponse.json({ ok: true, ...diff });
  }

  if (periodLocked) {
    return NextResponse.json(
      {
        error: "Reporting period is locked or published. Writes are refused.",
        ...diff,
      },
      { status: 409 },
    );
  }

  const writable = diff.rows.filter(
    (r) => (r.kind === "added" || r.kind === "changed") && r.after,
  );
  if (diff.rejected > 0 && writable.length === 0) {
    return NextResponse.json(
      { error: "Nothing to commit — all rows rejected", ...diff },
      { status: 400 },
    );
  }

  const payload = await getPayload({ config });
  let written = 0;
  let approvalResets = 0;
  for (const row of writable) {
    if (!row.after) continue;
    const result = await writeDatapoint(payload, {
      organisationId: ctx.activeOrg!.id,
      periodId,
      metricKey: row.metricKey,
      value: row.after.value,
      unit: row.after.unit,
      quality: row.after.quality,
      source: source === "import" ? "import" : "manual",
      actorId: ctx.user.id,
    });
    written += 1;
    if (result.approvalReset) approvalResets += 1;
  }

  return NextResponse.json({
    ok: true,
    written,
    approvalResets,
    skippedRejected: diff.rejected,
    skippedUnchanged: diff.unchanged,
  });
}
