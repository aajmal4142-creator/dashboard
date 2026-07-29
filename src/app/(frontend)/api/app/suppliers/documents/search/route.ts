import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import {
  searchDocuments,
  getExpiringCertifications,
} from "@/lib/suppliers/documentService";

export async function GET(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "view",
    "supplier",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const supplierId = url.searchParams.get("supplierId");
  const docType = url.searchParams.get("docType");
  const searchTerm = url.searchParams.get("q");
  const expiringIn = url.searchParams.get("expiringIn");

  const query: {
    supplierId?: string;
    docType?: string;
    searchTerm?: string;
    expiryDaysBefore?: number;
  } = {};
  if (supplierId) query.supplierId = supplierId;
  if (docType) query.docType = docType;
  if (searchTerm) query.searchTerm = searchTerm;
  if (expiringIn) query.expiryDaysBefore = parseInt(expiringIn);

  const results = await searchDocuments(ctx.activeOrg.id, query);

  return NextResponse.json({ documents: results });
}

export async function GET_EXPIRING(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "view",
    "supplier",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const daysUntilExpiry = url.searchParams.get("days")
    ? parseInt(url.searchParams.get("days")!)
    : 30;

  const expiringCerts = await getExpiringCertifications(
    ctx.activeOrg.id,
    daysUntilExpiry,
  );

  return NextResponse.json({ expiringCertifications: expiringCerts });
}
