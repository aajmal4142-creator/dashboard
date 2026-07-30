import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { ISSB_DISCLOSURES_SLUG } from "@/collections/IssbDisclosures";
import { writeAuditLog } from "@/lib/audit/write";
import { getCurrentContext } from "@/lib/auth";
import { applyIssbAutofill, inheritS2FromTcfd, parseIssbAnswers } from "@/lib/issb";
import { requirePermission } from "@/lib/policy/protect";
import { loadTcfdEmissions, parseAnswers } from "@/lib/tcfd";
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
 * GET /api/app/issb — list ISSB disclosures
 * POST — create draft (S1 + S2), optionally link TCFD + autofill
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
    collection: ISSB_DISCLOSURES_SLUG,
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
      linkedTcfdId: relationId(d.linkedTcfd),
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
    linkedTcfdId?: string;
    autofill?: boolean;
  };

  const reportingYear =
    typeof body.reportingYear === "number" && body.reportingYear >= 2000
      ? body.reportingYear
      : new Date().getFullYear();

  const payload = await getPayload({ config });

  const existing = await payload.find({
    collection: ISSB_DISCLOSURES_SLUG,
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
        error: `An ISSB disclosure for ${reportingYear} already exists`,
        id: existing.docs[0].id,
      },
      { status: 409 },
    );
  }

  let linkedTcfdId = body.linkedTcfdId ?? null;
  if (!linkedTcfdId) {
    const tcfd = await payload.find({
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
    linkedTcfdId = tcfd.docs[0] ? String(tcfd.docs[0].id) : null;
  }

  let s1Answers = {};
  let s2Answers = {};
  let emissionsSnapshot = null;
  let materialitySummary = null;

  if (body.autofill !== false) {
    emissionsSnapshot = await loadTcfdEmissions(payload, ctx.activeOrg.id, reportingYear);

    const mat = await payload.find({
      collection: "materiality-assessments",
      where: { organisation: { equals: ctx.activeOrg.id } },
      sort: "-updatedAt",
      limit: 1,
      overrideAccess: true,
    });
    const matDoc = mat.docs[0];
    const materialityNote = matDoc?.narrative
      ? String(matDoc.narrative)
      : matDoc
        ? `Materiality assessment ${matDoc.status} on file (${Array.isArray(matDoc.topics) ? matDoc.topics.length : 0} topics).`
        : null;
    materialitySummary = matDoc
      ? { status: matDoc.status, narrative: matDoc.narrative ?? null }
      : null;

    const filled = applyIssbAutofill({
      s1Answers: {},
      s2Answers: {},
      emissions: emissionsSnapshot,
      materialityNote,
    });
    s1Answers = filled.s1Answers;
    s2Answers = filled.s2Answers;

    if (linkedTcfdId) {
      try {
        const tcfdDoc = await payload.findByID({
          collection: TCFD_DISCLOSURES_SLUG,
          id: linkedTcfdId,
          depth: 0,
          overrideAccess: true,
        });
        if (relationId(tcfdDoc.organisation) === ctx.activeOrg.id) {
          s2Answers = inheritS2FromTcfd({
            s2Answers: parseIssbAnswers(s2Answers),
            tcfdAnswers: parseAnswers(tcfdDoc.answers),
          });
        }
      } catch {
        // ignore missing link
      }
    }
  }

  const now = new Date().toISOString();
  const doc = await payload.create({
    collection: ISSB_DISCLOSURES_SLUG,
    data: {
      organisation: ctx.activeOrg.id,
      period: body.periodId || emissionsSnapshot?.periodId || undefined,
      reportingYear,
      status: "draft",
      linkedTcfd: linkedTcfdId || undefined,
      s1Answers,
      s2Answers,
      emissionsSnapshot,
      materialitySummary,
      changeHistory: [
        {
          at: now,
          actor: ctx.user.id,
          action: "created",
          summary: `Draft ISSB ${reportingYear} created`,
        },
      ],
    },
    overrideAccess: true,
  });

  await writeAuditLog(payload, {
    organisationId: ctx.activeOrg.id,
    actorId: ctx.user.id,
    action: "issb.create",
    entityType: "issb-disclosure",
    entityId: String(doc.id),
    after: { reportingYear, status: "draft", linkedTcfdId },
  });

  return NextResponse.json(
    {
      id: doc.id,
      reportingYear: doc.reportingYear,
      status: doc.status,
      linkedTcfdId,
      s1Answers: doc.s1Answers,
      s2Answers: doc.s2Answers,
      emissionsSnapshot: doc.emissionsSnapshot,
    },
    { status: 201 },
  );
}
