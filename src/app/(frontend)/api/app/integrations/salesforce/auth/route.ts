import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";
import { SalesforceService } from "@/lib/integrations/salesforce";

const SALESFORCE_CLIENT_ID = process.env.SALESFORCE_CLIENT_ID || "";
const SALESFORCE_CLIENT_SECRET = process.env.SALESFORCE_CLIENT_SECRET || "";
const SALESFORCE_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/app/integrations/salesforce/callback`;

export async function POST(_req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const payload = await getPayload({ config });

  const connection = await payload.create({
    collection: "salesforce-connections",
    data: {
      organisationId: ctx.activeOrg.id,
      status: "pending",
    },
    overrideAccess: true,
  });

  const service = new SalesforceService(
    payload,
    SALESFORCE_CLIENT_ID,
    SALESFORCE_CLIENT_SECRET,
    SALESFORCE_REDIRECT_URI,
  );

  const authUrl = service.getAuthUrl(connection.id as string);

  return NextResponse.json({ authUrl, connectionId: connection.id });
}
