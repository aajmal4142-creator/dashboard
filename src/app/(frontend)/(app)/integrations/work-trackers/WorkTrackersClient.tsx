"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";

import { useI18n } from "@/components/i18n/I18nProvider";
import {
  EmptyState,
  PageCard,
  PageSkeleton,
  StatusLine,
} from "@/components/shell/PageFrame";
import { AppField, AppSelectNative, appFieldClass } from "@/components/ui/AppField";
import { Button } from "@/components/ui/button";
import type {
  PushableSourceItem,
  WorkTrackerConnectionSummary,
  WorkTrackerProvider,
} from "@/lib/integrations/workTrackers";
import { cn } from "@/lib/utils";

type Flash = { tone: "ok" | "error" | "neutral"; text: string };

type LoadState = "loading" | "ready" | "error";

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function WorkTrackersClient(props: { canManage: boolean }) {
  const { t } = useI18n();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [connections, setConnections] = useState<WorkTrackerConnectionSummary[]>([]);
  const [sources, setSources] = useState<PushableSourceItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [sourceKey, setSourceKey] = useState<string>("");
  const [flash, setFlash] = useState<Flash | null>(null);
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);

  const [provider, setProvider] = useState<WorkTrackerProvider>("jira");
  const [label, setLabel] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://");
  const [workspaceKey, setWorkspaceKey] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [projectOrTeamId, setProjectOrTeamId] = useState("");
  const [projectOrTeamName, setProjectOrTeamName] = useState("");
  const [issueTypeName, setIssueTypeName] = useState("Task");

  const selected = connections.find((c) => c.id === selectedId) ?? null;

  const refresh = useCallback(async () => {
    setLoadState("loading");
    setLoadError(null);
    try {
      const [connRes, srcRes] = await Promise.all([
        fetch("/api/app/integrations/work-trackers"),
        fetch("/api/app/integrations/work-trackers/sources"),
      ]);
      const connData = (await connRes.json()) as {
        connections?: WorkTrackerConnectionSummary[];
        error?: string;
      };
      const srcData = (await srcRes.json()) as {
        sources?: PushableSourceItem[];
        error?: string;
      };
      if (!connRes.ok) {
        setLoadState("error");
        setLoadError(connData.error || t("workTrackers.errorLoad"));
        return;
      }
      const list = connData.connections ?? [];
      setConnections(list);
      setSources(srcData.sources ?? []);
      setSelectedId((prev) => {
        if (prev && list.some((c) => c.id === prev)) return prev;
        return list[0]?.id ?? "";
      });
      setLoadState("ready");
    } catch {
      setLoadState("error");
      setLoadError(t("workTrackers.errorLoad"));
    }
  }, [t]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(id);
  }, [refresh]);

  function resetForm() {
    setProvider("jira");
    setLabel("");
    setBaseUrl("https://");
    setWorkspaceKey("");
    setAccountEmail("");
    setApiToken("");
    setProjectOrTeamId("");
    setProjectOrTeamName("");
    setIssueTypeName("Task");
  }

  function createConnection() {
    startTransition(async () => {
      setFlash(null);
      try {
        const res = await fetch("/api/app/integrations/work-trackers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider,
            label,
            baseUrl:
              provider === "linear"
                ? baseUrl.trim() || "https://api.linear.app"
                : baseUrl,
            workspaceKey: workspaceKey || null,
            accountEmail: accountEmail || null,
            apiToken,
            projectOrTeamId,
            projectOrTeamName: projectOrTeamName || null,
            issueTypeName: provider === "jira" ? issueTypeName : null,
            testBeforeSave: true,
          }),
        });
        const data = (await res.json()) as {
          connection?: WorkTrackerConnectionSummary;
          error?: string;
        };
        if (!res.ok || !data.connection) {
          setFlash({
            tone: "error",
            text: data.error || t("workTrackers.errorCreate"),
          });
          return;
        }
        setApiToken("");
        setShowForm(false);
        resetForm();
        setFlash({ tone: "ok", text: t("workTrackers.created") });
        await refresh();
        setSelectedId(data.connection.id);
      } catch {
        setFlash({ tone: "error", text: t("workTrackers.errorCreate") });
      }
    });
  }

  function testConnection() {
    if (!selected) return;
    startTransition(async () => {
      setFlash(null);
      try {
        const res = await fetch(
          `/api/app/integrations/work-trackers/${selected.id}/test`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
        );
        const data = (await res.json()) as {
          detail?: string;
          error?: string;
          connection?: WorkTrackerConnectionSummary;
        };
        if (!res.ok) {
          setFlash({
            tone: "error",
            text: data.error || t("workTrackers.errorTest"),
          });
          await refresh();
          return;
        }
        setFlash({
          tone: "ok",
          text: data.detail || t("workTrackers.testOk"),
        });
        await refresh();
      } catch {
        setFlash({ tone: "error", text: t("workTrackers.errorTest") });
      }
    });
  }

  function saveMapping() {
    if (!selected) return;
    startTransition(async () => {
      setFlash(null);
      try {
        const res = await fetch(`/api/app/integrations/work-trackers/${selected.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectOrTeamId: selected.projectOrTeamId,
            projectOrTeamName: selected.projectOrTeamName,
            issueTypeName: selected.issueTypeName,
            enabled: selected.enabled,
            clearError: true,
          }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setFlash({
            tone: "error",
            text: data.error || t("workTrackers.errorSave"),
          });
          return;
        }
        setFlash({ tone: "ok", text: t("workTrackers.saved") });
        await refresh();
      } catch {
        setFlash({ tone: "error", text: t("workTrackers.errorSave") });
      }
    });
  }

  function removeConnection() {
    if (!selected) return;
    startTransition(async () => {
      setFlash(null);
      try {
        const res = await fetch(`/api/app/integrations/work-trackers/${selected.id}`, {
          method: "DELETE",
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setFlash({
            tone: "error",
            text: data.error || t("workTrackers.errorDelete"),
          });
          return;
        }
        setFlash({ tone: "ok", text: t("workTrackers.deleted") });
        setSelectedId("");
        await refresh();
      } catch {
        setFlash({ tone: "error", text: t("workTrackers.errorDelete") });
      }
    });
  }

  function pushSelected() {
    if (!selected || !sourceKey) return;
    const [entityType, entityId] = sourceKey.split("::");
    if (!entityType || !entityId) return;

    startTransition(async () => {
      setFlash(null);
      try {
        const res = await fetch(
          `/api/app/integrations/work-trackers/${selected.id}/push`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ entityType, entityId }),
          },
        );
        const data = (await res.json()) as {
          externalKey?: string;
          externalUrl?: string | null;
          error?: string;
        };
        if (!res.ok) {
          setFlash({
            tone: "error",
            text: data.error || t("workTrackers.errorPush"),
          });
          await refresh();
          return;
        }
        setFlash({
          tone: "ok",
          text: data.externalUrl
            ? t("workTrackers.pushOkLink", { key: data.externalKey || "—" })
            : t("workTrackers.pushOk", { key: data.externalKey || "—" }),
        });
        await refresh();
      } catch {
        setFlash({ tone: "error", text: t("workTrackers.errorPush") });
      }
    });
  }

  function patchSelected(
    patch: Partial<
      Pick<
        WorkTrackerConnectionSummary,
        "projectOrTeamId" | "projectOrTeamName" | "issueTypeName" | "enabled"
      >
    >,
  ) {
    if (!selected) return;
    setConnections((prev) =>
      prev.map((c) => (c.id === selected.id ? { ...c, ...patch } : c)),
    );
  }

  if (loadState === "loading" && connections.length === 0) {
    return <PageSkeleton rows={4} />;
  }

  if (loadState === "error" && connections.length === 0) {
    return (
      <EmptyState
        title={t("workTrackers.errorLoad")}
        body={loadError || t("workTrackers.errorLoadHelp")}
        action={
          <Button type="button" variant="secondary" onClick={() => void refresh()}>
            <RefreshCw className="size-4" />
            {t("workTrackers.retry")}
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      {flash ? (
        <StatusLine
          tone={flash.tone === "ok" ? "ok" : flash.tone === "error" ? "error" : "neutral"}
        >
          {flash.text}
        </StatusLine>
      ) : null}

      {!props.canManage ? (
        <StatusLine tone="neutral">{t("workTrackers.viewOnly")}</StatusLine>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">{t("workTrackers.intro")}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => void refresh()}
          >
            <RefreshCw className="size-4" />
            {t("workTrackers.refresh")}
          </Button>
          {props.canManage ? (
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => {
                setShowForm((v) => !v);
                setFlash(null);
              }}
            >
              <Plus className="size-4" />
              {t("workTrackers.connect")}
            </Button>
          ) : null}
        </div>
      </div>

      {showForm && props.canManage ? (
        <PageCard title={t("workTrackers.connectTitle")}>
          <div className="grid gap-4 md:grid-cols-2">
            <AppSelectNative
              label={t("workTrackers.fieldProvider")}
              value={provider}
              onChange={(e) => {
                const next = e.target.value === "linear" ? "linear" : "jira";
                setProvider(next);
                if (next === "linear") setBaseUrl("https://api.linear.app");
                else setBaseUrl("https://");
              }}
            >
              <option value="jira">Jira</option>
              <option value="linear">Linear</option>
            </AppSelectNative>
            <AppField
              label={t("workTrackers.fieldLabel")}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={provider === "jira" ? "Acme Jira" : "Acme Linear"}
            />
            <div className="md:col-span-2">
              <AppField
                label={t("workTrackers.fieldBaseUrl")}
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={
                  provider === "jira"
                    ? "https://your-site.atlassian.net"
                    : "https://api.linear.app"
                }
                className="font-mono text-xs"
              />
            </div>
            <AppField
              label={t("workTrackers.fieldWorkspace")}
              value={workspaceKey}
              onChange={(e) => setWorkspaceKey(e.target.value)}
              placeholder={provider === "jira" ? "cloudId / site" : "optional"}
            />
            {provider === "jira" ? (
              <AppField
                label={t("workTrackers.fieldEmail")}
                type="email"
                value={accountEmail}
                onChange={(e) => setAccountEmail(e.target.value)}
                autoComplete="off"
              />
            ) : (
              <div />
            )}
            <div className="md:col-span-2">
              <label className="flex flex-col gap-1 text-xs text-ink-muted">
                <span className="label-caps">{t("workTrackers.fieldToken")}</span>
                <textarea
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  rows={2}
                  autoComplete="off"
                  spellCheck={false}
                  className={cn(appFieldClass, "font-mono text-xs")}
                />
              </label>
              <p className="mt-1 text-xs text-ink-muted">{t("workTrackers.tokenHelp")}</p>
            </div>
            <AppField
              label={
                provider === "jira"
                  ? t("workTrackers.fieldProject")
                  : t("workTrackers.fieldTeam")
              }
              value={projectOrTeamId}
              onChange={(e) => setProjectOrTeamId(e.target.value)}
              className="font-mono text-xs"
            />
            <AppField
              label={t("workTrackers.fieldProjectName")}
              value={projectOrTeamName}
              onChange={(e) => setProjectOrTeamName(e.target.value)}
            />
            {provider === "jira" ? (
              <AppField
                label={t("workTrackers.fieldIssueType")}
                value={issueTypeName}
                onChange={(e) => setIssueTypeName(e.target.value)}
              />
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={
                pending || !label.trim() || !apiToken.trim() || !projectOrTeamId.trim()
              }
              onClick={createConnection}
            >
              {t("workTrackers.createSubmit")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
            >
              {t("workTrackers.cancel")}
            </Button>
          </div>
        </PageCard>
      ) : null}

      {connections.length === 0 ? (
        <EmptyState
          title={t("workTrackers.emptyTitle")}
          body={t("workTrackers.emptyHelp")}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <PageCard title={t("workTrackers.connectionsTitle")}>
            <ul className="divide-y divide-rule">
              {connections.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`w-full px-0 py-3 text-left text-sm ${
                      c.id === selectedId ? "text-ink" : "text-ink-muted hover:text-ink"
                    }`}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <span className="block font-medium text-ink">{c.label}</span>
                    <span className="mt-0.5 block font-mono text-xs uppercase tracking-wide">
                      {c.provider}
                      {" · "}
                      {c.status}
                      {!c.enabled ? ` · ${t("workTrackers.disabled")}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </PageCard>

          {selected ? (
            <div className="space-y-6">
              <PageCard title={selected.label}>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="label-caps text-ink-muted">
                      {t("workTrackers.fieldProvider")}
                    </dt>
                    <dd className="mt-1 font-mono text-ink uppercase">
                      {selected.provider}
                    </dd>
                  </div>
                  <div>
                    <dt className="label-caps text-ink-muted">
                      {t("workTrackers.fieldStatus")}
                    </dt>
                    <dd className="mt-1 font-mono text-ink">{selected.status}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="label-caps text-ink-muted">
                      {t("workTrackers.fieldBaseUrl")}
                    </dt>
                    <dd className="mt-1 break-all font-mono text-xs text-ink">
                      {selected.baseUrl}
                    </dd>
                  </div>
                  <div>
                    <dt className="label-caps text-ink-muted">
                      {t("workTrackers.lastSync")}
                    </dt>
                    <dd className="mt-1 font-mono text-ink">
                      {formatWhen(selected.lastSyncAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="label-caps text-ink-muted">
                      {t("workTrackers.lastIssue")}
                    </dt>
                    <dd className="mt-1 font-mono text-ink">
                      {selected.lastExternalUrl ? (
                        <a
                          href={selected.lastExternalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="editorial-link"
                        >
                          {selected.lastExternalKey || selected.lastExternalId || "—"}
                        </a>
                      ) : (
                        selected.lastExternalKey || "—"
                      )}
                    </dd>
                  </div>
                </dl>

                {selected.lastError ? (
                  <div className="mt-4 border-t border-rule pt-4">
                    <p className="label-caps text-rust">{t("workTrackers.lastError")}</p>
                    <p className="mt-1 text-sm text-ink">{selected.lastError}</p>
                  </div>
                ) : null}

                {props.canManage ? (
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <AppField
                      label={
                        selected.provider === "jira"
                          ? t("workTrackers.fieldProject")
                          : t("workTrackers.fieldTeam")
                      }
                      value={selected.projectOrTeamId}
                      onChange={(e) => patchSelected({ projectOrTeamId: e.target.value })}
                      className="font-mono text-xs"
                    />
                    <AppField
                      label={t("workTrackers.fieldProjectName")}
                      value={selected.projectOrTeamName || ""}
                      onChange={(e) =>
                        patchSelected({ projectOrTeamName: e.target.value })
                      }
                    />
                    {selected.provider === "jira" ? (
                      <AppField
                        label={t("workTrackers.fieldIssueType")}
                        value={selected.issueTypeName || "Task"}
                        onChange={(e) => patchSelected({ issueTypeName: e.target.value })}
                      />
                    ) : null}
                    <label className="flex items-center gap-2 text-sm text-ink">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-rule"
                        checked={selected.enabled}
                        onChange={(e) => patchSelected({ enabled: e.target.checked })}
                      />
                      {t("workTrackers.fieldEnabled")}
                    </label>
                  </div>
                ) : null}

                {props.canManage ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button type="button" disabled={pending} onClick={saveMapping}>
                      {t("workTrackers.save")}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={pending}
                      onClick={testConnection}
                    >
                      {t("workTrackers.test")}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={pending}
                      onClick={removeConnection}
                    >
                      <Trash2 className="size-4" />
                      {t("workTrackers.delete")}
                    </Button>
                  </div>
                ) : null}
              </PageCard>

              <PageCard title={t("workTrackers.pushTitle")}>
                <p className="mb-4 text-sm text-ink-muted">
                  {t("workTrackers.pushHelp")}
                </p>
                {sources.length === 0 ? (
                  <EmptyState
                    title={t("workTrackers.noSourcesTitle")}
                    body={t("workTrackers.noSourcesHelp")}
                  />
                ) : (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <AppSelectNative
                        label={t("workTrackers.fieldSource")}
                        value={sourceKey}
                        onChange={(e) => setSourceKey(e.target.value)}
                        disabled={!props.canManage || pending}
                      >
                        <option value="">{t("workTrackers.selectSource")}</option>
                        {sources.map((s) => (
                          <option
                            key={`${s.entityType}::${s.entityId}`}
                            value={`${s.entityType}::${s.entityId}`}
                          >
                            [{s.entityType}] {s.title}
                          </option>
                        ))}
                      </AppSelectNative>
                    </div>
                    {props.canManage ? (
                      <Button
                        type="button"
                        disabled={pending || !sourceKey || !selected.enabled}
                        onClick={pushSelected}
                      >
                        {t("workTrackers.push")}
                      </Button>
                    ) : null}
                  </div>
                )}
              </PageCard>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
