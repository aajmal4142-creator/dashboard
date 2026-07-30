import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { TCFD_DISCLOSURES_SLUG } from "@/collections/TcfdDisclosures";
import { writeAuditLog } from "@/lib/audit/write";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import {
  applyTcfdAutofill,
  buildTcfdSnapshot,
  diffTcfdAnswers,
  loadOrgScenarios,
  loadTcfdEmissions,
  parseEmissions,
  resolveScenarioSummaries,
  yoyFromPrior,
  type TcfdAnswersMap,
  type TcfdEmissionsSnapshot,
} from "@/lib/tcfd";
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
      collection: TCFD_DISCLOSURES_SLUG,
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

/**
 * GET /api/app/compliance/tcfd/[id]
 */
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
    periodId: relationId(doc.period),
    answers: doc.answers ?? {},
    emissionsSnapshot: doc.emissionsSnapshot ?? null,
    scenarioLinks: doc.scenarioLinks ?? [],
    changeHistory: doc.changeHistory ?? [],
    finalisedAt: doc.finalisedAt ?? null,
    snapshot: doc.snapshot ?? null,
  });
}

/**
 * PATCH /api/app/compliance/tcfd/[id]
 * body: { answers?, scenarioIds?, action?: "autofill" | "save" }
 */
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
      { error: "Final TCFD disclosures are immutable. Create a new year draft instead." },
      { status: 409 },
    );
  }

  const body = (await req.json()) as {
    action?: "autofill" | "save";
    answers?: TcfdAnswersMap;
    scenarioIds?: string[];
    forceAutofill?: boolean;
  };

  const now = new Date().toISOString();
  let answers = (doc.answers ?? {}) as TcfdAnswersMap;
  let emissionsSnapshot: TcfdEmissionsSnapshot | null = parseEmissions(
    doc.emissionsSnapshot,
  );
  let scenarioLinks = doc.scenarioLinks ?? [];
  let historyAction = "saved";
  let summary = "Answers saved";

  if (body.action === "autofill") {
    emissionsSnapshot = await loadTcfdEmissions(
      payload,
      auth.activeOrg.id,
      Number(doc.reportingYear),
    );
    const scenarios = await loadOrgScenarios(payload, auth.activeOrg.id);
    answers = applyTcfdAutofill({
      existing: answers,
      emissions: emissionsSnapshot,
      scenarios,
      force: Boolean(body.forceAutofill),
    });
    scenarioLinks = scenarios.slice(0, 5).map((s) => ({
      scenario: s.id,
      role: "strategy",
    }));
    historyAction = "autofill";
    summary = "Auto-populated emissions and scenario hooks";
  } else if (body.answers) {
    const merged: TcfdAnswersMap = { ...answers };
    for (const [qid, row] of Object.entries(body.answers)) {
      merged[qid] = {
        text: String(row.text ?? ""),
        source:
          row.source === "clearesg" || row.source === "scenario" ? row.source : "manual",
        autoFilled: Boolean(row.autoFilled),
        updatedAt: now,
      };
    }
    answers = merged;
  }

  if (Array.isArray(body.scenarioIds)) {
    scenarioLinks = body.scenarioIds.map((sid) => ({
      scenario: sid,
      role: "strategy",
    }));
  }

  const diffs = diffTcfdAnswers(doc.answers, answers);
  const history = [
    ...(doc.changeHistory ?? []),
    {
      at: now,
      actor: auth.user.id,
      action: historyAction,
      summary,
      diff: diffs.length > 0 ? diffs : undefined,
    },
  ];

  const updated = await payload.update({
    collection: TCFD_DISCLOSURES_SLUG,
    id: doc.id,
    data: {
      answers,
      emissionsSnapshot: emissionsSnapshot ?? undefined,
      scenarioLinks,
      changeHistory: history,
      period: relationId(doc.period) || emissionsSnapshot?.periodId || undefined,
    },
    overrideAccess: true,
  });

  await writeAuditLog(payload, {
    organisationId: auth.activeOrg.id,
    actorId: auth.user.id,
    action: `tcfd.${historyAction}`,
    entityType: "tcfd-disclosure",
    entityId: String(doc.id),
    before: { answerKeys: Object.keys((doc.answers as object) ?? {}) },
    after: { changed: diffs.map((d) => d.questionId) },
  });

  return NextResponse.json({
    id: updated.id,
    reportingYear: updated.reportingYear,
    status: updated.status,
    answers: updated.answers,
    emissionsSnapshot: updated.emissionsSnapshot,
    scenarioLinks: updated.scenarioLinks,
    changeHistory: updated.changeHistory,
  });
}

/**
 * POST /api/app/compliance/tcfd/[id]
 * body: { action: "finalize" }
 */
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

  let scenarios = await resolveScenarioSummaries(payload, doc.scenarioLinks);
  if (scenarios.length === 0) {
    scenarios = (await loadOrgScenarios(payload, auth.activeOrg.id)).slice(0, 5);
  }

  const prior = await payload.find({
    collection: TCFD_DISCLOSURES_SLUG,
    where: {
      and: [
        { organisation: { equals: auth.activeOrg.id } },
        { reportingYear: { equals: year - 1 } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  });
  const priorDoc = prior.docs[0] ?? null;
  const yoy = yoyFromPrior(
    emissionsSnapshot,
    year - 1,
    priorDoc?.emissionsSnapshot ?? null,
  );

  const snapshot = buildTcfdSnapshot({
    organisationName: auth.activeOrg.name,
    reportingYear: year,
    status: "final",
    answers: doc.answers,
    emissionsSnapshot,
    scenarios,
    preparedBy: { id: auth.user.id, name: auth.user.email },
    yoy,
  });

  const now = new Date().toISOString();
  const updated = await payload.update({
    collection: TCFD_DISCLOSURES_SLUG,
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
          summary: `Finalised TCFD ${year}`,
        },
      ],
    },
    overrideAccess: true,
  });

  await writeAuditLog(payload, {
    organisationId: auth.activeOrg.id,
    actorId: auth.user.id,
    action: "tcfd.finalize",
    entityType: "tcfd-disclosure",
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
