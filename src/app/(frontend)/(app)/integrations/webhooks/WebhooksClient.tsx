"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { listWebhookTemplates } from "@/lib/integrations/webhookTemplates";
import { cn } from "@/lib/utils";

type WebhookRow = {
  webhook_id: string;
  endpoint_url: string;
  events: string[];
  status: string;
  last_triggered_at: string | null;
  retry_count: number;
  retry_policy: {
    maxRetries: number;
    retryDelayMs: number;
    exponentialBackoff: boolean;
  } | null;
  createdAt: string;
};

type DeliveryRow = {
  id: string;
  webhook_id: string;
  event_type: string;
  status: "success" | "failed" | "retrying";
  response_code: number | null;
  error_message: string | null;
  attempt_number: number;
  next_retry_at: string | null;
  duration_ms: number | null;
  createdAt: string;
  is_dead_letter: boolean;
};

type StatusFilter = "all" | "failed" | "retrying" | "success";

type Flash = { type: "success" | "error"; text: string };

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function statusClass(status: string): string {
  if (status === "success" || status === "active") return "text-signal";
  if (status === "failed") return "text-rust";
  if (status === "retrying" || status === "inactive") return "text-amber";
  return "text-ink-muted";
}

export function WebhooksClient(props: { canManage: boolean }) {
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("failed");
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [pending, startTransition] = useTransition();
  const [endpointUrl, setEndpointUrl] = useState("");
  const [events, setEvents] = useState({
    created: true,
    updated: false,
    report: false,
  });
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFlash(null);
    try {
      const statusParam = filter === "all" ? "" : `&status=${filter}`;
      const deadLetter = filter === "failed" ? "&dead_letter=1" : "";
      const [wRes, dRes] = await Promise.all([
        fetch("/api/app/webhooks"),
        fetch(`/api/app/webhooks/deliveries?limit=50${statusParam}${deadLetter}`),
      ]);
      const wData = (await wRes.json()) as {
        webhooks?: WebhookRow[];
        error?: string;
      };
      const dData = (await dRes.json()) as {
        deliveries?: DeliveryRow[];
        error?: string;
      };

      if (!wRes.ok) {
        setFlash({
          type: "error",
          text: wData.error || "Failed to load webhook registrations.",
        });
      } else {
        setWebhooks(wData.webhooks ?? []);
      }

      if (!dRes.ok) {
        setFlash({
          type: "error",
          text: dData.error || "Failed to load delivery log.",
        });
      } else {
        setDeliveries(dData.deliveries ?? []);
      }
    } catch {
      setFlash({ type: "error", text: "Failed to load webhook data." });
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function register() {
    if (!props.canManage) return;
    startTransition(async () => {
      setFlash(null);
      setNewSecret(null);
      const selected: string[] = [];
      if (events.created) selected.push("datapoint.created");
      if (events.updated) selected.push("datapoint.updated");
      if (events.report) selected.push("report.generated");
      if (!endpointUrl.trim() || selected.length === 0) {
        setFlash({
          type: "error",
          text: "Provide an endpoint URL and at least one event.",
        });
        return;
      }
      try {
        const res = await fetch("/api/app/webhooks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint_url: endpointUrl.trim(),
            events: selected,
            retry_policy: {
              maxRetries: 3,
              retryDelayMs: 1000,
              exponentialBackoff: true,
            },
          }),
        });
        const data = (await res.json()) as {
          secret?: string;
          error?: string;
        };
        if (!res.ok) {
          setFlash({
            type: "error",
            text: data.error || "Registration failed.",
          });
          return;
        }
        setNewSecret(data.secret ?? null);
        setEndpointUrl("");
        setFlash({ type: "success", text: "Webhook registered." });
        await load();
      } catch {
        setFlash({ type: "error", text: "Registration failed." });
      }
    });
  }

  function removeWebhook(webhookId: string) {
    if (!props.canManage) return;
    startTransition(async () => {
      setFlash(null);
      try {
        const res = await fetch(`/api/app/webhooks/${webhookId}`, {
          method: "DELETE",
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setFlash({ type: "error", text: data.error || "Delete failed." });
          return;
        }
        setFlash({ type: "success", text: "Webhook deleted." });
        await load();
      } catch {
        setFlash({ type: "error", text: "Delete failed." });
      }
    });
  }

  function testWebhook(webhookId: string) {
    if (!props.canManage) return;
    startTransition(async () => {
      setFlash(null);
      try {
        const res = await fetch(`/api/app/webhooks/${webhookId}/test`, {
          method: "POST",
        });
        const data = (await res.json()) as {
          success?: boolean;
          attempts?: number;
          error?: string;
        };
        if (!res.ok) {
          setFlash({ type: "error", text: data.error || "Test delivery failed." });
          return;
        }
        setFlash({
          type: data.success ? "success" : "error",
          text: data.success
            ? `Test delivered in ${data.attempts ?? 1} attempt(s).`
            : `Test failed after ${data.attempts ?? 1} attempt(s).`,
        });
        await load();
      } catch {
        setFlash({ type: "error", text: "Test delivery failed." });
      }
    });
  }

  function replay(logId: string) {
    if (!props.canManage) return;
    startTransition(async () => {
      setFlash(null);
      try {
        const res = await fetch(`/api/app/webhooks/deliveries/${logId}/replay`, {
          method: "POST",
        });
        const data = (await res.json()) as {
          success?: boolean;
          attempts?: number;
          error?: string;
        };
        if (!res.ok) {
          setFlash({ type: "error", text: data.error || "Replay failed." });
          return;
        }
        setFlash({
          type: data.success ? "success" : "error",
          text: data.success
            ? `Replay succeeded in ${data.attempts ?? 1} attempt(s).`
            : `Replay failed after ${data.attempts ?? 1} attempt(s).`,
        });
        await load();
      } catch {
        setFlash({ type: "error", text: "Replay failed." });
      }
    });
  }

  if (loading && webhooks.length === 0 && deliveries.length === 0) {
    return <p className="text-sm text-ink-muted">Loading webhooks…</p>;
  }

  return (
    <div className="space-y-10">
      <p className="text-sm">
        <Link href="/integrations" className="text-accent hover:text-accent-hover">
          ← Integrations
        </Link>
      </p>

      {flash ? (
        <p
          className={cn(
            "rounded-[4px] border border-rule px-3 py-2 text-sm",
            flash.type === "success" ? "text-signal" : "text-rust",
          )}
          role="status"
        >
          {flash.text}
        </p>
      ) : null}

      {newSecret ? (
        <div className="rounded-[6px] border border-rule bg-surface-1 p-4">
          <p className="text-sm font-semibold text-ink">Signing secret (copy now)</p>
          <p className="mt-2 break-all font-data text-sm text-ink">{newSecret}</p>
          <p className="mt-2 text-xs text-ink-muted">
            Shown once. Store it to verify X-Webhook-Signature on your endpoint.
          </p>
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Zapier &amp; Make recipes</h2>
        <p className="text-sm text-ink-muted">
          Published starter recipes. Full steps:{" "}
          <span className="font-data text-ink">docs/integrations/ZAPIER.md</span> and{" "}
          <span className="font-data text-ink">docs/integrations/MAKE.md</span>.
        </p>
        <ul className="divide-y divide-rule border-t border-rule">
          {listWebhookTemplates().map((t) => (
            <li
              key={t.name}
              className="flex flex-wrap items-baseline justify-between gap-2 py-3"
            >
              <div>
                <p className="text-sm text-ink">{t.name}</p>
                <p className="mt-0.5 text-xs text-ink-muted">{t.description}</p>
              </div>
              <p className="font-data text-[11px] text-ink-muted">
                {t.provider} · {t.events.join(", ")}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {!props.canManage ? (
        <p className="text-sm text-ink-muted">
          Admin access is required to register, test, or replay webhooks.
        </p>
      ) : (
        <section className="rounded-[6px] border border-rule bg-surface-1 p-5">
          <h2 className="text-lg font-semibold text-ink">Register endpoint</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Default retry: 3 retries, 1s initial delay, exponential backoff.
          </p>
          <div className="mt-4 space-y-3">
            <label className="block text-sm text-ink">
              Endpoint URL
              <input
                type="url"
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
                placeholder="https://example.com/hooks/clearesg"
                className="mt-1 w-full rounded-[4px] border border-rule bg-canvas px-3 py-2 text-sm text-ink"
              />
            </label>
            <fieldset className="flex flex-wrap gap-4 text-sm text-ink">
              <legend className="sr-only">Events</legend>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={events.created}
                  onChange={(e) =>
                    setEvents((s) => ({ ...s, created: e.target.checked }))
                  }
                />
                datapoint.created
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={events.updated}
                  onChange={(e) =>
                    setEvents((s) => ({ ...s, updated: e.target.checked }))
                  }
                />
                datapoint.updated
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={events.report}
                  onChange={(e) => setEvents((s) => ({ ...s, report: e.target.checked }))}
                />
                report.generated
              </label>
            </fieldset>
            <Button type="button" disabled={pending} onClick={register}>
              Register
            </Button>
          </div>
        </section>
      )}

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rule pb-3">
          <h2 className="text-lg font-semibold text-ink">Registrations</h2>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => void load()}
          >
            Refresh
          </Button>
        </div>
        {webhooks.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">No webhooks registered yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-rule">
            {webhooks.map((w) => (
              <li
                key={w.webhook_id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="break-all font-data text-sm text-ink">{w.endpoint_url}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    <span className={statusClass(w.status)}>{w.status}</span>
                    {" · "}
                    {w.events.join(", ")}
                    {" · "}
                    last{" "}
                    <span className="font-data">{formatWhen(w.last_triggered_at)}</span>
                  </p>
                  {w.retry_policy ? (
                    <p className="mt-1 font-data text-xs text-ink-muted">
                      retries {w.retry_policy.maxRetries} · delay{" "}
                      {w.retry_policy.retryDelayMs}ms
                      {w.retry_policy.exponentialBackoff ? " · expo" : ""}
                    </p>
                  ) : null}
                </div>
                {props.canManage ? (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => testWebhook(w.webhook_id)}
                    >
                      Test
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => removeWebhook(w.webhook_id)}
                    >
                      Delete
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rule pb-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Delivery log</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Failed rows are the dead-letter queue. Replay re-sends the stored payload
              with the same retry policy.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["failed", "Dead letter"],
                ["retrying", "Retrying"],
                ["success", "Success"],
                ["all", "All"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={cn(
                  "rounded-[2px] border px-2 py-1 text-xs font-medium",
                  filter === value
                    ? "border-accent bg-accent-quiet text-ink"
                    : "border-rule bg-surface-1 text-ink-muted hover:border-rule-strong",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {deliveries.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">
            {filter === "failed"
              ? "No dead-letter deliveries."
              : "No deliveries for this filter."}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-rule text-xs uppercase tracking-wide text-ink-muted">
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">Event</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Attempt</th>
                  <th className="py-2 pr-3 font-medium">Detail</th>
                  <th className="py-2 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d) => (
                  <tr key={d.id} className="border-b border-rule align-top">
                    <td className="py-3 pr-3 font-data text-xs text-ink">
                      {formatWhen(d.createdAt)}
                    </td>
                    <td className="py-3 pr-3">
                      <p className="text-ink">{d.event_type}</p>
                      <p className="font-data text-xs text-ink-muted">{d.webhook_id}</p>
                    </td>
                    <td className={cn("py-3 pr-3", statusClass(d.status))}>
                      {d.is_dead_letter ? "dead letter" : d.status}
                      {d.response_code != null ? (
                        <span className="ml-1 font-data text-ink-muted">
                          {d.response_code}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3 font-data text-ink">{d.attempt_number}</td>
                    <td className="max-w-[240px] py-3 pr-3 text-xs text-ink-muted">
                      {d.error_message ||
                        (d.duration_ms != null ? `${d.duration_ms} ms` : "—")}
                      {d.next_retry_at ? (
                        <p className="mt-1 font-data">
                          next {formatWhen(d.next_retry_at)}
                        </p>
                      ) : null}
                    </td>
                    <td className="py-3">
                      {props.canManage && d.is_dead_letter ? (
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={pending}
                          onClick={() => replay(d.id)}
                        >
                          Replay
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
