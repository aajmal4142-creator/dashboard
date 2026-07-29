import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";
import { AccountingService } from "@/lib/integrations/accounting";

export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const body = (await req.json()) as { provider?: string };
  const { provider } = body;

  if (!provider || !["xero", "quickbooks"].includes(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const clientId =
    provider === "xero"
      ? process.env.XERO_CLIENT_ID || ""
      : process.env.QB_CLIENT_ID || "";
  const clientSecret =
    provider === "xero"
      ? process.env.XERO_CLIENT_SECRET || ""
      : process.env.QB_CLIENT_SECRET || "";
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/app/integrations/accounting/callback`;

  const payload = await getPayload({ config });

  const connection = await payload.create({
    collection: "accounting-connections",
    data: {
      organisationId: ctx.activeOrg.id,
      provider: provider as "xero" | "quickbooks",
      status: "pending",
      providerId: "", // Will be set on callback
    },
    overrideAccess: true,
  });

  const service = new AccountingService(
    payload,
    provider as "xero" | "quickbooks",
    clientId,
    clientSecret,
    redirectUri,
  );

  const authUrl = service.getAuthUrl(connection.id as string);

  return NextResponse.json({ authUrl, connectionId: connection.id });
}
