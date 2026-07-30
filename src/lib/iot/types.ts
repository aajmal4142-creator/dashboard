export type IotSensorType =
  "energy" | "electricity" | "gas" | "water" | "fuel" | "temperature" | "custom";

export type IotEmissionsScope = "1" | "2" | "3";

export type IotReadingQuality = "measured" | "missing";

export type IotDevicePublicStatus = "online" | "offline" | "error" | "maintenance";

export type IotBucket = "raw" | "hourly" | "daily";

export type IotIngestPayload = {
  deviceId: string;
  sensorType: string;
  value: unknown;
  unit: string;
  timestamp?: string;
};

export type ValidatedIotReading = {
  deviceId: string;
  sensorType: IotSensorType | string;
  value: number;
  unit: string;
  timestamp: string;
  quality: IotReadingQuality;
};

export type SensorCategoryMapping = {
  sensorType: string;
  metricKey: string;
  unit: string;
  scope: IotEmissionsScope;
  categoryLabel: string;
};

export type AnomalyResult = {
  isAnomaly: boolean;
  reason: string | null;
  mean: number | null;
  stdDev: number | null;
  baseline: number | null;
  method: "three_sigma" | "three_x_baseline" | "insufficient_data" | null;
};

export type AggregatePoint = {
  bucketStart: string;
  bucket: IotBucket;
  sensorType: string;
  unit: string;
  sum: number;
  count: number;
  avg: number;
  min: number;
  max: number;
};
