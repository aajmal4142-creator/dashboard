import { NextResponse } from "next/server";

/**
 * GET /api/app/suppliers/risk-report
 * Alias for Feature 10 risk-report → existing risk-scores list.
 */
export { GET } from "../risk-scores/route";

export async function POST() {
  return NextResponse.json(
    { error: "Use GET /api/app/suppliers/risk-scores or /risk-report" },
    { status: 405 },
  );
}
