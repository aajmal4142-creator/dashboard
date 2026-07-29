import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import { uploadDocument } from "@/lib/suppliers/documentService";

export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "create",
    "supplier",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const supplierId = formData.get("supplierId") as string;
    const docType = formData.get("docType") as string;
    const description = formData.get("description") as string | null;
    const expiryDate = formData.get("expiryDate") as string | null;
    const tags = formData.getAll("tags") as string[];

    if (!file || !supplierId || !docType) {
      return NextResponse.json(
        { error: "Missing required fields: file, supplierId, docType" },
        { status: 400 },
      );
    }

    const buffer = await file.arrayBuffer();
    const result = await uploadDocument(
      ctx.activeOrg.id,
      supplierId,
      {
        data: Buffer.from(buffer),
        name: file.name,
        size: file.size,
        type: file.type,
      },
      docType,
      ctx.user.id,
      {
        tags,
        description: description ?? undefined,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      },
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Upload failed",
      },
      { status: 500 },
    );
  }
}
