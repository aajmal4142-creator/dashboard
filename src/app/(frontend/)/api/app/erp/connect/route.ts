import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";

/**
 * Paid ERP connectors (NetSuite, SAP, Workday, etc.) have been removed.
 * Use accounting integrations (Xero / QuickBooks) or CSV / webhooks instead.
 */
export async function POST(_request: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.user || !ctx.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    {
      error: "ERP connectors are no longer available",
      message:
        "Use Accounting integrations (Xero / QuickBooks), CSV import, or webhooks instead.",
      redirect: "/integrations",
    },
    { status: 410 },
  );
}

export async function GET(_request: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.user || !ctx.activeOrg) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    {
      error: "ERP connectors are no longer available",
      connections: [],
      redirect: "/integrations",
    },
    { status: 410 },
  );
}
