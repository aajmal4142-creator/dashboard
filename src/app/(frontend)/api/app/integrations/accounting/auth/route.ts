import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import {
  AccountingService,
  isAccountingProvider,
  resolveProviderCredentials,
  seedDefaultMapping,
} from "@/lib/integrations/accounting";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

function appBaseUrl(req: Request): string {
  // Prefer the live request origin so sandbox callbacks hit the same host:port
  // (NEXT_PUBLIC_APP_URL may be stale, e.g. :3000 while QA runs on :3010).
  try {
    const origin = new URL(req.url).origin;
    if (origin && origin !== "null") return origin;
  } catch {
    /* fall through */
  }
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "edit",
    "organisation",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as { provider?: string };
  const provider = body.provider;

  if (!provider || !isAccountingProvider(provider)) {
    return NextResponse.json(
      { error: "Invalid provider. Use xero, quickbooks, or wave." },
      { status: 400 },
    );
  }

  const base = appBaseUrl(req);
  const redirectUri = `${base}/api/app/integrations/accounting/callback`;
  const { credentials, mode } = resolveProviderCredentials(provider, redirectUri);

  const payload = await getPayload({ config });

  const connection = await payload.create({
    collection: "accounting-connections",
    data: {
      organisationId: ctx.activeOrg.id,
      provider,
      status: "pending",
      providerId: "pending",
      connectionMode: mode,
      expenseCategoryMapping: seedDefaultMapping(),
      syncConfig: {
        enableExpenseSync: true,
        enableBankFeedSync: false,
        enableAutoCateg: true,
        syncFrequency: "manual",
      },
    },
    overrideAccess: true,
  });

  const service = new AccountingService(payload, provider, credentials, mode);
  const authUrl = service.getAuthUrl(String(connection.id), base);

  return NextResponse.json({
    authUrl,
    connectionId: connection.id,
    mode,
    message:
      mode === "sandbox"
        ? "OAuth client secrets not configured — using free sandbox connect flow."
        : undefined,
  });
}
