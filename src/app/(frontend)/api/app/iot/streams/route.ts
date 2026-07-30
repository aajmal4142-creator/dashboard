import { getPayload, type Where } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

/**
 * GET /api/app/iot/streams?hours=24&deviceId=&bucket=hourly
 * Returns time-series for the IoT dashboard chart.
 */
export async function GET(request: Request) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg || !ctx.role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const hours = Math.min(
      168,
      Math.max(1, Number(url.searchParams.get("hours") || 24) || 24),
    );
    const deviceId = url.searchParams.get("deviceId");
    const bucketParam = url.searchParams.get("bucket") || "hourly";
    const bucket =
      bucketParam === "raw" || bucketParam === "daily" || bucketParam === "hourly"
        ? bucketParam
        : "hourly";

    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const payload = await getPayload({ config });

    const and: Where[] = [
      { organisation: { equals: ctx.activeOrg.id } },
      { bucket: { equals: bucket } },
      { timestamp: { greater_than_equal: since } },
    ];

    if (deviceId) {
      const devices = await payload.find({
        collection: "iot-devices",
        where: {
          and: [
            { organisation: { equals: ctx.activeOrg.id } },
            { deviceId: { equals: deviceId } },
          ],
        },
        limit: 1,
        overrideAccess: true,
      });
      const doc = devices.docs[0];
      if (!doc) {
        return NextResponse.json({ error: "Device not found" }, { status: 404 });
      }
      and.push({ device: { equals: doc.id } });
    }

    const streams = await payload.find({
      collection: "iot-data-streams",
      where: { and },
      sort: "timestamp",
      limit: 500,
      overrideAccess: true,
    });

    const points = streams.docs.map((d) => ({
      id: d.id,
      sensorType: d.sensorType,
      unit: d.unit,
      timestamp: d.timestamp,
      value: d.value,
      sum: d.sum ?? d.value,
      count: d.count ?? 1,
      avg: d.avg ?? d.value,
      isAnomaly: Boolean(d.isAnomaly),
      anomalyReason: d.anomalyReason ?? null,
      metricKey: d.metricKey ?? null,
      scope: d.scope ?? null,
      quality: d.quality,
    }));

    const anomalyCount = points.filter((p) => p.isAnomaly).length;

    return NextResponse.json({
      hours,
      bucket,
      points,
      anomalyCount,
    });
  } catch (error) {
    console.error("IoT streams error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
