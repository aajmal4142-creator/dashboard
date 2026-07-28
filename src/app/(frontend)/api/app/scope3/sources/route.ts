import { getPayload, type CollectionSlug } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";
import type {
  ActivityDataField,
  Scope3Category,
  EmissionsFactor,
} from "@/lib/scope3/types";

const SCOPE3_SOURCES = "scope3-sources" as CollectionSlug;

export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "view",
    "datapoint",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: SCOPE3_SOURCES,
    where: { organisation: { equals: ctx.activeOrg.id } },
    limit: 500,
    sort: "-updatedAt",
    overrideAccess: true,
  });

  const sources = result.docs.map((s) => ({
    id: s.id,
    type: s.type,
    name: s.name,
    description: s.description,
    emissionsFactor: s.emissionsFactor,
    activityDataFields: s.activityDataFields,
    createdAt: s.createdAt,
  }));

  return NextResponse.json({ sources });
}

export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) {
    return NextResponse.json({ error: "No active organisation" }, { status: 403 });
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "create",
    "datapoint",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    type?: Scope3Category;
    name?: string;
    description?: string;
    emissionsFactor?: EmissionsFactor;
    activityDataFields?: ActivityDataField[];
  };

  const { type, name, description, emissionsFactor, activityDataFields } = body;

  // Validation
  const SCOPE3_CATEGORIES: Scope3Category[] = [
    "supplier",
    "investment",
    "waste",
    "business_travel",
    "employee_commute",
  ];

  if (!type || !SCOPE3_CATEGORIES.includes(type)) {
    return NextResponse.json({ error: "Valid type required" }, { status: 400 });
  }

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  if (
    !emissionsFactor ||
    typeof emissionsFactor.value !== "number" ||
    !emissionsFactor.unit
  ) {
    return NextResponse.json(
      { error: "Valid emissionsFactor required" },
      { status: 400 },
    );
  }

  if (
    !activityDataFields ||
    !Array.isArray(activityDataFields) ||
    activityDataFields.length === 0
  ) {
    return NextResponse.json(
      { error: "At least one activityDataField required" },
      { status: 400 },
    );
  }

  // Validate activity fields
  for (const field of activityDataFields) {
    if (!field.name || !field.unit) {
      return NextResponse.json(
        { error: "Each field must have name and unit" },
        { status: 400 },
      );
    }
  }

  const payload = await getPayload({ config });

  const doc = await payload.create({
    collection: SCOPE3_SOURCES,
    data: {
      organisation: ctx.activeOrg.id,
      type,
      name: name.trim(),
      description: description || undefined,
      emissionsFactor: {
        value: emissionsFactor.value,
        unit: emissionsFactor.unit,
        source: emissionsFactor.source || "Custom",
        year: emissionsFactor.year || new Date().getFullYear(),
        confidence: emissionsFactor.confidence || "medium",
      },
      activityDataFields: activityDataFields.map((f) => ({
        name: f.name,
        unit: f.unit,
        description: f.description || "",
        required: f.required !== false,
      })),
    },
    overrideAccess: true,
  });

  return NextResponse.json({ ok: true, id: doc.id });
}
