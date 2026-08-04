import { NextResponse } from "next/server";
import { getPayload } from "payload";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import {
  composeSupplierScorecard,
  supplierScorecardToCsv,
  supplierScorecardToPlainText,
} from "@/lib/suppliers/scorecard";
import { calculateRiskScore } from "@/lib/suppliers/riskScoringEngine";
import { searchDocuments } from "@/lib/suppliers/documentService";
import config from "@/payload.config";

function orgIdOf(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

/**
 * GET /api/app/suppliers/[id]/scorecard?format=json|txt|csv
 * Formal supplier ESG scorecard from risk + questionnaire + docs.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getCurrentContext();
  const { id } = await params;
  if (!ctx.activeOrg || !ctx.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "view",
    "supplier",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await getPayload({ config });
  try {
    const supplier = await payload.findByID({
      collection: "suppliers",
      id,
      depth: 0,
      overrideAccess: true,
    });
    if (!supplier || orgIdOf(supplier.organisation) !== ctx.activeOrg.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const breakdown = await calculateRiskScore(id);
    if (!breakdown) {
      return NextResponse.json(
        { error: "Risk score could not be calculated for this supplier." },
        { status: 409 },
      );
    }

    const questionnaires = await payload.find({
      collection: "supplier-questionnaires",
      where: { supplier: { equals: id } },
      limit: 1,
      overrideAccess: true,
    });
    const qDoc = questionnaires.docs[0];
    const questionnaireCompletionPercent =
      qDoc && typeof qDoc.completionPercent === "number" ? qDoc.completionPercent : 0;

    const docs = await searchDocuments(ctx.activeOrg.id, { supplierId: id });

    let carbonQuality: "measured" | "calculated" | "estimated" | "missing" | "unknown" =
      "unknown";
    const submitted = supplier.submittedData;
    if (submitted && typeof submitted === "object") {
      const q = (submitted as { quality?: unknown }).quality;
      if (
        q === "measured" ||
        q === "calculated" ||
        q === "estimated" ||
        q === "missing"
      ) {
        carbonQuality = q;
      } else if (
        "scope1" in (submitted as object) ||
        "emissions" in (submitted as object)
      ) {
        carbonQuality = "estimated";
      }
    }

    const card = composeSupplierScorecard({
      supplierId: id,
      supplierName: String(supplier.name),
      category: typeof supplier.category === "string" ? supplier.category : null,
      risk: {
        totalScore: breakdown.totalScore,
        tier: breakdown.tier,
        badge: breakdown.badge,
        environmentalScore: breakdown.factors.environmental.score,
        socialScore: breakdown.factors.social.score,
        governanceScore: breakdown.factors.governance.score,
        flags: breakdown.flags,
        dataQuality: breakdown.dataQuality,
      },
      questionnaireCompletionPercent,
      carbonQuality,
      documentCount: docs.length,
    });

    const url = new URL(req.url);
    const format = (url.searchParams.get("format") ?? "json").toLowerCase();

    if (format === "txt" || format === "text") {
      const text = supplierScorecardToPlainText(card);
      return new NextResponse(text, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="supplier-scorecard-${id}.txt"`,
        },
      });
    }

    if (format === "csv") {
      const csv = supplierScorecardToCsv(card);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="supplier-scorecard-${id}.csv"`,
        },
      });
    }

    return NextResponse.json({ success: true, scorecard: card });
  } catch (error) {
    console.error("supplier scorecard:", error);
    return NextResponse.json(
      { error: "Failed to build supplier scorecard" },
      { status: 500 },
    );
  }
}
