/**
 * Honest IoT protocol capability — HTTP/MQTT are native; Modbus/OPC-UA/utility
 * need an edge gateway push to /api/app/iot/ingest (or a future adapter).
 */

import { utilityConnectionStatus } from "@/lib/integrations/utility";

export type IotProtocolMode =
  | { mode: "native"; adapter: "http" | "mqtt" }
  | { mode: "gateway_push"; protocol: string; reason: string }
  | { mode: "unsupported"; reason: string };

const NATIVE = new Set(["http", "mqtt", "smart_meter"]);
const GATEWAY_PUSH = new Set(["modbus", "opc_ua"]);
const UTILITY = new Set(["utility_energy", "utility_gas", "utility_water"]);

export function protocolIngestMode(deviceType: string): IotProtocolMode {
  const t = deviceType.trim().toLowerCase();

  if (t === "http" || t === "smart_meter") {
    return { mode: "native", adapter: "http" };
  }
  if (t === "mqtt") {
    return { mode: "native", adapter: "mqtt" };
  }

  if (GATEWAY_PUSH.has(t)) {
    return {
      mode: "gateway_push",
      protocol: t,
      reason:
        t === "modbus"
          ? "Modbus devices must push readings via an edge gateway to POST /api/app/iot/ingest (JSON). Native Modbus polling is not enabled in-app."
          : "OPC-UA servers must push readings via an edge gateway to POST /api/app/iot/ingest (JSON). Native OPC-UA client is not enabled in-app.",
    };
  }

  if (UTILITY.has(t) || t.startsWith("utility_")) {
    const status = utilityConnectionStatus();
    if (status.status === "unavailable") {
      return {
        mode: "unsupported",
        reason: status.reason,
      };
    }
    return {
      mode: "unsupported",
      reason: `Utility adapter for "${status.provider}" is not implemented. Do not fabricate kWh — use CSV import, meters, or manual Metrics entry.`,
    };
  }

  if (NATIVE.has(t)) {
    return { mode: "native", adapter: "http" };
  }

  return {
    mode: "unsupported",
    reason: `Device type "${deviceType}" is not supported for native ingest.`,
  };
}

export function protocolSupportLabel(deviceType: string): string {
  const m = protocolIngestMode(deviceType);
  if (m.mode === "native") return `Native ${m.adapter.toUpperCase()} ingest`;
  if (m.mode === "gateway_push") return "Edge gateway → REST ingest";
  return "Not available";
}

export function isNativeIngestDeviceType(deviceType: string): boolean {
  return protocolIngestMode(deviceType).mode === "native";
}
