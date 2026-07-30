import { renderToBuffer } from "@react-pdf/renderer";
import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { TCFD_DISCLOSURES_SLUG } from "@/collections/TcfdDisclosures";
import { getCurrentContext } from "@/lib/auth";
import { can, resolveEffectivePlan } from "@/lib/billing";
import { requirePermission } from "@/lib/policy/protect";
import {
  buildTcfdSnapshot,
  loadOrgScenarios,
  resolveScenarioSummaries,
  TcfdPdfDocument,
  type TcfdDisclosureSnapshot,
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

export async function GET(_req: Request, ctxParams: Ctx) {
  const auth = await getCurrentContext();
  if (!auth.user || !auth.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const allowed = await requirePermission(
    auth.user.id,
    auth.activeOrg.id,
    "export",
    "report",
    auth.activeOrg.id,
    "organisation",
  );
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctxParams.params;
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
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (relationId(doc.organisation) !== auth.activeOrg.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let snapshot = doc.snapshot as TcfdDisclosureSnapshot | null;
  if (!snapshot) {
    let scenarios = await resolveScenarioSummaries(payload, doc.scenarioLinks);
    if (scenarios.length === 0) {
      scenarios = await loadOrgScenarios(payload, auth.activeOrg.id);
    }
    snapshot = buildTcfdSnapshot({
      organisationName: auth.activeOrg.name,
      reportingYear: Number(doc.reportingYear),
      status: doc.status === "final" ? "final" : "draft",
      answers: doc.answers,
      emissionsSnapshot: doc.emissionsSnapshot,
      scenarios: scenarios.slice(0, 5),
      preparedBy: { id: auth.user.id, name: auth.user.email },
    });
  }

  const watermarked = !can(
    resolveEffectivePlan({
      plan: auth.activeOrg.plan,
      subscriptionStatus: auth.activeOrg.subscriptionStatus,
    }),
    "unwatermarked_pdf",
  );

  const buffer = await renderToBuffer(
    <TcfdPdfDocument snapshot={snapshot} watermarked={watermarked} />,
  );
  const disposition = doc.status === "draft" ? "attachment" : "inline";

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="clearesg-tcfd-${snapshot.reportingYear}.pdf"`,
    },
  });
}
