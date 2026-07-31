import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { requirePermission } from "@/lib/policy/protect";
import {
  createReportSchedule,
  updateReportSchedule,
  type ReportDeliveryFormat,
  type ScheduleDeliveryStatus,
  type ScheduleFrequency,
} from "@/lib/reports/reportScheduler";
import { getPayload } from "payload";
import config from "@/payload.config";

type Ctx = { params: Promise<{ id: string }> };

const FREQUENCIES = new Set(["daily", "weekly", "monthly"]);
const FORMATS = new Set(["pdf", "csv", "json", "xml"]);
const STATUSES = new Set(["active", "paused", "completed"]);

function orgIdOf(value: unknown): string {
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return String(value);
}

async function assertReportAccess(reportId: string, organisationId: string) {
  const payload = await getPayload({ config });
  let report;
  try {
    report = await payload.findByID({
      collection: "reports",
      id: reportId,
      depth: 0,
      overrideAccess: true,
    });
  } catch {
    return null;
  }
  if (orgIdOf(report.organisation) !== organisationId) return null;
  return report;
}

/**
 * POST /api/app/reports/[id]/schedule — create a delivery schedule
 * PUT  /api/app/reports/[id]/schedule — update / pause / resume
 */
export async function POST(req: Request, ctx: Ctx) {
  const auth = await getCurrentContext();
  if (!auth.activeOrg || !auth.role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allowed = await requirePermission(
    auth.user.id,
    auth.activeOrg.id,
    "edit",
    "report",
    auth.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: reportId } = await ctx.params;
  const report = await assertReportAccess(reportId, auth.activeOrg.id);
  if (!report) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json()) as {
    frequency?: string;
    time?: string;
    timezone?: string;
    recipients?: string[];
    format?: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
    status?: string;
  };

  if (!body.frequency || !FREQUENCIES.has(body.frequency)) {
    return NextResponse.json(
      { error: "frequency must be daily, weekly, or monthly" },
      { status: 400 },
    );
  }
  if (!body.time || typeof body.time !== "string") {
    return NextResponse.json({ error: "time (HH:mm) is required" }, { status: 400 });
  }
  if (!body.timezone || typeof body.timezone !== "string") {
    return NextResponse.json({ error: "timezone is required" }, { status: 400 });
  }
  if (!Array.isArray(body.recipients)) {
    return NextResponse.json({ error: "recipients array is required" }, { status: 400 });
  }
  const format = (body.format ?? "pdf").toLowerCase();
  if (!FORMATS.has(format)) {
    return NextResponse.json(
      { error: "format must be pdf, csv, json, or xml" },
      { status: 400 },
    );
  }

  try {
    const schedule = await createReportSchedule({
      organisationId: auth.activeOrg.id,
      reportId,
      frequency: body.frequency as ScheduleFrequency,
      time: body.time,
      timezone: body.timezone,
      recipients: body.recipients,
      format: format as ReportDeliveryFormat,
      dayOfWeek: body.dayOfWeek,
      dayOfMonth: body.dayOfMonth,
      status:
        body.status && STATUSES.has(body.status)
          ? (body.status as ScheduleDeliveryStatus)
          : "active",
    });
    return NextResponse.json({ schedule }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create schedule";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(req: Request, ctx: Ctx) {
  const auth = await getCurrentContext();
  if (!auth.activeOrg || !auth.role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allowed = await requirePermission(
    auth.user.id,
    auth.activeOrg.id,
    "edit",
    "report",
    auth.activeOrg.id,
    "organisation",
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: reportId } = await ctx.params;
  const report = await assertReportAccess(reportId, auth.activeOrg.id);
  if (!report) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json()) as {
    scheduleId?: string;
    frequency?: string;
    time?: string;
    timezone?: string;
    recipients?: string[];
    format?: string;
    dayOfWeek?: number | null;
    dayOfMonth?: number | null;
    status?: string;
  };

  if (!body.scheduleId || typeof body.scheduleId !== "string") {
    return NextResponse.json({ error: "scheduleId is required" }, { status: 400 });
  }
  if (body.frequency !== undefined && !FREQUENCIES.has(body.frequency)) {
    return NextResponse.json(
      { error: "frequency must be daily, weekly, or monthly" },
      { status: 400 },
    );
  }
  if (body.format !== undefined && !FORMATS.has(body.format.toLowerCase())) {
    return NextResponse.json(
      { error: "format must be pdf, csv, json, or xml" },
      { status: 400 },
    );
  }
  if (body.status !== undefined && !STATUSES.has(body.status)) {
    return NextResponse.json(
      { error: "status must be active, paused, or completed" },
      { status: 400 },
    );
  }

  try {
    const schedule = await updateReportSchedule({
      scheduleId: body.scheduleId,
      organisationId: auth.activeOrg.id,
      reportId,
      frequency: body.frequency as ScheduleFrequency | undefined,
      time: body.time,
      timezone: body.timezone,
      recipients: body.recipients,
      format: body.format
        ? (body.format.toLowerCase() as ReportDeliveryFormat)
        : undefined,
      dayOfWeek: body.dayOfWeek,
      dayOfMonth: body.dayOfMonth,
      status: body.status as ScheduleDeliveryStatus | undefined,
    });
    return NextResponse.json({ schedule });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update schedule";
    const status = message === "Schedule not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
