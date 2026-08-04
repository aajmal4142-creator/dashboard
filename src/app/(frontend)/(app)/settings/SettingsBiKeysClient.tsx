"use client";

import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { AppField } from "@/components/ui/AppField";
import { cn } from "@/lib/utils";

type BiKeyRow = {
  id: string;
  name: string;
  apiKeyPrefix: string | null;
  status: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  quotaLimitPerHour: number | null;
  quotaLimitPerDay: number | null;
  callsThisHour: number;
  callsToday: number;
  remainingHour: number | null;
  remainingDay: number | null;
  percentHour: number;
  percentDay: number;
  quotaResetAt: string | null;
  allowedIps: string[] | null;
  createdAt: string;
  updatedAt: string;
};

type QuotaSummary = {
  plan: string;
  perHour: number | null;
  perDay: number | null;
  unlimited: boolean;
};

type Props = {
  canEdit: boolean;
};

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatLimit(n: number | null): string {
  return n == null ? "unlimited" : String(n);
}

function QuotaBar({
  label,
  used,
  limit,
  percent,
}: {
  label: string;
  used: number;
  limit: number | null;
  percent: number;
}) {
  if (limit == null) {
    return (
      <p className="text-xs text-ink-muted">
        {label}: <span className="font-mono tabular-nums text-ink">{used}</span>{" "}
        (unlimited)
      </p>
    );
  }
  const tone = percent >= 100 ? "bg-rust" : percent >= 80 ? "bg-amber" : "bg-accent";
  return (
    <div className="mt-1">
      <div className="flex justify-between gap-2 text-xs text-ink-muted">
        <span>{label}</span>
        <span className="font-mono tabular-nums text-ink">
          {used}/{limit} ({percent}%)
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-[2px] bg-surface-2">
        <div
          className={cn("h-full transition-[width] duration-300", tone)}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
    </div>
  );
}

