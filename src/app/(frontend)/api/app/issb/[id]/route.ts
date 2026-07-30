import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { ISSB_DISCLOSURES_SLUG } from "@/collections/IssbDisclosures";
import { TCFD_DISCLOSURES_SLUG } from "@/collections/TcfdDisclosures";
import { writeAuditLog } from "@/lib/audit/write";
import { getCurrentContext } from "@/lib/auth";
import {
  applyIssbAutofill,
  buildIssbSnapshot,
  diffIssbAnswerMaps,
  inheritS2FromTcfd,
  parseIssbAnswers,
  type IssbAnswersMap,
} from "@/lib/issb";
import { requirePermission } from "@/lib/policy/protect";
import { loadTcfdEmissions, parseAnswers, parseEmissions } from "@/lib/tcfd";
import config from "@/payload.config";

type Ctx = { params: Promise<{ id: string }> };

function relationId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

async function loadOwned(id: string, orgId: string) {
  const payload = await getPayload({ config });
  let doc;
  try {
    doc = await payload.findByID({
      collection: ISSB_DISCLOSURES_SLUG,
      id,
      depth: 0,
      overrideAccess: true,
    });
  } catch {
    return { payload, doc: null };
  }
  if (relationId(doc.organisation) !== orgId) return { payload, doc: null };
  return { payload, doc };
}

export async function GET(_req: Request, ctxParams: Ctx) {
  const auth = await getCurrentContext();
  if (!auth.user || !auth.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const allowed = await requirePermission(
    auth.user.id,
    auth.activeOrg.id,
    "view",
    "report",
    auth.activeOrg.id,
    "organisation",
  );
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctxParams.params;
  const { doc } = await loadOwned(id, auth.activeOrg.id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: doc.id,
    reportingYear: doc.reportingYear,
    status: doc.status,
    linkedTcfdId: relationId(doc.linkedTcfd),
    s1Answers: doc.s1Answers ?? {},
    s2Answers: doc.s2Answers ?? {},
    emissionsSnapshot: doc.emissionsSnapshot ?? null,
    materialitySummary: doc.materialitySummary ?? null,
    changeHistory: doc.changeHistory ?? [],
    finalisedAt: doc.finalisedAt ?? null,
    snapshot: doc.snapshot ?? null,
  });
}

export async function PATCH(req: Request, ctxParams: Ctx) {
  const auth = await getCurrentContext();
  if (!auth.user || !auth.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const allowed = await requirePermission(
    auth.user.id,
    auth.activeOrg.id,
    "edit",
    "report",
    auth.activeOrg.id,
    "organisation",
  );
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctxParams.params;
  const { payload, doc } = await loadOwned(id, auth.activeOrg.id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (doc.status === "final") {
    return NextResponse.json(
      { error: "Final ISSB disclosures are immutable. Create a new year draft instead." },
      { status: 409 },
    );
  }

  const body = (await req.json()) as {
    action?: "autofill" | "save" | "inherit_tcfd";
    s1Answers?: IssbAnswersMap;
    s2Answers?: IssbAnswersMap;
    linkedTcfdId?: string | null;
    forceAutofill?: boolean;
  };

  const now = new Date().toISOString();
  let s1Answers = parseIssbAnswers(doc.s1Answers);
  let s2Answers = parseIssbAnswers(doc.s2Answers);
  let emissionsSnapshot = parseEmissions(doc.emissionsSnapshot);
  let linkedTcfdId = relationId(doc.linkedTcfd);
  let materialitySummary = doc.materialitySummary;
  let historyAction = "saved";
  let summary = "Answers saved";

  if (body.linkedTcfdId !== undefined) {
    linkedTcfdId = body.linkedTcfdId;
  }

  if (body.action === "autofill" || body.action === "inherit_tcfd") {
    emissionsSnapshot = await loadTcfdEmissions(
      payload,
      auth.activeOrg.id,
      Number(doc.reportingYear),
    );
    const mat = await payload.find({
      collection: "materiality-assessments",
      where: { organisation: { equals: auth.activeOrg.id } },
      sort: "-updatedAt",
      limit: 1,
      overrideAccess: true,
    });
    const matDoc = mat.docs[0];
    const materialityNote = matDoc?.narrative
      ? String(matDoc.narrative)
      : matDoc
        ? `Materiality assessment ${matDoc.status} on file.`
        : null;
    materialitySummary = matDoc
      ? { status: matDoc.status, narrative: matDoc.narrative ?? null }
      : null;

    const filled = applyIssbAutofill({
      s1Answers,
      s2Answers,
      emissions: emissionsSnapshot,
      materialityNote,
      force: Boolean(body.forceAutofill),
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
        if (relationId(tcfdDoc.organisation) === auth.activeOrg.id) {
          s2Answers = inheritS2FromTcfd({
            s2Answers,
            tcfdAnswers: parseAnswers(tcfdDoc.answers),
            force: body.action === "inherit_tcfd" || Boolean(body.forceAutofill),
          });
        }
      } catch {
        // ignore
      }
    }
    historyAction = body.action === "inherit_tcfd" ? "inherit_tcfd" : "autofill";
    summary =
      body.action === "inherit_tcfd"
        ? "Inherited S2 climate answers from linked TCFD"
        : "Auto-populated ISSB answers";
  } else {
    if (body.s1Answers) {
      for (const [qid, row] of Object.entries(body.s1Answers)) {
        s1Answers[qid] = {
          text: String(row.text ?? ""),
          source:
            row.source === "clearesg" || row.source === "scenario"
              ? row.source
              : "manual",
          autoFilled: Boolean(row.autoFilled),
          updatedAt: now,
        };
      }
    }
    if (body.s2Answers) {
      for (const [qid, row] of Object.entries(body.s2Answers)) {
        s2Answers[qid] = {
          text: String(row.text ?? ""),
          source:
            row.source === "clearesg" || row.source === "scenario"
              ? row.source
              : "manual",
          autoFilled: Boolean(row.autoFilled),
          updatedAt: now,
        };
      }
    }
  }

  const diffs = [
    ...diffIssbAnswerMaps(doc.s1Answers, s1Answers).map((d) => ({
      ...d,
      questionId: `s1:${d.questionId}`,
    })),
    ...diffIssbAnswerMaps(doc.s2Answers, s2Answers).map((d) => ({
      ...d,
      questionId: `s2:${d.questionId}`,
    })),
  ];

  const updated = await payload.update({
    collection: ISSB_DISCLOSURES_SLUG,
    id: doc.id,
    data: {
      s1Answers,
      s2Answers,
      emissionsSnapshot: emissionsSnapshot ?? undefined,
      materialitySummary: materialitySummary ?? undefined,
      linkedTcfd: linkedTcfdId || undefined,
      changeHistory: [
        ...(doc.changeHistory ?? []),
        {
          at: now,
          actor: auth.user.id,
          action: historyAction,
          summary,
          diff: diffs.length > 0 ? diffs : undefined,
        },
      ],
    },
    overrideAccess: true,
  });

  await writeAuditLog(payload, {
    organisationId: auth.activeOrg.id,
    actorId: auth.user.id,
    action: `issb.${historyAction}`,
    entityType: "issb-disclosure",
    entityId: String(doc.id),
    after: { changed: diffs.map((d) => d.questionId) },
  });

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    s1Answers: updated.s1Answers,
    s2Answers: updated.s2Answers,
    emissionsSnapshot: updated.emissionsSnapshot,
    linkedTcfdId: relationId(updated.linkedTcfd),
    changeHistory: updated.changeHistory,
  });
}

