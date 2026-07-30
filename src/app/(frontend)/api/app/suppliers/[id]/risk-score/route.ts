import { NextResponse } from "next/server";

/**
 * GET /api/app/suppliers/[id]/risk-score
 * Alias for Feature 10 risk-score → risk-breakdown.
 */
export { GET } from "../risk-breakdown/route";

export async function POST() {
  return NextResponse.json(
    { error: "Use POST /api/app/suppliers/[id]/calculate-risk to recalculate" },
    { status: 405 },
  );
}
