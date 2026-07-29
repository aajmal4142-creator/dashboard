import { getPayload } from "payload";
import { NextResponse } from "next/server";
import type { Where } from "payload";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import config from "@/payload.config";

function convertToCSV(data: unknown[]): string {
  if (!Array.isArray(data) || data.length === 0) {
    return "";
  }

  const headers = Object.keys(data[0] as Record<string, unknown>);
  const csv = [headers.join(",")];

  for (const row of data) {
    const record = row as Record<string, unknown>;
    const values = headers.map((header) => {
      const value = record[header];
      if (value === null || value === undefined) return "";
      if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return String(value);
    });
    csv.push(values.join(","));
  }

  return csv.join("\n");
}

export async function GET(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json(
      { error: "No active organisation. Finish onboarding or switch organisation." },
      { status: 403 },
    );
  }

  const allowed = await requirePermission(
    ctx.user.id,
    ctx.activeOrg.id,
    "view",
    "policy",
    ctx.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const format = url.searchParams.get("format") || "csv";
  const query = url.searchParams.get("q");
  const action = url.searchParams.get("action");
  const entityType = url.searchParams.get("entityType");
  const userId = url.searchParams.get("userId");
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");

  const where: Where[] = [{ organisation: { equals: ctx.activeOrg.id } }];

  if (action) {
    where.push({ action: { equals: action } });
  }

  if (entityType) {
    where.push({ entityType: { equals: entityType } });
  }

  if (userId) {
    where.push({ actor: { equals: userId } });
  }

  if (query) {
    where.push({
      or: [
        { action: { contains: query } },
        { entityType: { contains: query } },
        { entityId: { contains: query } },
      ],
    });
  }

  if (startDate || endDate) {
    where.push({
      createdAt: {
        ...(startDate ? { greater_than_equal: startDate } : {}),
        ...(endDate ? { less_than_equal: endDate } : {}),
      },
    });
  }

  const payload = await getPayload({ config });
  const logs = await payload.find({
    collection: "audit-logs",
    where: { and: where },
    sort: "-createdAt",
    limit: 10000,
    depth: 2,
  });

  const formatted = logs.docs.map((l) => ({
    timestamp: l.createdAt,
    action: l.action,
    entity_type: l.entityType,
    entity_id: l.entityId,
    actor:
      typeof l.actor === "object" && l.actor && "email" in l.actor
        ? l.actor.email
        : "System",
    ip_address: l.ip,
    user_agent: l.userAgent,
    changes_before: l.before ? JSON.stringify(l.before) : "",
    changes_after: l.after ? JSON.stringify(l.after) : "",
  }));

  if (format === "csv") {
    const csv = convertToCSV(formatted);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="audit-logs.csv"',
      },
    });
  }

  if (format === "json") {
    return NextResponse.json(formatted);
  }

  return NextResponse.json(
    { error: "Invalid format. Use 'csv' or 'json'" },
    { status: 400 },
  );
}
