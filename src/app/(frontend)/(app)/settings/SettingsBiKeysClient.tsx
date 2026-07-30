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
  createdAt: string;
  updatedAt: string;
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

export function SettingsBiKeysClient({ canEdit }: Props) {
  const [keys, setKeys] = useState<BiKeyRow[]>([]);
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
          error?: string;
        };
        if (!res.ok) {
          setStatus(data.error ?? "Could not load BI API keys.");
          setStatusTone("error");
          setLoading(false);
          return;
        }
        setKeys(data.keys ?? []);
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
          <span className="font-mono text-xs">docs/bi/</span> for setup.
        </p>

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
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm text-ink">{k.name}</p>
                    <p className="mt-1 font-mono text-xs text-ink-muted tabular-nums">
                      {k.apiKeyPrefix ?? "—"}… · {k.status}
                      {k.lastUsedAt ? ` · last used ${formatWhen(k.lastUsedAt)}` : ""}
                    </p>
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
