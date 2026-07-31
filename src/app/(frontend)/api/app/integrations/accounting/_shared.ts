import type { Payload } from "payload";

import {
  AccountingService,
  isAccountingProvider,
  resolveProviderCredentials,
} from "@/lib/integrations/accounting";

export function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function orgIdOf(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

export async function loadOwnedAccountingConnection(
  payload: Payload,
  id: string,
  organisationId: string,
) {
  const doc = await payload.findByID({
    collection: "accounting-connections",
    id,
    depth: 0,
    overrideAccess: true,
  });
  if (orgIdOf(doc.organisationId) !== organisationId) return null;
  return doc;
}

export function buildAccountingService(
  payload: Payload,
  doc: { provider: string; connectionMode?: string | null },
): AccountingService {
  if (!isAccountingProvider(doc.provider)) {
    throw new Error(`Unsupported accounting provider: ${doc.provider}`);
  }
  const redirectUri = `${appBaseUrl()}/api/app/integrations/accounting/callback`;
  const { credentials, mode: resolved } = resolveProviderCredentials(
    doc.provider,
    redirectUri,
  );
  const mode =
    doc.connectionMode === "sandbox" || doc.connectionMode === "live"
      ? doc.connectionMode
      : resolved;
  return new AccountingService(payload, doc.provider, credentials, mode);
}
