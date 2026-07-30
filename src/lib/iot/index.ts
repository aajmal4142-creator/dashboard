export type {
  IotSensorType,
  IotEmissionsScope,
  IotReadingQuality,
  IotDevicePublicStatus,
  IotBucket,
  IotIngestPayload,
  ValidatedIotReading,
  SensorCategoryMapping,
  AnomalyResult,
  AggregatePoint,
} from "./types";

export {
  generateDeviceApiKey,
  hashDeviceApiKey,
  verifyDeviceApiKey,
  extractDeviceApiKey,
} from "./apiKey";

export {
  mapSensorToCategory,
  normalizeSensorType,
  listDefaultSensorMappings,
} from "./sensorMap";

export { validateIotReading } from "./validateReading";
export type { ValidateReadingResult } from "./validateReading";

export { detectIotAnomaly } from "./anomaly";

export {
  aggregateReadings,
  foldReadingIntoAggregate,
  hourlyBucketStart,
  dailyBucketStart,
  retentionCutoff,
  expiresAtFromTimestamp,
} from "./aggregate";
export type { RawReadingForAggregate } from "./aggregate";

export { resolveDeviceStatus, toStoredStatus, DEFAULT_OFFLINE_AFTER_MS } from "./status";

export { mqttMessageToIngestPayload } from "./mqttAdapter";

export { ingestIotReading, type IotIngestResult } from "./ingestService";
