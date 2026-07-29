import { getPayload } from "payload";
import { NextResponse } from "next/server";
import type { Where } from "payload";

import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

export async function GET(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.user) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const url = new URL(req.url);
  const resourceType = url.searchParams.get("resourceType");

  const where: Where[] = [
    {
      or: [{ owner: { equals: ctx.user.id } }, { isSharedWithTeam: { equals: true } }],
    },
    { organisation: { equals: ctx.activeOrg.id } },
  ];

  if (resourceType) {
    where.push({ resourceType: { equals: resourceType } });
  }

  const payload = await getPayload({ config });
  const filters = await payload.find({
    collection: "saved-filters",
    where: { and: where },
    sort: "-createdAt",
    limit: 100,
    depth: 1,
  });

  return NextResponse.json({
    filters: filters.docs.map((f) => ({
      id: f.id,
      name: f.name,
      description: f.description,
      resourceType: f.resourceType,
      filterConditions: f.filterConditions,
      sortConfig: f.sortConfig,
      isDefault: f.isDefault,
      isSharedWithTeam: f.isSharedWithTeam,
      createdAt: f.createdAt,
      owner: typeof f.owner === "object" && f.owner ? f.owner.email : f.owner,
    })),
  });
}

export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.user) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const body = await req.json();
  const {
    name,
    description,
    resourceType,
    filterConditions,
    sortConfig,
    isDefault,
    isSharedWithTeam,
  } = body;

  if (!name || !resourceType || !filterConditions) {
    return NextResponse.json(
      { error: "Missing required fields: name, resourceType, filterConditions" },
      { status: 400 },
    );
  }

  const payload = await getPayload({ config });

  try {
    if (isDefault) {
      const existing = await payload.find({
        collection: "saved-filters",
        where: {
          and: [
            { owner: { equals: ctx.user.id } },
            { resourceType: { equals: resourceType } },
            { isDefault: { equals: true } },
          ],
        },
      });

      for (const filter of existing.docs) {
        await payload.update({
          collection: "saved-filters",
          id: String(filter.id),
          data: { isDefault: false },
        });
      }
    }

    const filter = await payload.create({
      collection: "saved-filters",
      data: {
        organisation: ctx.activeOrg.id,
        owner: ctx.user.id,
        name,
        description,
        resourceType,
        filterConditions,
        sortConfig,
        isDefault: isDefault || false,
        isSharedWithTeam: isSharedWithTeam || false,
      },
    });

    return NextResponse.json({ filter }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create filter";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
