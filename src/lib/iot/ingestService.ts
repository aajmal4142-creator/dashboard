import { getPayload } from "payload";

import { writeAuditLog } from "@/lib/audit/write";
import { writeDatapoint } from "@/lib/data/writeDatapoint";
import config from "@/payload.config";

import { detectIotAnomaly } from "./anomaly";
import {
  dailyBucketStart,
  expiresAtFromTimestamp,
  foldReadingIntoAggregate,
  hourlyBucketStart,
} from "./aggregate";
import { mapSensorToCategory } from "./sensorMap";
import { toStoredStatus } from "./status";
import type { AggregatePoint, AnomalyResult, ValidatedIotReading } from "./types";
import { validateIotReading, type ValidateReadingResult } from "./validateReading";
import type { IotIngestPayload } from "./types";
import { verifyDeviceApiKey } from "./apiKey";

type DeviceDoc = {
  id: string;
  organisation: string | { id: string };
  deviceId: string;
  apiKeyHash?: string | null;
  anomalyDetectionEnabled?: boolean | null;
  retentionDays?: number | null;
  sensorMappings?: Array<{
    sensorType: string;
    metricKey: string;
    unit?: string | null;
    scope?: string | null;
  }> | null;
};

function orgIdOf(value: DeviceDoc["organisation"]): string {
  return typeof value === "string" ? value : value.id;
}

export type IotIngestResult = {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
};

async function resolveOpenPeriod(
  organisationId: string,
  periodId?: string,
): Promise<string | null> {
  const payload = await getPayload({ config });
  if (periodId) return periodId;

  const periods = await payload.find({
    collection: "reporting-periods",
    where: {
      and: [{ organisation: { equals: organisationId } }, { status: { equals: "open" } }],
    },
    sort: "-createdAt",
    limit: 1,
    overrideAccess: true,
  });
  return periods.docs[0]?.id ?? null;
}

async function loadPriorValues(
  organisationId: string,
  deviceDocId: string,
  sensorType: string,
): Promise<number[]> {
  const payload = await getPayload({ config });
  const recent = await payload.find({
    collection: "iot-data-streams",
    where: {
      and: [
        { organisation: { equals: organisationId } },
        { device: { equals: deviceDocId } },
        { sensorType: { equals: sensorType } },
        { bucket: { equals: "raw" } },
        { quality: { equals: "measured" } },
      ],
    },
    sort: "-timestamp",
    limit: 100,
    overrideAccess: true,
  });

  return recent.docs
    .map((d) => d.value)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
}

