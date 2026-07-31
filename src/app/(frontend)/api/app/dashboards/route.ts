import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import {
  buildUserOrgLayoutWhere,
  defaultLayoutNameForRole,
  defaultWidgetsForRole,
  mapLayoutDoc,
  parseCreateBody,
} from "@/lib/dashboards";
import {
  clearOtherDefaults,
  createDashboardLayout,
  findDashboardLayouts,
} from "@/lib/dashboards/store";
import config from "@/payload.config";

/** GET /api/app/dashboards — list own org-scoped layouts + role defaults. */
export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json(
      {
        error: "No active organisation. Finish onboarding or switch organisation.",
      },
      { status: 403 },
    );
  }

  const payload = await getPayload({ config });
  const result = await findDashboardLayouts(payload, {
    where: buildUserOrgLayoutWhere(ctx.user.id, ctx.activeOrg.id),
    sort: "-updatedAt",
    limit: 50,
  });

  const layouts = result.docs
    .map((doc) => mapLayoutDoc(doc))
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return NextResponse.json({
    layouts,
    total: result.totalDocs,
    roleDefaults: {
      name: defaultLayoutNameForRole(ctx.role),
      widgets: defaultWidgetsForRole(ctx.role),
      role: ctx.role,
    },
  });
}

/** POST /api/app/dashboards — create a layout (optional fromRoleDefault). */
export async function POST(req: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json(
      {
        error: "No active organisation. Finish onboarding or switch organisation.",
      },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const raw =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;

  if (raw?.fromRoleDefault === true) {
    const widgets = defaultWidgetsForRole(ctx.role);
    const name =
      typeof raw.name === "string" && raw.name.trim()
        ? raw.name.trim()
        : defaultLayoutNameForRole(ctx.role);
    const isDefault = raw.isDefault === true || raw.isDefault === undefined;

    const payload = await getPayload({ config });
    const created = await createDashboardLayout(payload, {
      userId: ctx.user.id,
      organisationId: ctx.activeOrg.id,
      name,
      isDefault,
      widgets,
    });

    if (isDefault) {
      await clearOtherDefaults(payload, ctx.user.id, ctx.activeOrg.id, created.id);
    }

    const layout = mapLayoutDoc(created);
    return NextResponse.json({ layout }, { status: 201 });
  }

  const parsed = parseCreateBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const payload = await getPayload({ config });
  const created = await createDashboardLayout(payload, {
    userId: ctx.user.id,
    organisationId: ctx.activeOrg.id,
    name: parsed.data.name,
    isDefault: parsed.data.isDefault === true,
    widgets: parsed.data.widgets,
  });

  if (parsed.data.isDefault === true) {
    await clearOtherDefaults(payload, ctx.user.id, ctx.activeOrg.id, created.id);
  }

  const layout = mapLayoutDoc(created);
  return NextResponse.json({ layout }, { status: 201 });
}
