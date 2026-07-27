import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { getPayload } from "payload";
import type { NextRequest } from "next/server";

import config from "@/payload.config";

export async function POST(req: NextRequest) {
  try {
    const evt = await verifyWebhook(req);
    const payload = await getPayload({ config });

    if (evt.type === "user.created" || evt.type === "user.updated") {
      const user = evt.data;
      const email =
        user.email_addresses.find((e) => e.id === user.primary_email_address_id)
          ?.email_address ??
        user.email_addresses[0]?.email_address ??
        "";

      const existing = await payload.find({
        collection: "users",
        where: { clerkId: { equals: user.id } },
        limit: 1,
        overrideAccess: true,
      });

      const data = {
        clerkId: user.id,
        email,
        firstName: user.first_name ?? undefined,
        lastName: user.last_name ?? undefined,
        avatarUrl: user.image_url,
        lastSeenAt: new Date().toISOString(),
      };

      if (existing.docs[0]) {
        await payload.update({
          collection: "users",
          id: existing.docs[0].id,
          data,
          overrideAccess: true,
        });
      } else {
        await payload.create({
          collection: "users",
          data: {
            ...data,
            password: `clerk-${user.id}-${Date.now()}`,
          },
          overrideAccess: true,
        });
      }
    }

    if (evt.type === "user.deleted") {
      const id = evt.data.id;
      if (id) {
        const existing = await payload.find({
          collection: "users",
          where: { clerkId: { equals: id } },
          limit: 1,
          overrideAccess: true,
        });
        if (existing.docs[0]) {
          await payload.delete({
            collection: "users",
            id: existing.docs[0].id,
            overrideAccess: true,
          });
        }
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Clerk webhook error", error);
    return Response.json({ error: "Webhook verification failed" }, { status: 400 });
  }
}
