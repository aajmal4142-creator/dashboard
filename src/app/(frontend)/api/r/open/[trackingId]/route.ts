import { getPayload } from "payload";
import { NextResponse } from "next/server";

import {
  mapDeliveryHistoryRows,
  recordDeliveryOpen,
} from "@/lib/reports/deliveryHistory";
import config from "@/payload.config";

/** 1×1 transparent GIF */
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

/**
 * Email open tracking pixel. Always returns a GIF so clients don't retry.
 * Increments openCount when trackingId matches a deliveryHistory row.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ trackingId: string }> },
) {
  const { trackingId } = await ctx.params;
  const id = (trackingId ?? "").trim();

  if (id) {
    try {
      const payload = await getPayload({ config });
      const found = await payload.find({
        collection: "scheduled-reports",
        where: {
          "deliveryHistory.trackingId": { equals: id },
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      });
      const doc = found.docs[0];
      if (doc) {
        const existing = mapDeliveryHistoryRows(doc.deliveryHistory);
        const next = recordDeliveryOpen(existing, id);
        if (next) {
          await payload.update({
            collection: "scheduled-reports",
            id: doc.id,
            data: { deliveryHistory: next },
            overrideAccess: true,
          });
        }
      }
    } catch (err) {
      console.error("[open-track] failed", err);
    }
  }

  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
    },
  });
}
