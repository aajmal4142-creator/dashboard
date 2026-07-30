import type { AggregatePoint, IotBucket } from "./types";

export type RawReadingForAggregate = {
  timestamp: string;
  sensorType: string;
  unit: string;
  value: number;
};

function floorToHour(iso: string): string {
  const d = new Date(iso);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

function floorToDay(iso: string): string {
  const d = new Date(iso);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function bucketKey(
  bucket: IotBucket,
  start: string,
  sensorType: string,
  unit: string,
): string {
  return `${bucket}|${start}|${sensorType}|${unit}`;
}

function emptyPoint(
  bucket: IotBucket,
  bucketStart: string,
  sensorType: string,
  unit: string,
): AggregatePoint {
  return {
    bucketStart,
    bucket,
    sensorType,
    unit,
    sum: 0,
    count: 0,
    avg: 0,
    min: Number.POSITIVE_INFINITY,
    max: Number.NEGATIVE_INFINITY,
  };
}

function finalize(point: AggregatePoint): AggregatePoint {
  if (point.count === 0) {
    return { ...point, min: 0, max: 0, avg: 0 };
  }
  return {
    ...point,
    avg: point.sum / point.count,
  };
}

/**
 * Aggregate raw readings into hourly and/or daily buckets (UTC).
 */
export function aggregateReadings(
  readings: RawReadingForAggregate[],
  buckets: IotBucket[] = ["hourly", "daily"],
): AggregatePoint[] {
  const map = new Map<string, AggregatePoint>();

  for (const r of readings) {
    if (!Number.isFinite(r.value)) continue;

    for (const bucket of buckets) {
      if (bucket === "raw") continue;
      const start =
        bucket === "hourly" ? floorToHour(r.timestamp) : floorToDay(r.timestamp);
      const key = bucketKey(bucket, start, r.sensorType, r.unit);
      let point = map.get(key);
      if (!point) {
        point = emptyPoint(bucket, start, r.sensorType, r.unit);
        map.set(key, point);
      }
      point.sum += r.value;
      point.count += 1;
      point.min = Math.min(point.min, r.value);
      point.max = Math.max(point.max, r.value);
    }
  }

  return [...map.values()].map(finalize).sort((a, b) => {
    if (a.bucketStart < b.bucketStart) return -1;
    if (a.bucketStart > b.bucketStart) return 1;
    return a.bucket.localeCompare(b.bucket);
  });
}

/** Fold one reading into an existing aggregate point (immutable). */
export function foldReadingIntoAggregate(
  existing: AggregatePoint | null,
  reading: RawReadingForAggregate,
  bucket: Exclude<IotBucket, "raw">,
): AggregatePoint {
  const start =
    bucket === "hourly" ? floorToHour(reading.timestamp) : floorToDay(reading.timestamp);
  const base =
    existing &&
    existing.bucketStart === start &&
    existing.sensorType === reading.sensorType &&
    existing.unit === reading.unit
      ? existing
      : emptyPoint(bucket, start, reading.sensorType, reading.unit);

  const next: AggregatePoint = {
    ...base,
    sum: base.sum + reading.value,
    count: base.count + 1,
    min: Math.min(
      base.min === Number.POSITIVE_INFINITY ? reading.value : base.min,
      reading.value,
    ),
    max: Math.max(
      base.max === Number.NEGATIVE_INFINITY ? reading.value : base.max,
      reading.value,
    ),
    avg: 0,
  };
  return finalize(next);
}

export function hourlyBucketStart(iso: string): string {
  return floorToHour(iso);
}

export function dailyBucketStart(iso: string): string {
  return floorToDay(iso);
}

/** Retention cutoff: readings older than retentionDays should be purged. */
export function retentionCutoff(retentionDays: number, now = new Date()): Date {
  const days = Math.max(1, Math.floor(retentionDays));
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function expiresAtFromTimestamp(timestamp: string, retentionDays = 365): string {
  const d = new Date(timestamp);
  d.setUTCDate(d.getUTCDate() + Math.max(1, Math.floor(retentionDays)));
  return d.toISOString();
}
