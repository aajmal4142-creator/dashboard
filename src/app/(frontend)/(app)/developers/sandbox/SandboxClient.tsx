"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { AppField, AppSelectNative } from "@/components/ui/AppField";
import { useT } from "@/components/i18n/I18nProvider";
import {
  SANDBOX_ALLOWLIST,
  buildSandboxRequestUrl,
  maskApiKeyForDisplay,
  resolveSandboxRequest,
  type SandboxEndpoint,
} from "@/lib/developers/sandbox";
import { cn } from "@/lib/utils";

type BiKeyRow = {
  id: string;
  name: string;
  apiKeyPrefix: string | null;
  status: string;
};

type RunResult = {
  status: number;
  statusText: string;
  durationMs: number;
  bodyText: string;
  contentType: string | null;
};

type AuthChoice = "session" | "api-key";

function formatBody(text: string, contentType: string | null): string {
  if (!text) return "(empty body)";
  if (contentType?.includes("application/json")) {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }
  return text;
}

function authLabel(endpoint: SandboxEndpoint, t: (key: string) => string): string {
  if (endpoint.auth === "bi-key") return t("apiSandbox.authBiKey");
  if (endpoint.auth === "session") return t("apiSandbox.authSession");
  return t("apiSandbox.authEither");
}

export function SandboxClient() {
  const t = useT();
  const [endpointId, setEndpointId] = useState(SANDBOX_ALLOWLIST[0]?.id ?? "");
  const [query, setQuery] = useState(SANDBOX_ALLOWLIST[0]?.sampleQuery ?? "");
  const [authChoice, setAuthChoice] = useState<AuthChoice>("session");
  const [apiKey, setApiKey] = useState("");
  const [keys, setKeys] = useState<BiKeyRow[]>([]);
  const [keysError, setKeysError] = useState<string | null>(null);
  const [keysLoading, setKeysLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [requestPreview, setRequestPreview] = useState<string | null>(null);

  const endpoint =
    SANDBOX_ALLOWLIST.find((e) => e.id === endpointId) ?? SANDBOX_ALLOWLIST[0];

  useEffect(() => {
    let cancelled = false;
    async function loadKeys() {
      setKeysLoading(true);
      setKeysError(null);
      try {
        const res = await fetch("/api/app/settings/bi-keys");
        const data = (await res.json()) as {
          keys?: BiKeyRow[];
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setKeysError(data.error ?? t("apiSandbox.errorKeys"));
          setKeys([]);
          return;
        }
        setKeys(
          (data.keys ?? []).filter(
            (k) => k.status === "active" && Boolean(k.apiKeyPrefix),
          ),
        );
      } catch {
        if (!cancelled) {
          setKeysError(t("apiSandbox.errorKeys"));
          setKeys([]);
        }
      } finally {
        if (!cancelled) setKeysLoading(false);
      }
    }
    void loadKeys();
    return () => {
      cancelled = true;
    };
  }, [t]);

  function onEndpointChange(id: string) {
    setEndpointId(id);
    const next = SANDBOX_ALLOWLIST.find((e) => e.id === id);
    setQuery(next?.sampleQuery ?? "");
    setError(null);
    setResult(null);
    setRequestPreview(null);
    if (next?.auth === "bi-key") {
      setAuthChoice("api-key");
    } else if (next?.auth === "session") {
      setAuthChoice("session");
    }
  }

  function run() {
    startTransition(async () => {
      setError(null);
      setResult(null);

      if (!endpoint) {
        setError(t("apiSandbox.errorNoEndpoint"));
        return;
      }

      const resolved = resolveSandboxRequest({
        method: "GET",
        path: endpoint.path,
      });
      if (!resolved.ok) {
        setError(resolved.error);
        return;
      }

      const url = buildSandboxRequestUrl(resolved.path, query);
      if (!url) {
        setError(t("apiSandbox.errorBlocked"));
        return;
      }

      const headers: Record<string, string> = {
        Accept: "application/json",
      };

      const useKey = authChoice === "api-key";
      const trimmedKey = apiKey.trim();
      if (useKey) {
        if (!trimmedKey) {
          setError(t("apiSandbox.errorKeyRequired"));
          return;
        }
        headers["X-ClearESG-Api-Key"] = trimmedKey;
      }

      const previewHeaders: Record<string, string> = { ...headers };
      if (previewHeaders["X-ClearESG-Api-Key"]) {
        previewHeaders["X-ClearESG-Api-Key"] = maskApiKeyForDisplay(trimmedKey);
      }
      setRequestPreview(
        `GET ${url}\n${Object.entries(previewHeaders)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n")}`,
      );

      const started = performance.now();
      try {
        const res = await fetch(url, {
          method: "GET",
          headers,
          credentials: "same-origin",
        });
        const durationMs = Math.round(performance.now() - started);
        const contentType = res.headers.get("content-type");
        const bodyText = await res.text();
        setResult({
          status: res.status,
          statusText: res.statusText,
          durationMs,
          bodyText,
          contentType,
        });
        if (!res.ok) {
          setError(
            t("apiSandbox.errorHttp", {
              status: res.status,
              statusText: res.statusText || "error",
            }),
          );
        }
      } catch {
        setError(t("apiSandbox.errorNetwork"));
      }
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-rule pb-4 text-sm">
        <Link
          href="/developers"
          className="text-ink-muted underline-offset-2 hover:text-ink hover:underline"
        >
          {t("apiSandbox.linkDocs")}
        </Link>
        <span className="text-rule-strong" aria-hidden>
          /
        </span>
        <Link
          href="/settings"
          className="text-ink-muted underline-offset-2 hover:text-ink hover:underline"
        >
          {t("apiSandbox.linkKeys")}
        </Link>
      </div>

      <p className="max-w-2xl text-sm text-ink-muted">{t("apiSandbox.intro")}</p>

      <section className="grid gap-6 border-t border-rule pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <h2 className="font-display text-lg text-ink">
            {t("apiSandbox.requestTitle")}
          </h2>

          <AppSelectNative
            label={t("apiSandbox.endpoint")}
            value={endpointId}
            onChange={(e) => onEndpointChange(e.target.value)}
            disabled={pending}
          >
            {SANDBOX_ALLOWLIST.map((ep) => (
              <option key={ep.id} value={ep.id}>
                GET {ep.path}
              </option>
            ))}
          </AppSelectNative>

          {endpoint ? (
            <p className="text-xs text-ink-muted">
              {endpoint.summary} · {authLabel(endpoint, t)}
            </p>
          ) : null}

          <AppField
            label={t("apiSandbox.query")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="limit=10&page=1"
            disabled={pending}
            spellCheck={false}
            autoComplete="off"
          />

          <AppSelectNative
            label={t("apiSandbox.authMode")}
            value={authChoice}
            onChange={(e) => setAuthChoice(e.target.value as AuthChoice)}
            disabled={pending}
          >
            <option value="session">{t("apiSandbox.authSessionOption")}</option>
            <option value="api-key">{t("apiSandbox.authKeyOption")}</option>
          </AppSelectNative>

          {authChoice === "api-key" ? (
            <div className="space-y-2">
              <AppField
                label={t("apiSandbox.apiKey")}
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="bi_…"
                disabled={pending}
                spellCheck={false}
                autoComplete="off"
              />
              <p className="text-xs text-ink-muted">{t("apiSandbox.apiKeyHelp")}</p>
              {keysLoading ? (
                <p className="text-xs text-ink-muted">{t("apiSandbox.keysLoading")}</p>
              ) : keysError ? (
                <p className="text-xs text-rust">{keysError}</p>
              ) : keys.length === 0 ? (
                <p className="text-xs text-ink-muted">{t("apiSandbox.keysEmpty")}</p>
              ) : (
                <ul className="space-y-1 text-xs text-ink-muted">
                  {keys.map((k) => (
                    <li key={k.id} className="font-mono tabular-nums">
                      {k.name}: {k.apiKeyPrefix}…
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" onClick={run} disabled={pending || !endpoint}>
              {pending ? t("apiSandbox.running") : t("apiSandbox.run")}
            </Button>
          </div>

          {error ? (
            <p className="text-sm text-rust" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="space-y-4">
          <h2 className="font-display text-lg text-ink">
            {t("apiSandbox.responseTitle")}
          </h2>

          {requestPreview ? (
            <div>
              <p className="label-caps text-ink-muted">
                {t("apiSandbox.requestPreview")}
              </p>
              <pre className="mt-2 max-h-40 overflow-auto rounded-[6px] border border-rule bg-surface-2 p-3 font-mono text-xs text-ink whitespace-pre-wrap">
                {requestPreview}
              </pre>
            </div>
          ) : null}

          {pending && !result ? (
            <p className="text-sm text-ink-muted">{t("apiSandbox.loading")}</p>
          ) : null}

          {!pending && !result && !error ? (
            <p className="text-sm text-ink-muted">{t("apiSandbox.emptyResponse")}</p>
          ) : null}

          {result ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                <span
                  className={cn(
                    "font-mono tabular-nums",
                    result.status >= 400 ? "text-rust" : "text-signal",
                  )}
                >
                  {result.status} {result.statusText}
                </span>
                <span className="font-mono tabular-nums text-ink-muted">
                  {result.durationMs} ms
                </span>
              </div>
              <pre className="max-h-112 overflow-auto rounded-[6px] border border-rule bg-surface-2 p-3 font-mono text-xs text-ink whitespace-pre-wrap">
                {formatBody(result.bodyText, result.contentType)}
              </pre>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
