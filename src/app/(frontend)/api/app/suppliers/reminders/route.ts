import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import { REMINDER_DAYS } from "@/lib/suppliers";
import config from "@/payload.config";

/**
 * Chase suppliers at day 7 and 14 after sentAt.
 * Call manually or from a scheduler. Idempotent per reminder day.
 */
export async function POST(req: Request) {
  const auth = await getCurrentContext();
  if (!auth.activeOrg || auth.role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await getPayload({ config });
  const result = await payload.find({
    collection: "suppliers",
    where: {
      and: [
        { organisation: { equals: auth.activeOrg.id } },
        { requestStatus: { in: ["sent", "opened"] } },
      ],
    },
    limit: 200,
    overrideAccess: true,
  });

  const origin = new URL(req.url).origin;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  let sent = 0;

  for (const supplier of result.docs) {
    if (!supplier.sentAt || !supplier.requestToken) continue;
    const daysSince = Math.floor(
      (now - new Date(String(supplier.sentAt)).getTime()) / dayMs,
    );
    const already = supplier.reminderCount ?? 0;
    const dueIndex = REMINDER_DAYS.findIndex((d, i) => daysSince >= d && already <= i);
    if (dueIndex < 0) continue;

    const link = `${origin}/s/${supplier.requestToken}`;
    await payload.sendEmail({
      to: supplier.contactEmail,
      subject: `Reminder: ${auth.activeOrg.name} still needs your emissions data`,
      html: `<p>Friendly reminder from ${auth.activeOrg.name}.</p>
<p>Please complete: <a href="${link}">${link}</a></p>`,
    });

    await payload.update({
      collection: "suppliers",
      id: supplier.id,
      data: {
        reminderCount: dueIndex + 1,
        lastReminderAt: new Date().toISOString(),
      },
      overrideAccess: true,
    });
    sent += 1;
  }

  return NextResponse.json({ ok: true, remindersSent: sent });
}
