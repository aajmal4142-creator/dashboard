"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type GatewayHealth = {
  badge: "online" | "offline" | "stale" | "error";
  message: string;
  offlineMs: number | null;
  shouldAlertOffline: boolean;
};

type FailoverHint = {
  gatewayId: string | null;
  gatewayName: string | null;
  note: string;
} | null;

type GatewayRow = {
  id: string;
  name: string;
  gatewayType: string;
  cloudProvider: string | null;
  endpoint: string | null;
  hasCredentials: boolean;
  status: GatewayHealth["badge"];
  lastHeartbeat: string | null;
  lastDataReceived: string | null;
  lastSyncAt: string | null;
  failoverNote: string | null;
  preferredFailoverGatewayId: string | null;
  deviceCount: number;
  health: GatewayHealth;
  failover: FailoverHint;
};

type OfflineAlert = {
  id: string;
  name: string;
  message: string;
  failover: FailoverHint;
};

const GATEWAY_TYPES: Array<{ value: string; label: string }> = [
  { value: "mqtt", label: "MQTT Broker" },
  { value: "http", label: "HTTP / REST" },
  { value: "webhook", label: "HTTP Webhook" },
  { value: "direct", label: "Direct API" },
  { value: "cloud", label: "Cloud Platform (free tier)" },
];

const CLOUD_PROVIDERS: Array<{ value: string; label: string }> = [
  { value: "aws_iot", label: "AWS IoT Core" },
  { value: "azure_iot", label: "Azure IoT Hub" },
  { value: "gcp_iot", label: "Google Cloud IoT" },
];

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

function badgeClass(badge: GatewayHealth["badge"]): string {
  if (badge === "online") return "text-signal";
  if (badge === "stale") return "text-amber";
  if (badge === "error") return "text-rust";
  return "text-rust";
}

