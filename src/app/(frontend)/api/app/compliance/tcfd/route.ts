import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit/write";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { applyTcfdAutofill, loadOrgScenarios, loadTcfdEmissions } from "@/lib/tcfd";
import { TCFD_DISCLOSURES_SLUG } from "@/collections/TcfdDisclosures";
import config from "@/payload.config";

function relationId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

/**
 * GET /api/app/compliance/tcfd — list TCFD disclosures for active org
 * POST — create draft for a reporting year (optionally autofill)
 */
export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.user || !ctx.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "view",
    "report",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: TCFD_DISCLOSURES_SLUG,
    where: { organisation: { equals: ctx.activeOrg.id } },
    sort: "-reportingYear",
    limit: 50,
    overrideAccess: true,
  });

  return NextResponse.json({
    disclosures: result.docs.map((d) => ({
      id: d.id,
      reportingYear: d.reportingYear,
      status: d.status,
      periodId: relationId(d.period),
      finalisedAt: d.finalisedAt ?? null,
      updatedAt: d.updatedAt,
    })),
    total: result.totalDocs,
  });
}

export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.user || !ctx.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "create",
    "report",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as {
    reportingYear?: number;
    periodId?: string;
    autofill?: boolean;
  };

  const reportingYear =
    typeof body.reportingYear === "number" && body.reportingYear >= 2000
      ? body.reportingYear
      : new Date().getFullYear();

  const payload = await getPayload({ config });

  const existing = await payload.find({
    collection: TCFD_DISCLOSURES_SLUG,
    where: {
      and: [
        { organisation: { equals: ctx.activeOrg.id } },
        { reportingYear: { equals: reportingYear } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  });

  if (existing.docs[0]) {
    return NextResponse.json(
      {
        error: `A TCFD disclosure for ${reportingYear} already exists`,
        id: existing.docs[0].id,
      },
      { status: 409 },
    );
  }

  let answers = {};
  let emissionsSnapshot = null;
  let scenarioLinks: Array<{ scenario: string; role: string }> = [];

  if (body.autofill !== false) {
    emissionsSnapshot = await loadTcfdEmissions(payload, ctx.activeOrg.id, reportingYear);
    const scenarios = await loadOrgScenarios(payload, ctx.activeOrg.id);
    answers = applyTcfdAutofill({
      existing: {},
      emissions: emissionsSnapshot,
      scenarios,
    });
    scenarioLinks = scenarios.slice(0, 5).map((s) => ({
      scenario: s.id,
      role: "strategy",
    }));
  }

  const now = new Date().toISOString();
  const doc = await payload.create({
    collection: TCFD_DISCLOSURES_SLUG,
    data: {
      organisation: ctx.activeOrg.id,
      period: body.periodId || emissionsSnapshot?.periodId || undefined,
      reportingYear,
      status: "draft",
      answers,
      emissionsSnapshot,
      scenarioLinks,
      changeHistory: [
        {
          at: now,
          actor: ctx.user.id,
          action: "created",
          summary: `Draft TCFD ${reportingYear} created`,
        },
      ],
    },
    overrideAccess: true,
  });

  await writeAuditLog(payload, {
    organisationId: ctx.activeOrg.id,
    actorId: ctx.user.id,
    action: "tcfd.create",
    entityType: "tcfd-disclosure",
    entityId: String(doc.id),
    after: { reportingYear, status: "draft" },
  });

  return NextResponse.json(
    {
      id: doc.id,
      reportingYear: doc.reportingYear,
      status: doc.status,
      answers: doc.answers,
      emissionsSnapshot: doc.emissionsSnapshot,
    },
    { status: 201 },
  );
}