async function upsertAggregate(
  organisationId: string,
  deviceDocId: string,
  reading: ValidatedIotReading,
  bucket: "hourly" | "daily",
  retentionDays: number,
): Promise<AggregatePoint> {
  const payload = await getPayload({ config });
  const bucketStart =
    bucket === "hourly"
      ? hourlyBucketStart(reading.timestamp)
      : dailyBucketStart(reading.timestamp);

  const existing = await payload.find({
    collection: "iot-data-streams",
    where: {
      and: [
        { organisation: { equals: organisationId } },
        { device: { equals: deviceDocId } },
        { sensorType: { equals: reading.sensorType } },
        { unit: { equals: reading.unit } },
        { bucket: { equals: bucket } },
        { timestamp: { equals: bucketStart } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  });

  const priorDoc = existing.docs[0];
  const priorPoint: AggregatePoint | null = priorDoc
    ? {
        bucketStart,
        bucket,
        sensorType: reading.sensorType,
        unit: reading.unit,
        sum: typeof priorDoc.sum === "number" ? priorDoc.sum : (priorDoc.value ?? 0),
        count: typeof priorDoc.count === "number" ? priorDoc.count : 1,
        avg: typeof priorDoc.avg === "number" ? priorDoc.avg : (priorDoc.value ?? 0),
        min: typeof priorDoc.min === "number" ? priorDoc.min : (priorDoc.value ?? 0),
        max: typeof priorDoc.max === "number" ? priorDoc.max : (priorDoc.value ?? 0),
      }
    : null;

  const next = foldReadingIntoAggregate(
    priorPoint,
    {
      timestamp: reading.timestamp,
      sensorType: reading.sensorType,
      unit: reading.unit,
      value: reading.value,
    },
    bucket,
  );

  const data = {
    organisation: organisationId,
    device: deviceDocId,
    sensorType: reading.sensorType,
    value: next.sum,
    unit: reading.unit,
    timestamp: bucketStart,
    quality: "measured" as const,
    bucket,
    sum: next.sum,
    count: next.count,
    avg: next.avg,
    min: next.min,
    max: next.max,
    isAnomaly: false,
    expiresAt: expiresAtFromTimestamp(bucketStart, retentionDays),
  };

  if (priorDoc) {
    await payload.update({
      collection: "iot-data-streams",
      id: priorDoc.id,
      data,
      overrideAccess: true,
    });
  } else {
    await (
      payload.create as (args: {
        collection: "iot-data-streams";
        data: Record<string, unknown>;
        overrideAccess: true;
      }) => Promise<{ id: string }>
    )({
      collection: "iot-data-streams",
      data,
      overrideAccess: true,
    });
  }

  return next;
}

/**
 * Authenticated device ingest: validate → stream → anomaly → aggregate → datapoint.
 */
export async function ingestIotReading(input: {
  payload: IotIngestPayload & { periodId?: string };
  apiKey: string | null;
}): Promise<IotIngestResult> {
  const validated: ValidateReadingResult = validateIotReading(input.payload);
  if (!validated.ok) {
    return {
      ok: false,
      status: 400,
      body: {
        error: validated.error,
        quality: validated.quality,
      },
    };
  }

  const reading = validated.reading;
  const payload = await getPayload({ config });

  const devices = await payload.find({
    collection: "iot-devices",
    where: { deviceId: { equals: reading.deviceId } },
    limit: 1,
    overrideAccess: true,
  });

  const device = devices.docs[0] as DeviceDoc | undefined;
  if (!device) {
    return { ok: false, status: 404, body: { error: "Device not found" } };
  }

  if (!verifyDeviceApiKey(input.apiKey, device.apiKeyHash)) {
    return { ok: false, status: 401, body: { error: "Invalid device API key" } };
  }

  const organisationId = orgIdOf(device.organisation);
  const mapping = mapSensorToCategory(reading.sensorType, device.sensorMappings);
  if (!mapping) {
    return {
      ok: false,
      status: 400,
      body: {
        error: `Unknown sensorType "${reading.sensorType}". Register a sensor mapping on the device.`,
        quality: "missing",
      },
    };
  }

  if (mapping.unit && reading.unit.toLowerCase() !== mapping.unit.toLowerCase()) {
    return {
      ok: false,
      status: 400,
      body: {
        error: `unit "${reading.unit}" does not match expected "${mapping.unit}" for ${mapping.sensorType}`,
        quality: "missing",
      },
    };
  }

  const periodId = await resolveOpenPeriod(organisationId, input.payload.periodId);
  if (!periodId) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "No open reporting period found. Pass periodId or open a period.",
      },
    };
  }

  const retentionDays = device.retentionDays ?? 365;
  let anomaly: AnomalyResult = {
    isAnomaly: false,
    reason: null,
    mean: null,
    stdDev: null,
    baseline: null,
    method: "insufficient_data",
  };

  if (device.anomalyDetectionEnabled !== false) {
    const priors = await loadPriorValues(organisationId, device.id, reading.sensorType);
    anomaly = detectIotAnomaly(reading.value, priors);
  }

  const stream = await (
    payload.create as (args: {
      collection: "iot-data-streams";
      data: Record<string, unknown>;
      overrideAccess: true;
    }) => Promise<{ id: string }>
  )({
    collection: "iot-data-streams",
    data: {
      organisation: organisationId,
      device: device.id,
      sensorType: reading.sensorType,
      value: reading.value,
      unit: reading.unit,
      timestamp: reading.timestamp,
      quality: reading.quality,
      bucket: "raw",
      isAnomaly: anomaly.isAnomaly,
      anomalyReason: anomaly.reason,
      metricKey: mapping.metricKey,
      scope: mapping.scope,
      expiresAt: expiresAtFromTimestamp(reading.timestamp, retentionDays),
    },
    overrideAccess: true,
  });

  await upsertAggregate(organisationId, device.id, reading, "hourly", retentionDays);
  const daily = await upsertAggregate(
    organisationId,
    device.id,
    reading,
    "daily",
    retentionDays,
  );

  const nowIso = new Date().toISOString();
  await payload.update({
    collection: "iot-devices",
    id: device.id,
    data: {
      status: toStoredStatus("online"),
      lastHeartbeat: nowIso,
    },
    overrideAccess: true,
  });

  // Map to period datapoint — measured quality; anomalies keep value but audit
  const dp = await writeDatapoint(payload, {
    organisationId,
    periodId,
    metricKey: mapping.metricKey,
    value: daily.sum,
    unit: reading.unit,
    quality: "measured",
    source: "api",
    actorId: `iot:${device.deviceId}`,
  });

  if (anomaly.isAnomaly) {
    await writeAuditLog(payload, {
      organisationId,
      actorId: null,
      action: "iot.anomaly_detected",
      entityType: "iot-devices",
      entityId: device.id,
      after: {
        sensorType: reading.sensorType,
        value: reading.value,
        reason: anomaly.reason,
        method: anomaly.method,
        streamId: stream.id,
        datapointId: dp.id,
      },
    });
  }

  return {
    ok: true,
    status: 200,
    body: {
      success: true,
      deviceId: reading.deviceId,
      streamId: stream.id,
      datapointId: dp.id,
      metricKey: mapping.metricKey,
      scope: mapping.scope,
      category: mapping.categoryLabel,
      quality: reading.quality,
      deviceStatus: "online",
      anomaly: {
        isAnomaly: anomaly.isAnomaly,
        reason: anomaly.reason,
        method: anomaly.method,
      },
      aggregates: {
        dailySum: daily.sum,
        dailyCount: daily.count,
      },
    },
  };
}
