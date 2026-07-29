import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";
import { NetSuiteService } from "@/lib/integrations/netsuite";

const NETSUITE_CLIENT_ID = process.env.NETSUITE_CLIENT_ID || "";
const NETSUITE_CLIENT_SECRET = process.env.NETSUITE_CLIENT_SECRET || "";
const NETSUITE_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/app/integrations/netsuite/callback`;

export async function POST(_req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const payload = await getPayload({ config });

  const connection = await payload.create({
    collection: "netsuite-connections",
    data: {
      organisationId: ctx.activeOrg.id,
      status: "pending",
      accountId: "", // User will fill this
    },
    overrideAccess: true,
  });

  const service = new NetSuiteService(
    payload,
    NETSUITE_CLIENT_ID,
    NETSUITE_CLIENT_SECRET,
    NETSUITE_REDIRECT_URI,
  );

  const authUrl = service.getAuthUrl(connection.id as string);

  return NextResponse.json({ authUrl, connectionId: connection.id });
}
