import { NextResponse } from "next/server";

import { COMPARE_PRESETS } from "@/lib/analytics/compare";
import { getCurrentContext } from "@/lib/auth";

/**
 * GET /api/app/analytics/compare/presets
 * Pre-defined comparison shapes (YoY, by department, etc).
 */
export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    presets: COMPARE_PRESETS,
    related: [
      {
        id: "benchmarks",
        label: "Peer benchmarks",
        href: "/benchmarks",
        note: "You vs cohort median — not rebuilt here",
      },
      {
        id: "scenarios",
        label: "Scenario compare",
        href: "/analytics?tab=scenarios",
        note: "Trajectory side-by-side for calculated scenarios",
      },
      {
        id: "tcfd",
        label: "TCFD year compare",
        href: "/tcfd",
        note: "Disclosure completeness across years",
      },
    ],
  });
}
