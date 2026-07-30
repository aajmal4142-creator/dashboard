import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { TCFD_DISCLOSURES_SLUG } from "@/collections/TcfdDisclosures";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { compareTcfdYears } from "@/lib/tcfd";
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
 * GET /api/app/compliance/tcfd/compare?yearA=2024&yearB=2025
 */
export async function GET(req: Request) {
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

  const orgId = auth.activeOrg.id;
  const url = new URL(req.url);
  const yearA = Number(url.searchParams.get("yearA"));
  const yearB = Number(url.searchParams.get("yearB"));
  if (!Number.isFinite(yearA) || !Number.isFinite(yearB)) {
    return NextResponse.json(
      { error: "Provide yearA and yearB query params" },
      { status: 400 },
    );
  }

  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: TCFD_DISCLOSURES_SLUG,
    where: {
      and: [
        { organisation: { equals: orgId } },
        { reportingYear: { in: [yearA, yearB] } },
      ],
    },
    limit: 10,
    overrideAccess: true,
  });

  const byYear = new Map(
    result.docs
      .filter((d) => relationId(d.organisation) === orgId)
      .map((d) => [Number(d.reportingYear), d] as const),
  );
  const docA = byYear.get(yearA);
  const docB = byYear.get(yearB);
  if (!docA || !docB) {
    return NextResponse.json(
      {
        error: "Both years need an existing TCFD disclosure to compare",
        found: {
          yearA: Boolean(docA),
          yearB: Boolean(docB),
        },
      },
      { status: 404 },
    );
  }

  const comparison = compareTcfdYears({
    yearA,
    yearB,
    statusA: String(docA.status),
    statusB: String(docB.status),
    answersA: docA.answers,
    answersB: docB.answers,
    emissionsA: docA.emissionsSnapshot,
    emissionsB: docB.emissionsSnapshot,
  });

  return NextResponse.json({
    comparison,
    ids: { yearA: docA.id, yearB: docB.id },
  });
}
