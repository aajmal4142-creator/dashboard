import { NextResponse } from "next/server";

import { POST as validatePost } from "@/app/(frontend)/api/app/data/validate/route";

/**
 * POST /api/app/datapoints/validate
 * Alias of /api/app/data/validate for sprint-shaped clients.
 */
export async function POST(request: Request) {
  return validatePost(request);
}

export async function GET() {
  return NextResponse.json(
    { error: "Use GET /api/app/validation-rules to list rules" },
    { status: 405 },
  );
}
