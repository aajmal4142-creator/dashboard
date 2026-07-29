import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { getCompliance, initializeCompliance } from "@/lib/compliance/checklistService";

export async function GET(request: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "view",
    "compliance",
    ctx.activeOrg.id,
    "organisation"
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const complianceId = url.searchParams.get("id");

  if (!complianceId) {
    return NextResponse.json(
      { error: "Compliance ID required" },
      { status: 400 }
    );
  }

  try {
    const compliance = await getCompliance(ctx.activeOrg.id, complianceId);
    if (!compliance) {
      return NextResponse.json(
        { error: "Compliance not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(compliance);
  } catch (error) {
    console.error("Error fetching compliance:", error);
    return NextResponse.json(
      { error: "Failed to fetch compliance" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "create",
    "compliance",
    ctx.activeOrg.id,
    "organisation"
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { complianceYear } = body;

  if (!complianceYear) {
    return NextResponse.json(
      { error: "Compliance year required" },
      { status: 400 }
    );
  }

  try {
    const complianceId = await initializeCompliance(
      ctx.activeOrg.id,
      complianceYear,
      ctx.user.id
    );

    return NextResponse.json(
      { id: complianceId, message: "Compliance initialized" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error initializing compliance:", error);
    return NextResponse.json(
      { error: "Failed to initialize compliance" },
      { status: 500 }
    );
  }
}
