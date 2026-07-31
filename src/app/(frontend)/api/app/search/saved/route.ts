import { getPayload } from "payload";
import { NextResponse } from "next/server";
import type { Where } from "payload";

import { getCurrentContext } from "@/lib/auth";
import {
  normalizeSavedSearchConditions,
  normalizeSavedSearchName,
  type SavedSearchSummary,
} from "@/lib/search/saved";
import config from "@/payload.config";

function mapDoc(
  f: {
    id: string | number;
    name?: string | null;
    filterConditions?: unknown;
    createdAt?: string | null;
    owner?: string | { id?: string } | null;
  },
  userId: string,
): SavedSearchSummary | null {
  const parsed = normalizeSavedSearchConditions(f.filterConditions);
  if (!parsed.ok) return null;
  const ownerId =
    typeof f.owner === "string"
      ? f.owner
      : f.owner && typeof f.owner === "object"
        ? String(f.owner.id ?? "")
        : "";
  return {
    id: String(f.id),
    name: typeof f.name === "string" ? f.name : "Saved search",
    query: parsed.data.query,
    type: parsed.data.type,
    createdAt: f.createdAt ? String(f.createdAt) : "",
    isOwner: ownerId === userId,
  };
}

/** GET /api/app/search/saved — list saved command-palette searches. */
export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.user) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const where: Where = {
    and: [
      { organisation: { equals: ctx.activeOrg.id } },
      { resourceType: { equals: "search" } },
      {
        or: [{ owner: { equals: ctx.user.id } }, { isSharedWithTeam: { equals: true } }],
      },
    ],
  };

  const payload = await getPayload({ config });
  const found = await payload.find({
    collection: "saved-filters",
    where,
    sort: "-createdAt",
    limit: 50,
    depth: 0,
  });

  const searches = found.docs
    .map((d) => mapDoc(d, ctx.user!.id))
    .filter((s): s is SavedSearchSummary => s !== null);

  return NextResponse.json({ searches });
}

/** POST /api/app/search/saved — save current query. */
export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.user) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const nameRes = normalizeSavedSearchName(
    obj.name ??
      (typeof obj.query === "string" ? obj.query : null) ??
      (typeof obj.q === "string" ? obj.q : null),
  );
  if (!nameRes.ok) {
    return NextResponse.json({ error: nameRes.error }, { status: 400 });
  }

  const condRes = normalizeSavedSearchConditions({
    query: obj.query ?? obj.q,
    type: obj.type,
  });
  if (!condRes.ok) {
    return NextResponse.json({ error: condRes.error }, { status: 400 });
  }

  const payload = await getPayload({ config });
  try {
    const created = await payload.create({
      collection: "saved-filters",
      data: {
        organisation: ctx.activeOrg.id,
        owner: ctx.user.id,
        name: nameRes.name,
        resourceType: "search",
        filterConditions: {
          query: condRes.data.query,
          type: condRes.data.type,
        },
        isDefault: false,
        isSharedWithTeam: false,
      },
    });

    const search = mapDoc(created, ctx.user.id);
    return NextResponse.json({ search }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save search";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE /api/app/search/saved?id= — delete own saved search. */
export async function DELETE(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.user) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const payload = await getPayload({ config });
  try {
    const doc = await payload.findByID({
      collection: "saved-filters",
      id,
      depth: 0,
    });
    const ownerId =
      typeof doc.owner === "string"
        ? doc.owner
        : doc.owner && typeof doc.owner === "object"
          ? String((doc.owner as { id?: string }).id ?? "")
          : "";
    const orgId =
      typeof doc.organisation === "string"
        ? doc.organisation
        : doc.organisation && typeof doc.organisation === "object"
          ? String((doc.organisation as { id?: string }).id ?? "")
          : "";

    if (orgId !== ctx.activeOrg.id || ownerId !== ctx.user.id) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    if (doc.resourceType !== "search") {
      return NextResponse.json({ error: "Not a saved search." }, { status: 400 });
    }

    await payload.delete({ collection: "saved-filters", id });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
