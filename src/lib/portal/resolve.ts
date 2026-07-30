import type { Payload } from "payload";

import { resolveOrgBranding } from "@/lib/branding";
import { SUPPLIER_PORTAL_CONFIG_SLUG } from "@/collections/SupplierPortalConfig";
import {
  DEFAULT_PORTAL_HEADLINE,
  defaultPortalConfig,
  type PortalPublicChrome,
  type SupplierPortalConfigView,
} from "@/lib/portal/types";

type OrgDoc = {
  id: string;
  name?: string | null;
  brand?: unknown;
  settings?: unknown;
};

function asPortalView(
  doc: {
    enabled?: boolean | null;
    headline?: string | null;
    welcomeMessage?: string | null;
    showPoweredBy?: boolean | null;
  } | null,
): SupplierPortalConfigView {
  if (!doc) return defaultPortalConfig();
  return {
    enabled: doc.enabled !== false,
    headline: doc.headline?.trim() || DEFAULT_PORTAL_HEADLINE,
    welcomeMessage: doc.welcomeMessage?.trim() || null,
    showPoweredBy: doc.showPoweredBy !== false,
  };
}

/** Load or synthesise portal config for an organisation (no create). */
export async function getPortalConfigForOrg(
  payload: Payload,
  organisationId: string,
): Promise<{ id: string | null; config: SupplierPortalConfigView }> {
  const found = await payload.find({
    collection: SUPPLIER_PORTAL_CONFIG_SLUG,
    where: { organisation: { equals: organisationId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const doc = found.docs[0] ?? null;
  return {
    id: doc ? String(doc.id) : null,
    config: asPortalView(doc),
  };
}

/** Upsert portal config for an organisation. */
export async function upsertPortalConfig(
  payload: Payload,
  organisationId: string,
  patch: Partial<SupplierPortalConfigView>,
): Promise<{ id: string; config: SupplierPortalConfigView }> {
  const existing = await getPortalConfigForOrg(payload, organisationId);
  const next: SupplierPortalConfigView = {
    enabled: patch.enabled ?? existing.config.enabled,
    headline:
      patch.headline?.trim() || existing.config.headline || DEFAULT_PORTAL_HEADLINE,
    welcomeMessage:
      patch.welcomeMessage !== undefined
        ? patch.welcomeMessage?.trim() || null
        : existing.config.welcomeMessage,
    showPoweredBy: patch.showPoweredBy ?? existing.config.showPoweredBy,
  };

  if (existing.id) {
    const updated = await payload.update({
      collection: SUPPLIER_PORTAL_CONFIG_SLUG,
      id: existing.id,
      data: next,
      overrideAccess: true,
    });
    return { id: String(updated.id), config: asPortalView(updated) };
  }

  const created = await payload.create({
    collection: SUPPLIER_PORTAL_CONFIG_SLUG,
    data: {
      organisation: organisationId,
      ...next,
    },
    overrideAccess: true,
  });
  return { id: String(created.id), config: asPortalView(created) };
}

/** Resolve chrome for the public supplier form. */
export async function resolvePortalChrome(
  payload: Payload,
  org: OrgDoc | null,
): Promise<PortalPublicChrome> {
  const orgName = org?.name?.trim() || "ClearESG customer";
  if (!org) {
    return {
      orgName,
      branding: { primaryColor: null, logoUrl: null },
      portal: defaultPortalConfig(),
    };
  }

  const branding = resolveOrgBranding(org as Parameters<typeof resolveOrgBranding>[0]);
  const { config } = await getPortalConfigForOrg(payload, org.id);

  return {
    orgName,
    branding: {
      primaryColor: branding.primaryColor,
      logoUrl: branding.logoUrl,
    },
    portal: config,
  };
}
