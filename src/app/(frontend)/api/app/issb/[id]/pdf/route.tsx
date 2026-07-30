import { renderToBuffer } from "@react-pdf/renderer";
import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { ISSB_DISCLOSURES_SLUG } from "@/collections/IssbDisclosures";
import { getCurrentContext } from "@/lib/auth";
import { can, resolveEffectivePlan } from "@/lib/billing";
import {
  buildIssbSnapshot,
  IssbPdfDocument,
  type IssbDisclosureSnapshot,
} from "@/lib/issb";
import { requirePermission } from "@/lib/policy/protect";
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
      collection: ISSB_DISCLOSURES_SLUG,
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

  let snapshot = doc.snapshot as IssbDisclosureSnapshot | null;
  if (!snapshot) {
    const matNote =
      doc.materialitySummary &&
      typeof doc.materialitySummary === "object" &&
      doc.materialitySummary !== null &&
      "narrative" in doc.materialitySummary
        ? String(
            (doc.materialitySummary as { narrative?: string | null }).narrative ?? "",
          ) || null
        : null;
    snapshot = buildIssbSnapshot({
      organisationName: auth.activeOrg.name,
      reportingYear: Number(doc.reportingYear),
      status: doc.status === "final" ? "final" : "draft",
      s1Answers: doc.s1Answers,
      s2Answers: doc.s2Answers,
      emissionsSnapshot: doc.emissionsSnapshot,
      linkedTcfdId: relationId(doc.linkedTcfd),
      materialityNote: matNote,
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
    <IssbPdfDocument snapshot={snapshot} watermarked={watermarked} />,
  );
  const disposition = doc.status === "draft" ? "attachment" : "inline";

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="clearesg-issb-${snapshot.reportingYear}.pdf"`,
    },
  });
}