export function GatewaysClient({ canManage }: { canManage: boolean }) {
  const [gateways, setGateways] = useState<GatewayRow[]>([]);
  const [alerts, setAlerts] = useState<OfflineAlert[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [devices, setDevices] = useState<
    Array<{
      id: string;
      deviceName: string;
      deviceId: string;
      deviceType: string;
      status: string | null;
      lastHeartbeat: string | null;
    }>
  >([]);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [gatewayType, setGatewayType] = useState("mqtt");
  const [cloudProvider, setCloudProvider] = useState("aws_iot");
  const [endpoint, setEndpoint] = useState("");
  const [credentialsJson, setCredentialsJson] = useState("");
  const [failoverNote, setFailoverNote] = useState("");
  const [preferredFailover, setPreferredFailover] = useState("");

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/app/iot/gateways");
      const data = (await res.json()) as {
        error?: string;
        gateways?: GatewayRow[];
        offlineAlerts?: OfflineAlert[];
      };
      if (!res.ok) {
        setLoadError(data.error ?? "Could not load gateways.");
        return;
      }
      setGateways(data.gateways ?? []);
      setAlerts(data.offlineAlerts ?? []);
    } catch {
      setLoadError("Network error loading gateways.");
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(id);
  }, [refresh]);

  function openRegister() {
    setName("");
    setGatewayType("mqtt");
    setCloudProvider("aws_iot");
    setEndpoint("");
    setCredentialsJson("");
    setFailoverNote("");
    setPreferredFailover("");
    setStatusMsg(null);
    setModalOpen(true);
  }

  function registerGateway() {
    if (!canManage) return;
    startTransition(async () => {
      let credentials: Record<string, unknown> | string | undefined;
      if (credentialsJson.trim()) {
        try {
          credentials = JSON.parse(credentialsJson) as Record<string, unknown>;
        } catch {
          credentials = credentialsJson.trim();
        }
      }
      const res = await fetch("/api/app/iot/gateways", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          gatewayType,
          cloudProvider: gatewayType === "cloud" ? cloudProvider : undefined,
          endpoint: endpoint || undefined,
          credentials,
          failoverNote: failoverNote || undefined,
          preferredFailoverGatewayId: preferredFailover || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string; note?: string };
      if (!res.ok) {
        setStatusMsg(data.error ?? "Could not register gateway.");
        return;
      }
      setModalOpen(false);
      setStatusMsg(data.note ?? "Gateway registered.");
      await refresh();
    });
  }

  function sendHeartbeat(id: string) {
    if (!canManage) return;
    startTransition(async () => {
      const res = await fetch(`/api/app/iot/gateways/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setStatusMsg(data.error ?? "Heartbeat failed.");
        return;
      }
      setStatusMsg("Heartbeat recorded.");
      await refresh();
      if (selectedId === id) void loadStatus(id);
    });
  }

  function deleteGateway(id: string) {
    if (!canManage) return;
    startTransition(async () => {
      const res = await fetch(`/api/app/iot/gateways/${id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setStatusMsg(data.error ?? "Could not delete gateway.");
        return;
      }
      if (selectedId === id) {
        setSelectedId(null);
        setDevices([]);
      }
      setStatusMsg("Gateway removed.");
      await refresh();
    });
  }

  async function loadStatus(id: string) {
    setSelectedId(id);
    const res = await fetch(`/api/app/iot/gateways/${id}/status`);
    const data = (await res.json()) as {
      error?: string;
      devices?: typeof devices;
      alert?: { message: string } | null;
    };
    if (!res.ok) {
      setStatusMsg(data.error ?? "Could not load gateway status.");
      return;
    }
    setDevices(data.devices ?? []);
    if (data.alert) setStatusMsg(data.alert.message);
  }

  return (
    <div className="space-y-8">
      {alerts.length > 0 ? (
        <div
          role="alert"
          className="border border-rule-strong bg-surface-2 px-4 py-3 text-sm text-ink"
        >
          <p className="font-medium text-rust">
            {alerts.length} gateway{alerts.length === 1 ? "" : "s"} offline &gt; 30 min
          </p>
          <ul className="mt-2 space-y-2 text-sm text-ink-muted">
            {alerts.map((a) => (
              <li key={a.id}>
                <span className="text-ink">{a.name}</span> — {a.message}
                {a.failover?.note ? (
                  <span className="mt-0.5 block text-xs">{a.failover.note}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {loadError ? (
        <p className="text-sm text-rust" role="alert">
          {loadError}
        </p>
      ) : null}
      {statusMsg ? <p className="text-sm text-ink-muted">{statusMsg}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/iot" className="text-accent hover:text-accent-hover">
            IoT dashboard
          </Link>
          <span className="text-rule-strong">·</span>
          <Link
            href="/integrations/iot/devices"
            className="text-accent hover:text-accent-hover"
          >
            Device assignment
          </Link>
        </div>
        {canManage ? (
          <Button type="button" onClick={openRegister} disabled={pending}>
            Register gateway
          </Button>
        ) : null}
      </div>

      {gateways.length === 0 && !loadError ? (
        <p className="text-sm text-ink-muted">
          No gateways yet. Register an MQTT, webhook, direct, or cloud (free-tier stub)
          hub.
        </p>
      ) : (
        <ul className="space-y-0 divide-y divide-rule border-t border-b border-rule">
          {gateways.map((g) => (
            <li key={g.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <button
                  type="button"
                  className="text-left"
                  onClick={() => void loadStatus(g.id)}
                >
                  <p className="font-display text-lg text-ink">{g.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-ink-muted">
                    {g.gatewayType}
                    {g.cloudProvider ? ` · ${g.cloudProvider}` : ""}
                    {g.hasCredentials ? " · credentials set" : ""}
                  </p>
                  <p className="mt-2 font-mono text-xs text-ink-muted">
                    <span className={cn("font-medium", badgeClass(g.status))}>
                      {g.status}
                    </span>
                    {" · "}
                    heartbeat {formatTs(g.lastHeartbeat)}
                    {" · "}
                    data {formatTs(g.lastDataReceived)}
                    {" · "}
                    <span className="font-mono">{g.deviceCount}</span> device
                    {g.deviceCount === 1 ? "" : "s"}
                  </p>
                  <p className="mt-1 max-w-xl text-xs text-ink-muted">
                    {g.health.message}
                  </p>
                  {g.failover?.note ? (
                    <p className="mt-1 max-w-xl text-xs text-amber">{g.failover.note}</p>
                  ) : null}
                </button>
                <div className="flex flex-wrap gap-2">
                  {canManage ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => sendHeartbeat(g.id)}
                      >
                        Heartbeat
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => deleteGateway(g.id)}
                      >
                        Remove
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {selectedId ? (
        <section>
          <h2 className="font-display text-xl text-ink">Connected devices</h2>
          <div className="title-rule mt-2" />
          {devices.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">
              No devices assigned. Use{" "}
              <Link
                href="/integrations/iot/devices"
                className="text-accent hover:text-accent-hover"
              >
                device assignment
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-3 space-y-2 font-mono text-xs text-ink-muted">
              {devices.map((d) => (
                <li key={d.id}>
                  {d.deviceName} ({d.deviceId}) — {d.deviceType} · {d.status ?? "—"} ·
                  last {formatTs(d.lastHeartbeat)}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--ink)_40%,transparent)] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="register-gateway-title"
        >
          <div className="w-full max-w-md border border-rule bg-canvas p-6 shadow-sm">
            <h2 id="register-gateway-title" className="font-display text-xl text-ink">
              Register gateway
            </h2>
            <div className="title-rule mt-2" />
            <div className="mt-4 space-y-3">
              <label className="block text-sm text-ink">
                Name
                <input
                  className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 text-sm text-ink"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Office MQTT"
                />
              </label>
              <label className="block text-sm text-ink">
                Type
                <select
                  className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 text-sm text-ink"
                  value={gatewayType}
                  onChange={(e) => setGatewayType(e.target.value)}
                >
                  {GATEWAY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              {gatewayType === "cloud" ? (
                <label className="block text-sm text-ink">
                  Cloud provider (free tier stub)
                  <select
                    className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 text-sm text-ink"
                    value={cloudProvider}
                    onChange={(e) => setCloudProvider(e.target.value)}
                  >
                    {CLOUD_PROVIDERS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="block text-sm text-ink">
                Endpoint
                <input
                  className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 font-mono text-sm text-ink"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="mqtts://broker.example:8883"
                />
              </label>
              <label className="block text-sm text-ink">
                Credentials (JSON or secret string — encrypted at rest)
                <textarea
                  className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 font-mono text-xs text-ink"
                  rows={3}
                  value={credentialsJson}
                  onChange={(e) => setCredentialsJson(e.target.value)}
                  placeholder='{"username":"…","password":"…"}'
                />
              </label>
              <label className="block text-sm text-ink">
                Preferred failover gateway
                <select
                  className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 text-sm text-ink"
                  value={preferredFailover}
                  onChange={(e) => setPreferredFailover(e.target.value)}
                >
                  <option value="">None</option>
                  {gateways.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.gatewayType})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-ink">
                Failover note
                <textarea
                  className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 text-sm text-ink"
                  rows={2}
                  value={failoverNote}
                  onChange={(e) => setFailoverNote(e.target.value)}
                  placeholder="If offline, route factory meters via Factory MQTT."
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={pending || !name.trim()}
                onClick={registerGateway}
              >
                Register
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
