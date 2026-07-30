import type { IotIngestPayload, IotReadingQuality, ValidatedIotReading } from "./types";
import { normalizeSensorType } from "./sensorMap";

export type ValidateReadingResult =
  | { ok: true; reading: ValidatedIotReading }
  | { ok: false; error: string; quality: IotReadingQuality };

const MAX_ABS_VALUE = 1e12;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function coerceNumber(value: unknown): number | null {
  if (isFiniteNumber(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function parseTimestamp(raw: unknown): string | null {
  if (raw == null || raw === "") return new Date().toISOString();
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  // Reject readings more than 7 days in the future
  if (d.getTime() > Date.now() + 7 * 24 * 60 * 60 * 1000) return null;
  return d.toISOString();
}

/**
 * Validate an IoT ingest payload. Invalid readings are rejected — never coerced to zero.
 * Callers may still persist a quality:missing marker when business rules require it.
 */
export function validateIotReading(payload: IotIngestPayload): ValidateReadingResult {
  if (
    !payload.deviceId ||
    typeof payload.deviceId !== "string" ||
    !payload.deviceId.trim()
  ) {
    return { ok: false, error: "deviceId is required", quality: "missing" };
  }

  if (
    !payload.sensorType ||
    typeof payload.sensorType !== "string" ||
    !payload.sensorType.trim()
  ) {
    return { ok: false, error: "sensorType is required", quality: "missing" };
  }

  if (!payload.unit || typeof payload.unit !== "string" || !payload.unit.trim()) {
    return { ok: false, error: "unit is required", quality: "missing" };
  }

  const value = coerceNumber(payload.value);
  if (value === null) {
    return {
      ok: false,
      error: "value must be a finite number (null/NaN rejected)",
      quality: "missing",
    };
  }

  if (Math.abs(value) > MAX_ABS_VALUE) {
    return {
      ok: false,
      error: "value exceeds allowed magnitude",
      quality: "missing",
    };
  }

  const timestamp = parseTimestamp(payload.timestamp);
  if (!timestamp) {
    return { ok: false, error: "timestamp is invalid", quality: "missing" };
  }

  return {
    ok: true,
    reading: {
      deviceId: payload.deviceId.trim(),
      sensorType: normalizeSensorType(payload.sensorType),
      value,
      unit: payload.unit.trim(),
      timestamp,
      quality: "measured",
    },
  };
}
