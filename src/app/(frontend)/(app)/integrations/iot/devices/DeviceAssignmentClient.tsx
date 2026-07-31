"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

type DeviceRow = {
  id: string;
  deviceName: string;
  deviceId: string;
  deviceType: string;
  gatewayId: string | null;
  status: string;
  lastHeartbeat: string | null;
};

type GatewayOption = {
  id: string;
  name: string;
  gatewayType: string;
  status: string;
};

export function DeviceAssignmentClient({ canManage }: { canManage: boolean }) {
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [gateways, setGateways] = useState<GatewayOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [csv, setCsv] = useState("device_id,gateway_id\n");
  const [pending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const [devRes, gwRes] = await Promise.all([
        fetch("/api/app/iot/devices"),
        fetch("/api/app/iot/gateways"),
      ]);
      const devData = (await devRes.json()) as {
        error?: string;
        devices?: DeviceRow[];
      };
      const gwData = (await gwRes.json()) as {
        error?: string;
        gateways?: GatewayOption[];
      };
      if (!devRes.ok) {
        setLoadError(devData.error ?? "Could not load devices.");
        return;
      }
      if (!gwRes.ok) {
        setLoadError(gwData.error ?? "Could not load gateways.");
        return;
      }
      const list = devData.devices ?? [];
      setDevices(list);
      setGateways(gwData.gateways ?? []);
      const next: Record<string, string> = {};
      for (const d of list) {
        next[d.id] = d.gatewayId ?? "";
      }
      setDrafts(next);
    } catch {
      setLoadError("Network error loading assignment data.");
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(id);
  }, [refresh]);

  function gatewayLabel(id: string | null): string {
    if (!id) return "Unassigned";
    const g = gateways.find((x) => x.id === id);
    return g ? `${g.name} (${g.gatewayType})` : id;
  }

  function saveOne(deviceDocId: string) {
    if (!canManage) return;
    startTransition(async () => {
      const gatewayId = drafts[deviceDocId] || null;
      const res = await fetch("/api/app/iot/devices/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: deviceDocId, gatewayId }),
      });
      const data = (await res.json()) as { error?: string; failed?: number };
      if (!res.ok || (data.failed && data.failed > 0)) {
        setStatusMsg(data.error ?? "Assignment failed.");
        return;
      }
      setStatusMsg("Device assigned.");
      await refresh();
    });
  }

  function importCsv() {
    if (!canManage) return;
    startTransition(async () => {
      const res = await fetch("/api/app/iot/devices/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const data = (await res.json()) as {
        error?: string;
        succeeded?: number;
        failed?: number;
        results?: Array<{ deviceId: string; ok: boolean; error?: string }>;
      };
      if (!res.ok) {
        setStatusMsg(data.error ?? "CSV import failed.");
        return;
      }
      const fails = (data.results ?? []).filter((r) => !r.ok);
      setStatusMsg(
        `Assigned ${data.succeeded ?? 0} device(s)` +
          (data.failed
            ? `; ${data.failed} failed${fails[0]?.error ? ` (${fails[0].error})` : ""}`
            : "") +
          ".",
      );
      await refresh();
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/integrations/iot/gateways"
          className="text-accent hover:text-accent-hover"
        >
          Gateways
        </Link>
        <span className="text-rule-strong">·</span>
        <Link href="/iot" className="text-accent hover:text-accent-hover">
          IoT dashboard
        </Link>
      </div>

      {loadError ? (
        <p className="text-sm text-rust" role="alert">
          {loadError}
        </p>
      ) : null}
      {statusMsg ? <p className="text-sm text-ink-muted">{statusMsg}</p> : null}

      <section>
        <h2 className="font-display text-xl text-ink">Devices</h2>
        <div className="title-rule mt-2" />
        {devices.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">
            No devices registered. Create meters on the{" "}
            <Link href="/iot" className="text-accent hover:text-accent-hover">
              IoT dashboard
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-4 space-y-0 divide-y divide-rule border-t border-b border-rule">
            {devices.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-sm text-ink">{d.deviceName}</p>
                  <p className="font-mono text-xs text-ink-muted">
                    {d.deviceId} · {d.deviceType} · currently {gatewayLabel(d.gatewayId)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="border border-rule bg-surface-1 px-2 py-1.5 text-sm text-ink"
                    value={drafts[d.id] ?? ""}
                    disabled={!canManage || pending}
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [d.id]: e.target.value }))
                    }
                  >
                    <option value="">Unassigned</option>
                    {gateways.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.gatewayType} · {g.status})
                      </option>
                    ))}
                  </select>
                  {canManage ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => saveOne(d.id)}
                    >
                      Save
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-xl text-ink">Bulk CSV</h2>
        <div className="title-rule mt-2" />
        <p className="mt-2 text-sm text-ink-muted">
          Use external <span className="font-mono">device_id</span> or Payload document id
          in the first column; gateway document id in the second.
        </p>
        <textarea
          className="mt-3 w-full border border-rule bg-surface-1 px-3 py-2 font-mono text-xs text-ink"
          rows={6}
          value={csv}
          disabled={!canManage || pending}
          onChange={(e) => setCsv(e.target.value)}
        />
        {canManage ? (
          <div className="mt-3">
            <Button type="button" disabled={pending || !csv.trim()} onClick={importCsv}>
              Import assignments
            </Button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">
            Only owners and admins can assign devices.
          </p>
        )}
      </section>
    </div>
  );
}
