import { NextResponse } from "next/server";
import { getPayload } from "payload";

import { getCurrentContext } from "@/lib/auth";
import { createDocumentRepository } from "@/lib/carbon-trust/documentRepository";
import config from "@/payload.config";

function orgIdOf(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

/** GET /api/app/carbon-trust/[id]/documents — latest evidence docs for a certification */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getCurrentContext();
  const { id } = await params;
  if (!auth.activeOrg || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await getPayload({ config });
  try {
    const cert = await payload.findByID({
      collection: "carbon-trust-certifications",
      id,
      depth: 0,
      overrideAccess: true,
    });
    if (!cert || orgIdOf(cert.organisation) !== auth.activeOrg.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const repo = createDocumentRepository(payload);
    const documents = await repo.getLatestDocuments(id);
    return NextResponse.json({ documents });
  } catch (error) {
    console.error("carbon-trust documents GET:", error);
    return NextResponse.json({ error: "Failed to list documents" }, { status: 500 });
  }
}

/** POST multipart — upload evidence for a certification (SHA-256 versioned) */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getCurrentContext();
  const { id } = await params;
  if (!auth.activeOrg || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (auth.role !== "owner" && auth.role !== "admin" && auth.role !== "contributor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await getPayload({ config });
  try {
    const cert = await payload.findByID({
      collection: "carbon-trust-certifications",
      id,
      depth: 0,
      overrideAccess: true,
    });
    if (!cert || orgIdOf(cert.organisation) !== auth.activeOrg.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    const description =
      typeof form.get("description") === "string" ? String(form.get("description")) : "";
    const checklistItemId =
      typeof form.get("checklistItemId") === "string"
        ? String(form.get("checklistItemId")).trim()
        : "";
    const tags = form
      .getAll("tags")
      .filter((t): t is string => typeof t === "string" && t.length > 0);

    const buffer = Buffer.from(await file.arrayBuffer());
    const repo = createDocumentRepository(payload);
    const doc = await repo.uploadDocument({
      certificationId: id,
      fileName: file.name,
      fileBuffer: buffer,
      mimeType: file.type || "application/octet-stream",
      description,
      tags,
      userId: auth.user.id,
    });

    if (checklistItemId) {
      try {
        const item = await payload.findByID({
          collection: "carbon-trust-checklist-items",
          id: checklistItemId,
          depth: 0,
          overrideAccess: true,
        });
        const existing = Array.isArray(item.attachedDocuments)
          ? item.attachedDocuments
              .map((row: unknown) => {
                if (typeof row === "string") return row;
                if (typeof row === "object" && row !== null && "id" in row) {
                  return String((row as { id: string }).id);
                }
                return null;
              })
              .filter((id: string | null): id is string => Boolean(id))
          : [];
        if (!existing.includes(doc.id)) {
          await payload.update({
            collection: "carbon-trust-checklist-items",
            id: checklistItemId,
            data: {
              attachedDocuments: [...existing, doc.id],
            },
            overrideAccess: true,
          });
        }
      } catch (attachErr) {
        console.error("attach document to checklist:", attachErr);
      }
    }

    return NextResponse.json({ success: true, document: doc });
  } catch (error) {
    console.error("carbon-trust documents POST:", error);
    return NextResponse.json({ error: "Failed to upload document" }, { status: 500 });
  }
}
