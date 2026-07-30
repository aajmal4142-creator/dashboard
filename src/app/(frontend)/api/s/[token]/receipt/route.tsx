import { renderToBuffer } from "@react-pdf/renderer";
import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { assertRateLimit, isTokenExpired, SUPPLIER_FORM_FIELDS } from "@/lib/suppliers";
import {
  resolvePortalChrome,
  SupplierReceiptPdfDocument,
  type SupplierReceiptSnapshot,
} from "@/lib/portal";
import config from "@/payload.config";

type Ctx = { params: Promise<{ token: string }> };

function clientKey(req: Request, token: string): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = fwd || req.headers.get("x-real-ip") || "unknown";
  return `${token}:${ip}`;
}

function orgIdOf(supplier: { organisation: string | { id: string } }): string {
  return typeof supplier.organisation === "object" && supplier.organisation !== null
    ? supplier.organisation.id
    : String(supplier.organisation);
}

/**
 * GET /api/s/[token]/receipt — light-theme PDF receipt (token-gated).
 */
export async function GET(req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const limited = await assertRateLimit(`receipt:${clientKey(req, token)}`);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const payload = await getPayload({ config });
  const found = await payload.find({
    collection: "suppliers",
    where: { requestToken: { equals: token } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  });
  const supplier = found.docs[0];
  if (!supplier) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  if (
    isTokenExpired(supplier.requestExpiresAt ? String(supplier.requestExpiresAt) : null)
  ) {
    return NextResponse.json({ error: "This link has expired" }, { status: 410 });
  }

  if (supplier.requestStatus !== "submitted") {
    return NextResponse.json(
      { error: "Submit the form before downloading a receipt" },
      { status: 409 },
    );
  }

  const org =
    typeof supplier.organisation === "object" && supplier.organisation !== null
      ? supplier.organisation
      : null;

  let orgDoc = org;
  if (!orgDoc) {
    try {
      orgDoc = await payload.findByID({
        collection: "organisations",
        id: orgIdOf(supplier),
        depth: 1,
        overrideAccess: true,
      });
    } catch {
      orgDoc = null;
    }
  }

  const chrome = await resolvePortalChrome(
    payload,
    orgDoc
      ? {
          id: String(orgDoc.id),
          name: "name" in orgDoc ? String(orgDoc.name) : null,
          brand: "brand" in orgDoc ? orgDoc.brand : undefined,
          settings: "settings" in orgDoc ? orgDoc.settings : undefined,
        }
      : null,
  );

  const submitted = (supplier.submittedData ?? {}) as Record<
    string,
    number | boolean | null | undefined
  >;

  const snapshot: SupplierReceiptSnapshot = {
    orgName: chrome.orgName,
    supplierName: supplier.name,
    submittedAt: supplier.respondedAt
      ? String(supplier.respondedAt)
      : new Date().toISOString(),
    isResubmit: false,
    accentColor: chrome.branding.primaryColor,
    fields: SUPPLIER_FORM_FIELDS.map((f) => {
      const raw = submitted[f.key];
      const value = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
      return { label: f.label, unit: f.unit, value };
    }),
    isMetered: Boolean(submitted.is_metered),
  };

  const buffer = await renderToBuffer(<SupplierReceiptPdfDocument snapshot={snapshot} />);

  const filename = `clearesg-receipt-${supplier.name.replace(/[^\w.-]+/g, "-").slice(0, 40)}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
