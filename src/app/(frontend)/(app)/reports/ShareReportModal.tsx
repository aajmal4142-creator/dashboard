"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SHARE_TOKEN_TTL_DAYS,
  SHARE_TOKEN_TTL_MAX_DAYS,
  SHARE_TOKEN_TTL_MIN_DAYS,
  type EmbedTheme,
} from "@/lib/reports/htmlReport";

type EmbedTokenRow = {
  id: string;
  token: string;
  tokenPreview: string;
  shareUrl: string;
  embedUrl: string;
  expiresAt: string;
  createdAt: string;
  usageCount: number;
  lastAccessedAt: string | null;
  revokedAt: string | null;
  status: "active" | "expired" | "revoked";
  allowedOrigins: string[];
  theme: EmbedTheme;
};

type MintedShare = {
  token: string;
  shareUrl: string;
  embedUrl: string;
  embedCode: string;
  expiresAt: string;
  ttlDays: number;
  allowedOrigins: string[];
  theme: EmbedTheme;
};

const TTL_OPTIONS = [1, 3, 7, 14, 30] as const;
const THEME_OPTIONS: Array<{ value: EmbedTheme; label: string }> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "org", label: "Match organisation" },
];

function parseDomainsText(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ShareReportModal({
  open,
  onOpenChange,
  reportId,
  reportLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId: string;
  reportLabel: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [ttlDays, setTtlDays] = useState(SHARE_TOKEN_TTL_DAYS);
  const [domainsText, setDomainsText] = useState("");
  const [theme, setTheme] = useState<EmbedTheme>("light");
  const [minted, setMinted] = useState<MintedShare | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [tokens, setTokens] = useState<EmbedTokenRow[]>([]);

  const refreshTokens = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/app/reports/${reportId}/embed-token?includeInactive=1`,
      );
      const data = (await res.json().catch(() => ({}))) as {
        tokens?: EmbedTokenRow[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not load embed tokens");
        return;
      }
      setTokens(data.tokens ?? []);
    } catch {
      setError("Could not load embed tokens");
    }
  }, [reportId]);

  function resetModalState() {
    setError(null);
    setStatus(null);
    setMinted(null);
    setQrDataUrl(null);
    setTokens([]);
    setBusy(false);
    setTtlDays(SHARE_TOKEN_TTL_DAYS);
    setDomainsText("");
    setTheme("light");
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetModalState();
    onOpenChange(next);
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/app/reports/${reportId}/embed-token?includeInactive=1`,
        );
        const data = (await res.json().catch(() => ({}))) as {
          tokens?: EmbedTokenRow[];
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "Could not load embed tokens");
          return;
        }
        setTokens(data.tokens ?? []);
      } catch {
        if (!cancelled) setError("Could not load embed tokens");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, reportId]);

  useEffect(() => {
    if (!minted?.shareUrl) return;
    let cancelled = false;
    const styles = getComputedStyle(document.documentElement);
    const dark = styles.getPropertyValue("--ink").trim() || "currentColor";
    const light = styles.getPropertyValue("--canvas").trim() || "transparent";
    void QRCode.toDataURL(minted.shareUrl, {
      width: 168,
      margin: 1,
      color: { dark, light },
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [minted?.shareUrl]);

  async function generateToken() {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/app/reports/${reportId}/embed-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ttlDays,
          allowedOrigins: parseDomainsText(domainsText),
          theme,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as MintedShare & {
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not generate embed token");
        return;
      }
      setMinted({
        token: data.token,
        shareUrl: data.shareUrl,
        embedUrl: data.embedUrl,
        embedCode: data.embedCode,
        expiresAt: data.expiresAt,
        ttlDays: data.ttlDays,
        allowedOrigins: data.allowedOrigins ?? [],
        theme: data.theme ?? "light",
      });
      setStatus(`Token created. Expires ${formatWhen(data.expiresAt)}.`);
      await refreshTokens();
    } finally {
      setBusy(false);
    }
  }

  async function revokeToken(token: string) {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(
        `/api/app/reports/${reportId}/embed-token/${encodeURIComponent(token)}`,
        { method: "DELETE" },
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not revoke token");
        return;
      }
      if (minted?.token === token) {
        setMinted(null);
        setQrDataUrl(null);
      }
      setStatus("Token revoked.");
      await refreshTokens();
    } finally {
      setBusy(false);
    }
  }

  async function copyText(text: string, okMessage: string) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(okMessage);
    } catch {
      setError("Clipboard unavailable. Copy the text manually.");
    }
  }

  const activeTokens = tokens.filter((t) => t.status === "active");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl border-rule bg-surface-1 text-ink sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Share report</DialogTitle>
          <p className="text-sm text-ink-muted">{reportLabel}</p>
        </DialogHeader>

        {error ? <p className="text-sm text-rust">{error}</p> : null}
        {status ? <p className="text-sm text-signal">{status}</p> : null}

        <div className="flex flex-wrap items-end gap-3 border-b border-rule pb-3">
          <label className="text-xs text-ink-muted">
            Expiry (days)
            <select
              className="mt-1 block rounded-[4px] border border-rule bg-canvas px-2 py-1.5 text-ink"
              value={ttlDays}
              disabled={busy}
              onChange={(e) => setTtlDays(Number(e.target.value))}
            >
              {TTL_OPTIONS.filter(
                (d) => d >= SHARE_TOKEN_TTL_MIN_DAYS && d <= SHARE_TOKEN_TTL_MAX_DAYS,
              ).map((d) => (
                <option key={d} value={d}>
                  {d} day{d === 1 ? "" : "s"}
                  {d === SHARE_TOKEN_TTL_DAYS ? " (default)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-ink-muted">
            Theme
            <select
              className="mt-1 block rounded-[4px] border border-rule bg-canvas px-2 py-1.5 text-ink"
              value={theme}
              disabled={busy}
              onChange={(e) => setTheme(e.target.value as EmbedTheme)}
            >
              {THEME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[220px] flex-1 text-xs text-ink-muted">
            Allowed embed domains (one per line)
            <textarea
              rows={2}
              placeholder="https://example.com"
              className="mt-1 block w-full rounded-[4px] border border-rule bg-canvas px-2 py-1.5 font-data text-xs text-ink"
              value={domainsText}
              disabled={busy}
              onChange={(e) => setDomainsText(e.target.value)}
            />
          </label>
          <Button type="button" disabled={busy} onClick={() => void generateToken()}>
            Generate token
          </Button>
        </div>

        <Tabs defaultValue="link" className="mt-1">
          <TabsList variant="line" className="grid w-full grid-cols-2">
            <TabsTrigger value="link">Public link</TabsTrigger>
            <TabsTrigger value="embed">Embed code</TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="mt-4 space-y-3">
            {minted ? (
              <>
                <label className="block text-xs text-ink-muted">
                  Public URL
                  <input
                    readOnly
                    className="mt-1 w-full rounded-[4px] border border-rule bg-canvas px-2 py-1.5 font-data text-xs text-ink"
                    value={minted.shareUrl}
                  />
                </label>
                <div className="flex flex-wrap items-start gap-4">
                  {qrDataUrl ? (
                    <div className="rounded-[6px] border border-rule bg-canvas p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element -- data-URL QR */}
                      <img
                        src={qrDataUrl}
                        alt="QR code for public share link"
                        width={168}
                        height={168}
                      />
                    </div>
                  ) : (
                    <div className="flex h-[168px] w-[168px] items-center justify-center rounded-[6px] border border-rule bg-canvas text-xs text-ink-muted">
                      Generating QR…
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-2 text-sm text-ink-muted">
                    <p>
                      Scan or open the link. No login required. Read-only. Expires{" "}
                      <span className="font-data text-ink">
                        {formatWhen(minted.expiresAt)}
                      </span>
                      .
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={() =>
                          void copyText(minted.shareUrl, "Public link copied.")
                        }
                      >
                        Copy link
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => window.open(minted.shareUrl, "_blank")}
                      >
                        Open
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-ink-muted">
                Generate a token to create a public link and QR code.
              </p>
            )}
          </TabsContent>

          <TabsContent value="embed" className="mt-4 space-y-3">
            {minted ? (
              <>
                {minted.allowedOrigins.length === 0 ? (
                  <p className="text-xs text-rust">
                    No allowed domains configured — embedding is denied everywhere until
                    you add at least one domain above and generate a new token. The public
                    link still works directly.
                  </p>
                ) : (
                  <p className="text-xs text-ink-muted">
                    Framing allowed only from{" "}
                    <span className="font-data text-ink">
                      {minted.allowedOrigins.join(", ")}
                    </span>{" "}
                    (CSP <span className="font-data">frame-ancestors</span>). Expires{" "}
                    <span className="font-data text-ink">
                      {formatWhen(minted.expiresAt)}
                    </span>
                    .
                  </p>
                )}
                <label className="block text-xs text-ink-muted">
                  Embed URL
                  <input
                    readOnly
                    className="mt-1 w-full rounded-[4px] border border-rule bg-canvas px-2 py-1.5 font-data text-xs text-ink"
                    value={minted.embedUrl}
                  />
                </label>
                <label className="block text-xs text-ink-muted">
                  iFrame code
                  <textarea
                    readOnly
                    rows={4}
                    className="mt-1 w-full rounded-[4px] border border-rule bg-canvas px-2 py-1.5 font-data text-xs text-ink"
                    value={minted.embedCode}
                  />
                </label>
                {minted.allowedOrigins.length > 0 ? (
                  <div className="overflow-hidden rounded-[6px] border border-rule">
                    <iframe
                      title="Embed preview"
                      src={minted.embedUrl}
                      className="h-[280px] w-full bg-canvas"
                    />
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => void copyText(minted.embedCode, "Embed code copied.")}
                  >
                    Copy embed code
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void copyText(minted.embedUrl, "Embed URL copied.")}
                  >
                    Copy embed URL
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-ink-muted">
                Generate a token to get iframe embed code.
              </p>
            )}
          </TabsContent>
        </Tabs>

        <section className="mt-2 border-t border-rule pt-3">
          <p className="label-caps text-accent">Active tokens</p>
          {activeTokens.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">No active tokens.</p>
          ) : (
            <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-sm">
              {activeTokens.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[4px] border border-rule px-2 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="font-data text-xs text-ink">{t.tokenPreview}</p>
                    <p className="text-xs text-ink-muted">
                      Expires {formatWhen(t.expiresAt)} · Uses{" "}
                      <span className="font-data">{t.usageCount}</span>
                      {t.lastAccessedAt ? ` · Last ${formatWhen(t.lastAccessedAt)}` : ""}
                      {" · "}
                      {t.allowedOrigins.length > 0
                        ? `${t.allowedOrigins.length} domain${t.allowedOrigins.length === 1 ? "" : "s"}`
                        : "no domains (embed denied)"}
                      {" · "}
                      {t.theme} theme
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void revokeToken(t.token)}
                  >
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
