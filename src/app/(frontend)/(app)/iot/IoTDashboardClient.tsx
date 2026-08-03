"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { protocolIngestMode, protocolSupportLabel } from "@/lib/iot/protocolSupport";
import { cn } from "@/lib/utils";

type DeviceRow = {
  id: string;
  deviceName: string;
  deviceId: string;
  deviceType: string;
  status: "online" | "offline" | "error" | "maintenance";
  lastHeartbeat: string | null;
  location: string | null;
  apiKeyPrefix: string | null;
  retentionDays: number;
};

type OfflineAlert = {
  id: string;
  deviceName: string;
  deviceId: string;
  lastHeartbeat: string | null;
};

type StreamPoint = {
  id: string;
  timestamp: string;
  value: number;
  sensorType: string;
  unit: string;
  isAnomaly: boolean;
  sum?: number | null;
  avg?: number | null;
};

function formatTs(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function TwentyFourHourChart({ points }: { points: StreamPoint[] }) {
  if (points.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        No readings in the last 24 hours. Register a device and POST to
        /api/app/iot/ingest.
      </p>
    );
  }

  const values = points.map((p) => (typeof p.sum === "number" ? p.sum : p.value));
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  const w = 560;
  const h = 160;
  const pad = 28;

  function x(i: number): number {
    if (points.length <= 1) return pad;
    return pad + (i / (points.length - 1)) * (w - pad * 2);
  }
  function y(v: number): number {
    return h - pad - ((v - min) / span) * (h - pad * 2);
  }

  const d = points
    .map((p, i) => {
      const v = typeof p.sum === "number" ? p.sum : p.value;
      return `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full max-w-2xl"
      role="img"
      aria-label="IoT readings over 24 hours"
    >
      <line
        x1={pad}
        y1={h - pad}
        x2={w - pad}
        y2={h - pad}
        stroke="var(--rule-strong)"
        strokeWidth={1}
      />
      <line
        x1={pad}
        y1={pad}
        x2={pad}
        y2={h - pad}
        stroke="var(--rule-strong)"
        strokeWidth={1}
      />
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2} />
      {points.map((p, i) => {
        if (!p.isAnomaly) return null;
        const v = typeof p.sum === "number" ? p.sum : p.value;
        return <circle key={p.id} cx={x(i)} cy={y(v)} r={4} fill="var(--rust)" />;
      })}
      <text
        x={pad}
        y={14}
        className="fill-[var(--ink-muted)]"
        style={{ fontSize: 10, fontFamily: "var(--font-mono), monospace" }}
      >
        {max.toFixed(1)}
      </text>
      <text
        x={pad}
        y={h - 8}
        className="fill-[var(--ink-muted)]"
        style={{ fontSize: 10, fontFamily: "var(--font-mono), monospace" }}
      >
        {min.toFixed(1)}
      </text>
    </svg>
  );
}

export function IoTDashboardClient({ canManage }: { canManage: boolean }) {
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [offlineAlerts, setOfflineAlerts] = useState<OfflineAlert[]>([]);
  const [points, setPoints] = useState<StreamPoint[]>([]);
  const [anomalyCount, setAnomalyCount] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [deviceType, setDeviceType] = useState("http");

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const [devRes, streamRes] = await Promise.all([
        fetch("/api/app/iot/devices"),
        fetch("/api/app/iot/streams?hours=24&bucket=hourly"),
      ]);
      const devData = (await devRes.json()) as {
        error?: string;
        devices?: DeviceRow[];
        offlineAlerts?: OfflineAlert[];
      };
      const streamData = (await streamRes.json()) as {
        error?: string;
        points?: StreamPoint[];
        anomalyCount?: number;
      };

      if (!devRes.ok) {
        setLoadError(devData.error ?? "Could not load devices.");
        return;
      }
      setDevices(devData.devices ?? []);
      setOfflineAlerts(devData.offlineAlerts ?? []);

      if (streamRes.ok) {
        setPoints(streamData.points ?? []);
        setAnomalyCount(streamData.anomalyCount ?? 0);
      }
    } catch {
      setLoadError("Network error loading IoT dashboard.");
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(id);
  }, [refresh]);

  function registerDevice() {
    if (!canManage) return;
    setStatusMsg(null);
    setRevealedKey(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/app/iot/devices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceName: name,
            deviceId,
            deviceType,
          }),
        });
        const data = (await res.json()) as {
          error?: string;
          apiKey?: string;
          note?: string;
        };
        if (!res.ok) {
          setStatusMsg(data.error ?? "Could not register device.");
          return;
        }
        setRevealedKey(data.apiKey ?? null);
        setStatusMsg(data.note ?? "Device registered.");
        setName("");
        setDeviceId("");
        await refresh();
      } catch {
        setStatusMsg("Network error while registering device.");
      }
    });
  }

  function deleteDevice(id: string) {
    if (!canManage) return;
    startTransition(async () => {
      const res = await fetch(`/api/app/iot/devices/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setStatusMsg(data.error ?? "Could not delete device.");
        return;
      }
      setStatusMsg("Device deleted.");
      await refresh();
    });
  }

  function rotateKey(id: string) {
    if (!canManage) return;
    startTransition(async () => {
      const res = await fetch(`/api/app/iot/devices/${id}/rotate-key`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        error?: string;
        apiKey?: string;
        note?: string;
      };
      if (!res.ok) {
        setStatusMsg(data.error ?? "Could not rotate key.");
        return;
      }
      setRevealedKey(data.apiKey ?? null);
      setStatusMsg(data.note ?? "API key rotated.");
      await refresh();
    });
  }

  return (
    <div className="space-y-10">
      {offlineAlerts.length > 0 ? (
        <div
          role="alert"
          className="border border-rule-strong bg-surface-2 px-4 py-3 text-sm text-ink"
        >
          <p className="font-medium text-rust">
            {offlineAlerts.length} device{offlineAlerts.length === 1 ? "" : "s"} offline
          </p>
          <ul className="mt-2 space-y-1 font-mono text-xs text-ink-muted">
            {offlineAlerts.map((a) => (
              <li key={a.id}>
                {a.deviceName} ({a.deviceId}) — last heartbeat {formatTs(a.lastHeartbeat)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {anomalyCount > 0 ? (
        <p className="text-sm text-amber">
          <span className="font-mono">{anomalyCount}</span> anomalous reading
          {anomalyCount === 1 ? "" : "s"} in the last 24 hours (marked on chart).
        </p>
      ) : null}

      <section>
        <h2 className="font-display text-xl text-ink">24-hour readings</h2>
        <div className="title-rule mt-2" />
        <div className="mt-4">
          <TwentyFourHourChart points={points} />
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h2 className="font-display text-xl text-ink">Devices</h2>
            <div className="title-rule mt-2" />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => void refresh()}
          >
            Refresh
          </Button>
        </div>

        {loadError ? (
          <p className="mt-3 text-sm text-rust" role="status">
            {loadError}
          </p>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-rule-strong text-ink-muted">
                <th className="py-2 pr-3 font-medium">Name</th>
                <th className="py-2 pr-3 font-medium">Device ID</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Heartbeat</th>
                <th className="py-2 pr-3 font-medium">Key</th>
                {canManage ? <th className="py-2 font-medium">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="py-6 text-ink-muted">
                    No devices registered.
                  </td>
                </tr>
              ) : (
                devices.map((d) => (
                  <tr key={d.id} className="border-b border-rule">
                    <td className="py-3 pr-3 text-ink">{d.deviceName}</td>
                    <td className="py-3 pr-3 font-mono text-xs text-ink">{d.deviceId}</td>
                    <td className="py-3 pr-3">
                      <span
                        className={cn(
                          "font-mono text-xs uppercase tracking-wide",
                          d.status === "online" && "text-signal",
                          d.status === "offline" && "text-rust",
                          (d.status === "error" || d.status === "maintenance") &&
                            "text-amber",
                        )}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="py-3 pr-3 font-mono text-xs text-ink-muted">
                      {formatTs(d.lastHeartbeat)}
                    </td>
                    <td className="py-3 pr-3 font-mono text-xs text-ink-muted">
                      {d.apiKeyPrefix ? `${d.apiKeyPrefix}…` : "—"}
                    </td>
                    {canManage ? (
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() => rotateKey(d.id)}
                          >
                            Rotate key
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() => deleteDevice(d.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {canManage ? (
        <section>
          <h2 className="font-display text-xl text-ink">Register device</h2>
          <div className="title-rule mt-2" />
          <p className="mt-3 max-w-xl text-sm text-ink-muted">
            Creates a device API key for REST ingest. Default mapping: energy/electricity
            → Scope 2 (electricity_kwh), gas/fuel → Scope 1.
          </p>
          <div className="mt-4 grid max-w-xl gap-3">
            <label className="block text-sm text-ink">
              Name
              <input
                className="mt-1 w-full rounded-[4px] border border-rule bg-surface-1 px-3 py-2 text-sm text-ink"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={pending}
              />
            </label>
            <label className="block text-sm text-ink">
              Device ID
              <input
                className="mt-1 w-full rounded-[4px] border border-rule bg-surface-1 px-3 py-2 font-mono text-sm text-ink"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                disabled={pending}
              />
            </label>
            <label className="block text-sm text-ink">
              Type
              <select
                className="mt-1 w-full rounded-[4px] border border-rule bg-surface-1 px-3 py-2 text-sm text-ink"
                value={deviceType}
                onChange={(e) => setDeviceType(e.target.value)}
                disabled={pending}
              >
                <option value="http">HTTP / REST (native)</option>
                <option value="mqtt">MQTT (native)</option>
                <option value="smart_meter">Smart meter (via HTTP)</option>
                <option value="utility_energy">Utility energy (not live)</option>
                <option value="utility_gas">Utility gas (not live)</option>
                <option value="utility_water">Utility water (not live)</option>
                <option value="modbus">Modbus (edge gateway push)</option>
                <option value="opc_ua">OPC-UA (edge gateway push)</option>
              </select>
            </label>
            <p className="text-xs text-ink-muted" role="note">
              {protocolSupportLabel(deviceType)}
              {(() => {
                const mode = protocolIngestMode(deviceType);
                if (mode.mode === "native") {
                  return " — push JSON to /api/app/iot/ingest with the device API key.";
                }
                if (mode.mode === "gateway_push") {
                  return ` — ${mode.reason}`;
                }
                return ` — ${mode.reason}`;
              })()}
            </p>
            <Button
              type="button"
              size="sm"
              disabled={pending || !name.trim() || !deviceId.trim()}
              onClick={registerDevice}
            >
              Register
            </Button>
          </div>
        </section>
      ) : null}

      {revealedKey ? (
        <div
          role="status"
          className="max-w-xl border border-rule-strong bg-surface-2 px-4 py-3"
        >
          <p className="text-sm text-ink">Device API key (shown once)</p>
          <p className="mt-2 break-all font-mono text-xs text-ink">{revealedKey}</p>
          <p className="mt-2 text-xs text-ink-muted">
            Header: <span className="font-mono">X-Device-Api-Key</span> or{" "}
            <span className="font-mono">Authorization: Bearer</span>
          </p>
        </div>
      ) : null}

      {statusMsg ? (
        <p className="text-sm text-ink-muted" role="status">
          {statusMsg}
        </p>
      ) : null}
    </div>
  );
}