export function SettingsBiKeysClient({ canEdit }: Props) {
  const [keys, setKeys] = useState<BiKeyRow[]>([]);
  const [quota, setQuota] = useState<QuotaSummary | null>(null);
  const [name, setName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"ok" | "error" | "neutral">("neutral");
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  function loadKeys() {
    setLoading(true);
    startTransition(async () => {
      try {
        const res = await fetch("/api/app/settings/bi-keys");
        const data = (await res.json()) as {
          keys?: BiKeyRow[];
          quota?: QuotaSummary;
          error?: string;
        };
        if (!res.ok) {
          setStatus(data.error ?? "Could not load BI API keys.");
          setStatusTone("error");
          setLoading(false);
          return;
        }
        setKeys(data.keys ?? []);
        setQuota(data.quota ?? null);
        setLoading(false);
      } catch {
        setStatus("Network error while loading BI API keys.");
        setStatusTone("error");
        setLoading(false);
      }
    });
  }

  useEffect(() => {
    const id = window.setTimeout(() => {
      loadKeys();
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  function createKey() {
    if (!canEdit) {
      setStatus("Only owners and admins can create BI API keys.");
      setStatusTone("error");
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      setStatus("Enter a label for the key.");
      setStatusTone("error");
      return;
    }
    setStatus("Creating…");
    setStatusTone("neutral");
    setRevealedKey(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/app/settings/bi-keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        });
        const data = (await res.json()) as {
          error?: string;
          apiKey?: string;
          note?: string;
          key?: BiKeyRow;
        };
        if (!res.ok) {
          setStatus(data.error ?? "Could not create BI API key.");
          setStatusTone("error");
          return;
        }
        setName("");
        setRevealedKey(data.apiKey ?? null);
        setStatus(data.note ?? "Key created. Copy it now — it will not be shown again.");
        setStatusTone("ok");
        if (data.key) {
          setKeys((prev) => [data.key!, ...prev]);
        } else {
          loadKeys();
        }
      } catch {
        setStatus("Network error while creating BI API key.");
        setStatusTone("error");
      }
    });
  }

  function revokeKey(id: string) {
    if (!canEdit) {
      setStatus("Only owners and admins can revoke BI API keys.");
      setStatusTone("error");
      return;
    }
    setStatus("Revoking…");
    setStatusTone("neutral");
    startTransition(async () => {
      try {
        const res = await fetch(`/api/app/settings/bi-keys/${id}`, {
          method: "DELETE",
        });
        const data = (await res.json()) as { error?: string; note?: string };
        if (!res.ok) {
          setStatus(data.error ?? "Could not revoke BI API key.");
          setStatusTone("error");
          return;
        }
        setKeys((prev) =>
          prev.map((k) =>
            k.id === id
              ? { ...k, status: "revoked", revokedAt: new Date().toISOString() }
              : k,
          ),
        );
        setStatus(data.note ?? "Key revoked.");
        setStatusTone("ok");
      } catch {
        setStatus("Network error while revoking BI API key.");
        setStatusTone("error");
      }
    });
  }

  return (
    <section className="mt-10 border-t border-rule pt-8">
      <div className="max-w-2xl">
        <h2 className="font-display text-xl text-ink">BI connectors</h2>
        <div className="title-rule mt-2" />
        <p className="mt-3 text-sm text-ink-muted">
          Read-only API keys for Power BI and Tableau. Keys authenticate{" "}
          <span className="font-mono text-xs">/api/app/bi/*</span> endpoints. Full keys
          are shown once at creation; audit logs store the prefix only. See{" "}
          <a
            href="/developers"
            className="text-accent underline-offset-2 hover:underline"
          >
            Developers → BI
          </a>{" "}
          and repo files <span className="font-mono text-xs">docs/bi/POWER_BI.md</span>,{" "}
          <span className="font-mono text-xs">docs/bi/TABLEAU.md</span>.
        </p>
        <ul className="mt-3 list-inside list-disc text-[12px] text-ink-muted">
          <li>
            Power BI Desktop: Get Data → Web → add{" "}
            <span className="font-mono">Authorization: Bearer bi_…</span> header.
          </li>
          <li>
            Tableau: Web Data Connector or Scripts with the same Bearer header on{" "}
            <span className="font-mono">/api/app/bi/emissions</span>.
          </li>
          <li>Rate limit 120 req/min/key. Mutations are rejected on BI keys.</li>
        </ul>

        {quota ? (
          <div className="mt-5 border-y border-rule py-3">
            <p className="text-sm text-ink">Plan quota ({quota.plan})</p>
            <p className="mt-1 font-mono text-xs text-ink-muted tabular-nums">
              {quota.unlimited
                ? "Unlimited hour and day calls on consultant."
                : `${formatLimit(quota.perHour)} / hour · ${formatLimit(quota.perDay)} / day`}
            </p>
            <p className="mt-2 text-xs text-ink-muted">
              Approaching 80% sends an in-app alert to org members. Responses include
              X-RateLimit-* and X-Quota-*-Day headers.
            </p>
          </div>
        ) : null}

        {canEdit ? (
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <AppField
                label="Key label"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Power BI production"
                disabled={pending}
              />
            </div>
            <Button type="button" size="sm" disabled={pending} onClick={createKey}>
              Create key
            </Button>
          </div>
        ) : (
          <p className="mt-5 text-sm text-ink-muted">View only</p>
        )}

        {revealedKey ? (
          <div className="mt-4 border border-rule bg-surface-1 p-4">
            <p className="text-sm text-ink">New API key (copy now)</p>
            <p className="mt-2 break-all font-mono text-xs text-ink tabular-nums">
              {revealedKey}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => {
                void navigator.clipboard.writeText(revealedKey);
                setStatus("Copied to clipboard.");
                setStatusTone("ok");
              }}
            >
              Copy key
            </Button>
          </div>
        ) : null}

        <div className="mt-6">
          {loading ? (
            <p className="text-sm text-ink-muted">Loading keys…</p>
          ) : keys.length === 0 ? (
            <p className="text-sm text-ink-muted">No BI API keys yet.</p>
          ) : (
            <ul className="divide-y divide-rule border-y border-rule">
              {keys.map((k) => (
                <li
                  key={k.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">{k.name}</p>
                    <p className="mt-1 font-mono text-xs text-ink-muted tabular-nums">
                      {k.apiKeyPrefix ?? "—"}… · {k.status}
                      {k.lastUsedAt ? ` · last used ${formatWhen(k.lastUsedAt)}` : ""}
                    </p>
                    {k.status === "active" ? (
                      <div className="mt-2 max-w-sm">
                        <QuotaBar
                          label="Hour"
                          used={k.callsThisHour}
                          limit={k.quotaLimitPerHour}
                          percent={k.percentHour}
                        />
                        <QuotaBar
                          label="Day"
                          used={k.callsToday}
                          limit={k.quotaLimitPerDay}
                          percent={k.percentDay}
                        />
                        {k.allowedIps && k.allowedIps.length > 0 ? (
                          <p className="mt-2 font-mono text-xs text-ink-muted tabular-nums">
                            IP allowlist: {k.allowedIps.join(", ")}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  {canEdit && k.status === "active" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => revokeKey(k.id)}
                    >
                      Revoke
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {status ? (
          <p
            role="status"
            className={cn(
              "mt-4 text-sm",
              statusTone === "error" && "text-rust",
              statusTone === "ok" && "text-signal",
              statusTone === "neutral" && "text-ink-muted",
            )}
          >
            {status}
          </p>
        ) : null}
      </div>
    </section>
  );
}
