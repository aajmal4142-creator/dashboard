import type { IotEmissionsScope, SensorCategoryMapping } from "./types";

/**
 * Default sensor → emissions category / metric mapping.
 * Readings become datapoints on these metricKeys; factors come from the registry.
 */
const DEFAULT_SENSOR_MAP: Record<string, SensorCategoryMapping> = {
  energy: {
    sensorType: "energy",
    metricKey: "electricity_kwh",
    unit: "kWh",
    scope: "2",
    categoryLabel: "Scope 2 — purchased electricity",
  },
  electricity: {
    sensorType: "electricity",
    metricKey: "electricity_kwh",
    unit: "kWh",
    scope: "2",
    categoryLabel: "Scope 2 — purchased electricity",
  },
  gas: {
    sensorType: "gas",
    metricKey: "natural_gas_m3",
    unit: "m3",
    scope: "1",
    categoryLabel: "Scope 1 — stationary combustion (gas)",
  },
  fuel: {
    sensorType: "fuel",
    metricKey: "diesel_litres",
    unit: "L",
    scope: "1",
    categoryLabel: "Scope 1 — mobile / stationary fuel",
  },
  water: {
    sensorType: "water",
    metricKey: "water_m3",
    unit: "m3",
    scope: "3",
    categoryLabel: "Scope 3 — water (operational)",
  },
  temperature: {
    sensorType: "temperature",
    metricKey: "iot_temperature_c",
    unit: "C",
    scope: "2",
    categoryLabel: "Facility condition (non-emissions context)",
  },
};

export function normalizeSensorType(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_");
}

export function mapSensorToCategory(
  sensorType: string,
  overrides?: Array<{
    sensorType: string;
    metricKey: string;
    unit?: string | null;
    scope?: IotEmissionsScope | string | null;
  }> | null,
): SensorCategoryMapping | null {
  const key = normalizeSensorType(sensorType);

  if (overrides?.length) {
    const hit = overrides.find((o) => normalizeSensorType(o.sensorType) === key);
    if (hit) {
      const scope = (
        hit.scope === "1" || hit.scope === "2" || hit.scope === "3" ? hit.scope : "2"
      ) as IotEmissionsScope;
      const fallback = DEFAULT_SENSOR_MAP[key];
      return {
        sensorType: key,
        metricKey: hit.metricKey,
        unit: hit.unit || fallback?.unit || "unit",
        scope,
        categoryLabel: fallback?.categoryLabel ?? `Scope ${scope} — ${hit.metricKey}`,
      };
    }
  }

  return DEFAULT_SENSOR_MAP[key] ?? null;
}

export function listDefaultSensorMappings(): SensorCategoryMapping[] {
  return Object.values(DEFAULT_SENSOR_MAP);
}