export async function POST(req: Request, ctxParams: Ctx) {
  const auth = await getCurrentContext();
  if (!auth.user || !auth.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const allowed = await requirePermission(
    auth.user.id,
    auth.activeOrg.id,
    "edit",
    "report",
    auth.activeOrg.id,
    "organisation",
  );
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as { action?: string };
  if (body.action !== "finalize") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const { id } = await ctxParams.params;
  const { payload, doc } = await loadOwned(id, auth.activeOrg.id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (doc.status === "final") {
    return NextResponse.json({ error: "Already final" }, { status: 409 });
  }

  const year = Number(doc.reportingYear);
  let emissionsSnapshot = parseEmissions(doc.emissionsSnapshot);
  if (!emissionsSnapshot) {
    emissionsSnapshot = await loadTcfdEmissions(payload, auth.activeOrg.id, year);
  }

  const matNote =
    doc.materialitySummary &&
    typeof doc.materialitySummary === "object" &&
    doc.materialitySummary !== null &&
    "narrative" in doc.materialitySummary
      ? String(
          (doc.materialitySummary as { narrative?: string | null }).narrative ?? "",
        ) || null
      : null;

  const snapshot = buildIssbSnapshot({
    organisationName: auth.activeOrg.name,
    reportingYear: year,
    status: "final",
    s1Answers: doc.s1Answers,
    s2Answers: doc.s2Answers,
    emissionsSnapshot,
    linkedTcfdId: relationId(doc.linkedTcfd),
    materialityNote: matNote,
    preparedBy: { id: auth.user.id, name: auth.user.email },
  });

  const now = new Date().toISOString();
  const updated = await payload.update({
    collection: ISSB_DISCLOSURES_SLUG,
    id: doc.id,
    data: {
      status: "final",
      emissionsSnapshot,
      snapshot,
      finalisedAt: now,
      finalisedBy: auth.user.id,
      changeHistory: [
        ...(doc.changeHistory ?? []),
        {
          at: now,
          actor: auth.user.id,
          action: "finalized",
          summary: `Finalised ISSB ${year}`,
        },
      ],
    },
    overrideAccess: true,
  });

  await writeAuditLog(payload, {
    organisationId: auth.activeOrg.id,
    actorId: auth.user.id,
    action: "issb.finalize",
    entityType: "issb-disclosure",
    entityId: String(doc.id),
    after: { status: "final", reportingYear: year },
  });

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    finalisedAt: updated.finalisedAt,
    snapshot: updated.snapshot,
  });
}
