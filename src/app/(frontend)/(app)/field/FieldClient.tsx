"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";

import {
  EmptyState,
  PageCard,
  PageFrame,
  StatusLine,
} from "@/components/shell/PageFrame";
import {
  enqueueFieldItem,
  listFieldQueue,
  registerFieldServiceWorker,
  removeFieldItem,
  type FieldQueueItem,
} from "@/lib/field/offlineQueue";

export function FieldClient() {
  const [queue, setQueue] = useState<FieldQueueItem[]>([]);
  const [metricKey, setMetricKey] = useState("electricity_kwh");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("kWh");
  const [note, setNote] = useState("");
  const [meterId, setMeterId] = useState("");
  const [evidenceDataUrl, setEvidenceDataUrl] = useState<string | null>(null);
  const [evidenceFileName, setEvidenceFileName] = useState<string | null>(null);
  const [online, setOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setQueue(await listFieldQueue());
    } catch {
      setErr("Could not read offline queue.");
    }
  }, []);

  useEffect(() => {
    registerFieldServiceWorker();
    const id = window.setTimeout(() => {
      void refresh();
    }, 0);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [refresh]);

  async function onEvidence(file: File | null) {
    if (!file) {
      setEvidenceDataUrl(null);
      setEvidenceFileName(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setEvidenceDataUrl(typeof reader.result === "string" ? reader.result : null);
      setEvidenceFileName(file.name);
    };
    reader.readAsDataURL(file);
  }

  async function saveLocal(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    const n = Number(value);
    if (!metricKey.trim() || !Number.isFinite(n)) {
      setErr("Metric key and numeric value are required.");
      return;
    }
    await enqueueFieldItem({
      metricKey: metricKey.trim(),
      value: n,
      unit: unit.trim() || "unit",
      quality: "measured",
      note: note.trim() || undefined,
      meterId: meterId.trim() || undefined,
      evidenceDataUrl: evidenceDataUrl ?? undefined,
      evidenceFileName: evidenceFileName ?? undefined,
    });
    setValue("");
    setNote("");
    setEvidenceDataUrl(null);
    setEvidenceFileName(null);
    setMsg("Saved to offline queue.");
    await refresh();
  }

  async function syncAll() {
    if (!navigator.onLine) {
      setErr("You are offline. Sync when connectivity returns.");
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const items = await listFieldQueue();
      let synced = 0;
      for (const item of items) {
        const res = await fetch("/api/app/data/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            datapoints: [
              {
                metricKey: item.metricKey,
                value: item.value,
                unit: item.unit,
                quality: item.quality,
                note: item.note,
                externalId: item.meterId ? `meter:${item.meterId}` : undefined,
              },
            ],
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setErr(body.error ?? `Sync failed for ${item.metricKey}.`);
          break;
        }
        if (item.evidenceDataUrl && item.evidenceFileName) {
          try {
            const blob = await (await fetch(item.evidenceDataUrl)).blob();
            const form = new FormData();
            form.set("file", blob, item.evidenceFileName);
            form.set("filename", item.evidenceFileName);
            form.set("metricKey", item.metricKey);
            form.set("whyNote", item.note ?? "Field capture");
            await fetch("/api/evidence", { method: "POST", body: form });
          } catch {
            /* evidence optional — datapoint already ingested */
          }
        }
        await removeFieldItem(item.id);
        synced += 1;
      }
      setMsg(
        synced === items.length
          ? `Synced ${synced} queued reading(s).`
          : `Synced ${synced} of ${items.length}. Fix errors and retry.`,
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageFrame
      eyebrow="Field"
      title="Meters & evidence"
      help="Mobile field shell for measured readings. Queue works offline (IndexedDB); sync posts to ingest when online. Install as a PWA from the browser for a home-screen app."
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || queue.length === 0}
            onClick={() => void syncAll()}
            className="inline-flex h-8 items-center rounded-[4px] bg-accent px-3 text-[12px] text-canvas hover:bg-accent-hover disabled:opacity-50"
          >
            {busy ? "Syncing…" : `Sync queue (${queue.length})`}
          </button>
          <Link
            href="/data"
            className="inline-flex h-8 items-center rounded-[4px] border border-rule bg-surface-1 px-3 text-[12px] text-ink hover:border-rule-strong"
          >
            Full data workspace
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        <StatusLine tone={online ? "ok" : "error"}>
          {online
            ? "Online — sync available."
            : "Offline — readings save to the local queue."}
        </StatusLine>
        {msg ? <StatusLine tone="ok">{msg}</StatusLine> : null}
        {err ? <StatusLine tone="error">{err}</StatusLine> : null}

        <PageCard title="New reading">
          <form onSubmit={(e) => void saveLocal(e)} className="space-y-3">
            <label className="block text-[12px] text-ink-muted">
              Metric key
              <input
                className="mt-1 h-9 w-full rounded-[4px] border border-rule bg-surface-1 px-2 font-mono text-[13px] text-ink"
                value={metricKey}
                onChange={(e) => setMetricKey(e.target.value)}
                required
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-[12px] text-ink-muted">
                Value
                <input
                  type="number"
                  step="any"
                  className="mt-1 h-9 w-full rounded-[4px] border border-rule bg-surface-1 px-2 font-mono text-[13px] tabular-nums text-ink"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  required
                />
              </label>
              <label className="block text-[12px] text-ink-muted">
                Unit
                <input
                  className="mt-1 h-9 w-full rounded-[4px] border border-rule bg-surface-1 px-2 font-mono text-[13px] text-ink"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                />
              </label>
            </div>
            <label className="block text-[12px] text-ink-muted">
              Meter id (optional)
              <input
                className="mt-1 h-9 w-full rounded-[4px] border border-rule bg-surface-1 px-2 font-mono text-[13px] text-ink"
                value={meterId}
                onChange={(e) => setMeterId(e.target.value)}
                placeholder="facility meter id"
              />
            </label>
            <label className="block text-[12px] text-ink-muted">
              Note
              <input
                className="mt-1 h-9 w-full rounded-[4px] border border-rule bg-surface-1 px-2 text-[13px] text-ink"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <label className="block text-[12px] text-ink-muted">
              Evidence photo (optional)
              <input
                type="file"
                accept="image/*,application/pdf"
                capture="environment"
                className="mt-1 block w-full text-[12px]"
                onChange={(e) => void onEvidence(e.target.files?.[0] ?? null)}
              />
            </label>
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-[4px] border border-rule bg-surface-1 px-4 text-[13px] text-ink hover:border-rule-strong"
            >
              Save to queue
            </button>
          </form>
        </PageCard>

        <PageCard title="Offline queue">
          {queue.length === 0 ? (
            <EmptyState
              title="Queue empty"
              body="Capture a meter reading above. Items stay on this device until you sync."
            />
          ) : (
            <ul className="divide-y divide-rule">
              {queue.map((q) => (
                <li
                  key={q.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-[13px]"
                >
                  <div>
                    <p className="font-mono text-ink">
                      {q.metricKey}{" "}
                      <span className="tabular-nums">
                        {q.value} {q.unit}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-muted">
                      {q.createdAt.slice(0, 19).replace("T", " ")}
                      {q.meterId ? ` · meter ${q.meterId}` : ""}
                      {q.evidenceFileName ? ` · ${q.evidenceFileName}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-[12px] text-rust underline-offset-2 hover:underline"
                    onClick={() => void removeFieldItem(q.id).then(() => refresh())}
                  >
                    Discard
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PageCard>
      </div>
    </PageFrame>
  );
}
