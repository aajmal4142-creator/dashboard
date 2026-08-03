"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition, type ReactNode } from "react";
import { Copy, Mail, Plus, RefreshCw, RotateCcw } from "lucide-react";

import { useI18n } from "@/components/i18n/I18nProvider";
import {
  EmptyState,
  PageCard,
  PageSkeleton,
  StatusLine,
} from "@/components/shell/PageFrame";
import { AppField, AppSelectNative } from "@/components/ui/AppField";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FormListItem = {
  id: string;
  formName: string;
  formType: string;
  status: string;
  recipientCount: number | null;
  responseRate: number | null;
  inboundEnabled: boolean;
  recurringEnabled: boolean;
  lastImportAt: string | null;
};

type WhitelistRow = { email: string; label: string | null };

type FormDetail = {
  id: string;
  formName: string;
  formType: string;
  status: string;
  inboundEnabled: boolean;
  inboundToken: string | null;
  inboundAddress: string | null;
  subjectTokenHint: string | null;
  whitelistedSenders: WhitelistRow[];
  recurringEnabled: boolean;
  recurringCadence: string;
  lastImportAt: string | null;
  recipientCount: number | null;
  responseCount: number | null;
  responseRate: number | null;
  emailSubject?: string | null;
  emailBody?: string | null;
};

type ImportLog = {
  id: string;
  form: string | { id: string } | null;
  fromEmail: string;
  subject: string | null;
  status: string;
  reason: string | null;
  attachmentName: string | null;
  recordsParsed: number | null;
  recordsWritten: number | null;
  recordsRejected: number | null;
  recordsUnchanged: number | null;
  replyDelivery: string | null;
  createdAt: string;
};

type ProcessResult = {
  ok?: boolean;
  status?: string;
  reason?: string;
  written?: number;
  rejected?: number;
  unchanged?: number;
  dryRun?: boolean;
  error?: string;
};

type Flash = { tone: "ok" | "error" | "neutral"; text: string };

const CSV_EXAMPLE =
  "metricKey,value,unit,quality\nelectricity_kwh,12000,kWh,measured\ndiesel_litres,450,L,estimated";

function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-data tabular-nums", className)}>{children}</span>;
}

function statusTone(status: string): string {
  if (status === "success" || status === "active") return "text-signal";
  if (status === "partial" || status === "draft") return "text-amber";
  if (status === "rejected" || status === "failed" || status === "closed") {
    return "text-rust";
  }
  return "text-ink-muted";
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formIdOf(form: ImportLog["form"]): string | null {
  if (!form) return null;
  if (typeof form === "string") return form;
  return form.id ?? null;
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function EmailImportClient(props: { canEdit: boolean; canViewLogs: boolean }) {
  const { t } = useI18n();
  const [forms, setForms] = useState<FormListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FormDetail | null>(null);
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [logsForbidden, setLogsForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [createOpen, setCreateOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [emailSubject, setEmailSubject] = useState("ClearESG data collection");
  const [emailBody, setEmailBody] = useState(
    "Please reply with a CSV attachment (metricKey,value,unit,quality).",
  );

  const [whitelistText, setWhitelistText] = useState("");
  const [inboundEnabled, setInboundEnabled] = useState(false);
  const [formStatus, setFormStatus] = useState("draft");
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [recurringCadence, setRecurringCadence] = useState("none");

  const [dryFrom, setDryFrom] = useState("");
  const [csvText, setCsvText] = useState(CSV_EXAMPLE);
  const [processResult, setProcessResult] = useState<ProcessResult | null>(null);

  const loadForms = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/app/email-import/forms");
      const data = (await res.json()) as {
        forms?: FormListItem[];
        error?: string;
      };
      if (!res.ok) {
        setLoadError(data.error ?? t("emailImport.errorLoad"));
        setForms([]);
        return;
      }
      setForms(data.forms ?? []);
    } catch {
      setLoadError(t("emailImport.errorLoad"));
      setForms([]);
    }
  }, [t]);

  const loadLogs = useCallback(
    async (formId: string | null) => {
      if (!props.canViewLogs) {
        setLogs([]);
        setLogsForbidden(false);
        return;
      }
      try {
        const qs = formId
          ? `?formId=${encodeURIComponent(formId)}&limit=40`
          : "?limit=40";
        const res = await fetch(`/api/app/email-import/logs${qs}`);
        const data = (await res.json()) as {
          logs?: ImportLog[];
          error?: string;
        };
        if (res.status === 403) {
          setLogsForbidden(true);
          setLogs([]);
          return;
        }
        if (!res.ok) {
          setLogsForbidden(false);
          setFlash({
            tone: "error",
            text: data.error ?? t("emailImport.errorLogs"),
          });
          return;
        }
        setLogsForbidden(false);
        setLogs(data.logs ?? []);
      } catch {
        setFlash({ tone: "error", text: t("emailImport.errorLogs") });
      }
    },
    [props.canViewLogs, t],
  );

  const loadDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/app/email-import/forms/${id}`);
        const data = (await res.json()) as FormDetail & { error?: string };
        if (!res.ok) {
          setFlash({
            tone: "error",
            text: data.error ?? t("emailImport.errorDetail"),
          });
          setDetail(null);
          return;
        }
        setDetail(data);
        setInboundEnabled(data.inboundEnabled);
        setFormStatus(data.status);
        setRecurringEnabled(data.recurringEnabled);
        setRecurringCadence(data.recurringCadence || "none");
        setWhitelistText(
          (data.whitelistedSenders ?? [])
            .map((s) => (s.label ? `${s.email},${s.label}` : s.email))
            .join("\n"),
        );
        setDryFrom((prev) =>
          prev.trim() ? prev : (data.whitelistedSenders?.[0]?.email ?? prev),
        );
      } catch {
        setFlash({ tone: "error", text: t("emailImport.errorDetail") });
      } finally {
        setDetailLoading(false);
      }
    },
    [t],
  );

  const refresh = useCallback(() => {
    startTransition(async () => {
      setLoading(true);
      setFlash(null);
      await loadForms();
      if (selectedId) {
        await loadDetail(selectedId);
        await loadLogs(selectedId);
      } else {
        await loadLogs(null);
      }
      setLoading(false);
    });
  }, [loadDetail, loadForms, loadLogs, selectedId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      await loadForms();
      if (!cancelled) {
        await loadLogs(null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadForms, loadLogs]);

  useEffect(() => {
    if (!selectedId) {
      const id = window.setTimeout(() => setDetail(null), 0);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => {
      void loadDetail(selectedId);
      void loadLogs(selectedId);
    }, 0);
    return () => window.clearTimeout(id);
  }, [selectedId, loadDetail, loadLogs]);

  function parseWhitelist(text: string): Array<{ email: string; label?: string }> {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [email, ...rest] = line.split(",");
        const label = rest.join(",").trim();
        return {
          email: (email ?? "").trim(),
          ...(label ? { label } : {}),
        };
      })
      .filter((row) => row.email.includes("@"));
  }

  function createForm() {
    if (!props.canEdit) return;
    startTransition(async () => {
      setFlash(null);
      try {
        const res = await fetch("/api/app/email-import/forms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            formName: formName.trim() || "Site manager CSV",
            formType: "custom",
            emailSubject: emailSubject.trim(),
            emailBody: emailBody.trim(),
            status: "draft",
            inboundEnabled: false,
            whitelistedSenders: [],
          }),
        });
        const data = (await res.json()) as {
          formId?: string;
          error?: string;
          message?: string;
        };
        if (!res.ok || !data.formId) {
          setFlash({
            tone: "error",
            text: data.error ?? t("emailImport.errorCreate"),
          });
          return;
        }
        setCreateOpen(false);
        setFormName("");
        setFlash({ tone: "ok", text: data.message ?? t("emailImport.created") });
        await loadForms();
        setSelectedId(data.formId);
      } catch {
        setFlash({ tone: "error", text: t("emailImport.errorCreate") });
      }
    });
  }

  function saveConfig(extra?: { rotateInboundToken?: boolean }) {
    if (!props.canEdit || !selectedId) return;
    startTransition(async () => {
      setFlash(null);
      try {
        const res = await fetch(`/api/app/email-import/forms/${selectedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: formStatus,
            inboundEnabled,
            recurringEnabled,
            recurringCadence,
            whitelistedSenders: parseWhitelist(whitelistText),
            rotateInboundToken: extra?.rotateInboundToken === true,
          }),
        });
        const data = (await res.json()) as {
          error?: string;
          message?: string;
          inboundAddress?: string | null;
        };
        if (!res.ok) {
          setFlash({
            tone: "error",
            text: data.error ?? t("emailImport.errorSave"),
          });
          return;
        }
        setFlash({
          tone: "ok",
          text: extra?.rotateInboundToken
            ? t("emailImport.tokenRotated")
            : (data.message ?? t("emailImport.saved")),
        });
        await loadDetail(selectedId);
        await loadForms();
      } catch {
        setFlash({ tone: "error", text: t("emailImport.errorSave") });
      }
    });
  }

  function runProcess(dryRun: boolean) {
    if (!props.canEdit || !selectedId) return;
    startTransition(async () => {
      setFlash(null);
      setProcessResult(null);
      try {
        const res = await fetch("/api/app/email-import/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            formId: selectedId,
            from: dryFrom.trim(),
            csvText,
            subject: detail?.subjectTokenHint
              ? `Manual import ${detail.subjectTokenHint}`
              : "Manual import",
            dryRun,
            skipReply: true,
          }),
        });
        const data = (await res.json()) as ProcessResult;
        setProcessResult(data);
        if (!res.ok || data.ok === false) {
          setFlash({
            tone: "error",
            text: data.reason ?? data.error ?? t("emailImport.errorProcess"),
          });
          return;
        }
        setFlash({
          tone: "ok",
          text: dryRun ? t("emailImport.dryRunOk") : t("emailImport.applyOk"),
        });
        await loadLogs(selectedId);
        await loadDetail(selectedId);
        await loadForms();
      } catch {
        setFlash({ tone: "error", text: t("emailImport.errorProcess") });
      }
    });
  }

  async function onCopy(value: string | null | undefined) {
    if (!value) return;
    const ok = await copyText(value);
    setFlash({
      tone: ok ? "ok" : "error",
      text: ok ? t("emailImport.copied") : t("emailImport.copyFailed"),
    });
  }

  if (loading && forms.length === 0 && !loadError) {
    return <PageSkeleton rows={6} />;
  }

  if (loadError && forms.length === 0) {
    return (
      <EmptyState
        title={t("emailImport.errorLoad")}
        body={loadError}
        action={
          <Button type="button" variant="outline" onClick={refresh}>
            {t("emailImport.retry")}
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageCard title={t("emailImport.howTitle")}>
        <ol className="list-decimal space-y-2 pl-5 text-[13px] leading-relaxed text-ink-muted">
          <li>{t("emailImport.howStep1")}</li>
          <li>{t("emailImport.howStep2")}</li>
          <li>{t("emailImport.howStep3")}</li>
          <li>{t("emailImport.howStep4")}</li>
        </ol>
        <p className="mt-3 text-[13px] text-ink-muted">
          {t("emailImport.howAlt")}{" "}
          <Link
            href="/requests"
            className="text-accent underline-offset-2 hover:underline"
          >
            {t("emailImport.linkRequests")}
          </Link>
          {" · "}
          <Link
            href="/suppliers/engagement"
            className="text-accent underline-offset-2 hover:underline"
          >
            {t("emailImport.linkEngagement")}
          </Link>
        </p>
      </PageCard>

      {flash ? <StatusLine tone={flash.tone}>{flash.text}</StatusLine> : null}

      {!props.canEdit ? (
        <p className="text-[12px] text-ink-muted">{t("emailImport.viewOnly")}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={pending}
        >
          <RefreshCw className="mr-1.5 size-3.5" aria-hidden />
          {t("emailImport.refresh")}
        </Button>
        {props.canEdit ? (
          <Button type="button" size="sm" onClick={() => setCreateOpen((v) => !v)}>
            <Plus className="mr-1.5 size-3.5" aria-hidden />
            {t("emailImport.create")}
          </Button>
        ) : null}
      </div>

      {createOpen && props.canEdit ? (
        <PageCard title={t("emailImport.createTitle")}>
          <div className="grid gap-3 md:grid-cols-2">
            <AppField
              label={t("emailImport.fieldName")}
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Plant A monthly energy"
            />
            <AppField
              label={t("emailImport.fieldSubject")}
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
            />
          </div>
          <label className="mt-3 flex flex-col gap-1 text-xs text-ink-muted">
            <span className="label-caps">{t("emailImport.fieldBody")}</span>
            <textarea
              className="min-h-24 w-full rounded-[4px] border border-rule bg-surface-1 px-2 py-2 text-sm text-ink focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
            />
          </label>
          <div className="mt-3 flex gap-2">
            <Button type="button" onClick={createForm} disabled={pending}>
              {t("emailImport.createSubmit")}
            </Button>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </PageCard>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-4">
          <PageCard title={t("emailImport.formsTitle")}>
            {forms.length === 0 ? (
              <EmptyState
                title={t("emailImport.emptyTitle")}
                body={t("emailImport.emptyHelp")}
              />
            ) : (
              <ul className="divide-y divide-rule">
                {forms.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(f.id)}
                      className={cn(
                        "flex w-full flex-col gap-1 px-1 py-3 text-left transition-colors hover:bg-surface-2",
                        selectedId === f.id && "bg-accent-quiet/40",
                      )}
                    >
                      <span className="text-sm font-medium text-ink">{f.formName}</span>
                      <span className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                        <span className={statusTone(f.status)}>{f.status}</span>
                        <span className="text-ink-muted">
                          {f.inboundEnabled
                            ? t("emailImport.inboundOn")
                            : t("emailImport.inboundOff")}
                        </span>
                        {f.lastImportAt ? (
                          <span className="text-ink-muted">
                            <Mono>{formatWhen(f.lastImportAt)}</Mono>
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </PageCard>
        </div>

        <div className="space-y-4 lg:col-span-8">
          {!selectedId ? (
            <EmptyState
              title={t("emailImport.selectTitle")}
              body={t("emailImport.selectHelp")}
            />
          ) : detailLoading && !detail ? (
            <PageSkeleton rows={5} />
          ) : detail ? (
            <>
              <PageCard title={t("emailImport.configTitle")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-ink">{detail.formName}</p>
                    <p className="mt-1 text-[12px] text-ink-muted">
                      <span className={statusTone(detail.status)}>{detail.status}</span>
                      {" · "}
                      {detail.inboundEnabled
                        ? t("emailImport.inboundOn")
                        : t("emailImport.inboundOff")}
                    </p>
                  </div>
                  <Mail className="size-5 text-ink-muted" aria-hidden />
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <p className="label-caps text-ink-muted">
                      {t("emailImport.inboundAddress")}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <code className="rounded-[4px] border border-rule bg-canvas px-2 py-1 font-data text-[12px] text-ink">
                        {detail.inboundAddress ?? t("emailImport.noToken")}
                      </code>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!detail.inboundAddress}
                        onClick={() => void onCopy(detail.inboundAddress)}
                      >
                        <Copy className="mr-1 size-3.5" aria-hidden />
                        {t("emailImport.copy")}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="label-caps text-ink-muted">
                      {t("emailImport.subjectHint")}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <code className="rounded-[4px] border border-rule bg-canvas px-2 py-1 font-data text-[12px] text-ink">
                        {detail.subjectTokenHint ?? "—"}
                      </code>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!detail.subjectTokenHint}
                        onClick={() => void onCopy(detail.subjectTokenHint)}
                      >
                        <Copy className="mr-1 size-3.5" aria-hidden />
                        {t("emailImport.copy")}
                      </Button>
                    </div>
                  </div>
                  <p className="text-[12px] leading-relaxed text-ink-muted">
                    {t("emailImport.instructions")}
                  </p>
                </div>

                {props.canEdit ? (
                  <div className="mt-5 grid gap-3 border-t border-rule pt-4 md:grid-cols-2">
                    <AppSelectNative
                      label={t("emailImport.fieldStatus")}
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value)}
                    >
                      <option value="draft">draft</option>
                      <option value="active">active</option>
                      <option value="closed">closed</option>
                      <option value="archived">archived</option>
                    </AppSelectNative>
                    <AppSelectNative
                      label={t("emailImport.fieldCadence")}
                      value={recurringCadence}
                      onChange={(e) => setRecurringCadence(e.target.value)}
                    >
                      <option value="none">none</option>
                      <option value="weekly">weekly</option>
                      <option value="monthly">monthly</option>
                      <option value="quarterly">quarterly</option>
                    </AppSelectNative>
                    <label className="flex items-center gap-2 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={inboundEnabled}
                        onChange={(e) => setInboundEnabled(e.target.checked)}
                        className="rounded-[2px] border-rule"
                      />
                      {t("emailImport.enableInbound")}
                    </label>
                    <label className="flex items-center gap-2 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={recurringEnabled}
                        onChange={(e) => setRecurringEnabled(e.target.checked)}
                        className="rounded-[2px] border-rule"
                      />
                      {t("emailImport.enableRecurring")}
                    </label>
                    <label className="md:col-span-2 flex flex-col gap-1 text-xs text-ink-muted">
                      <span className="label-caps">{t("emailImport.whitelist")}</span>
                      <textarea
                        className="min-h-24 w-full rounded-[4px] border border-rule bg-surface-1 px-2 py-2 font-data text-sm text-ink focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                        value={whitelistText}
                        onChange={(e) => setWhitelistText(e.target.value)}
                        placeholder={
                          "site.manager@example.com,Plant A\nsupplier@example.com"
                        }
                      />
                      <span>{t("emailImport.whitelistHelp")}</span>
                    </label>
                    <div className="md:col-span-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={() => saveConfig()}
                        disabled={pending}
                      >
                        {t("common.save")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={pending}
                        onClick={() => saveConfig({ rotateInboundToken: true })}
                      >
                        <RotateCcw className="mr-1.5 size-3.5" aria-hidden />
                        {t("emailImport.rotateToken")}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </PageCard>

              {props.canEdit ? (
                <PageCard title={t("emailImport.processTitle")}>
                  <p className="text-[13px] text-ink-muted">
                    {t("emailImport.processHelp")}
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <AppField
                      label={t("emailImport.fieldFrom")}
                      value={dryFrom}
                      onChange={(e) => setDryFrom(e.target.value)}
                      placeholder="whitelisted@example.com"
                    />
                  </div>
                  <label className="mt-3 flex flex-col gap-1 text-xs text-ink-muted">
                    <span className="label-caps">{t("emailImport.fieldCsv")}</span>
                    <textarea
                      className="min-h-32 w-full rounded-[4px] border border-rule bg-surface-1 px-2 py-2 font-data text-sm text-ink focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                      value={csvText}
                      onChange={(e) => setCsvText(e.target.value)}
                    />
                  </label>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending || !dryFrom.trim() || !csvText.trim()}
                      onClick={() => runProcess(true)}
                    >
                      {t("emailImport.dryRun")}
                    </Button>
                    <Button
                      type="button"
                      disabled={pending || !dryFrom.trim() || !csvText.trim()}
                      onClick={() => runProcess(false)}
                    >
                      {t("emailImport.apply")}
                    </Button>
                  </div>
                  <p className="mt-2 text-[12px] text-ink-muted">
                    {t("emailImport.rejectNote")}
                  </p>
                  {processResult ? (
                    <div className="mt-3 rounded-[4px] border border-rule bg-canvas px-3 py-2 text-[12px] text-ink">
                      <p>
                        Status{" "}
                        <span className={statusTone(processResult.status ?? "")}>
                          {processResult.status ?? "—"}
                        </span>
                        {processResult.dryRun
                          ? ` · ${t("emailImport.dryRunBadge")}`
                          : null}
                      </p>
                      <p className="mt-1 text-ink-muted">
                        {t("emailImport.written")}:{" "}
                        <Mono>{processResult.written ?? 0}</Mono>
                        {" · "}
                        {t("emailImport.rejected")}:{" "}
                        <Mono>{processResult.rejected ?? 0}</Mono>
                        {" · "}
                        {t("emailImport.unchanged")}:{" "}
                        <Mono>{processResult.unchanged ?? 0}</Mono>
                      </p>
                      {processResult.reason ? (
                        <p className="mt-1 text-rust">{processResult.reason}</p>
                      ) : null}
                    </div>
                  ) : null}
                </PageCard>
              ) : null}
            </>
          ) : null}

          <PageCard title={t("emailImport.logsTitle")}>
            {!props.canViewLogs || logsForbidden ? (
              <p className="text-[13px] text-ink-muted">{t("emailImport.logsAdmin")}</p>
            ) : logs.length === 0 ? (
              <EmptyState
                title={t("emailImport.logsEmpty")}
                body={t("emailImport.logsEmptyHelp")}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-rule text-ink-muted">
                      <th className="px-2 py-2 font-medium">
                        {t("emailImport.colWhen")}
                      </th>
                      <th className="px-2 py-2 font-medium">
                        {t("emailImport.colFrom")}
                      </th>
                      <th className="px-2 py-2 font-medium">
                        {t("emailImport.colStatus")}
                      </th>
                      <th className="px-2 py-2 font-medium">
                        {t("emailImport.colCounts")}
                      </th>
                      <th className="px-2 py-2 font-medium">
                        {t("emailImport.colReason")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-rule/60">
                        <td className="px-2 py-2">
                          <Mono>{formatWhen(log.createdAt)}</Mono>
                        </td>
                        <td className="px-2 py-2 font-data text-ink">{log.fromEmail}</td>
                        <td className={cn("px-2 py-2", statusTone(log.status))}>
                          {log.status}
                        </td>
                        <td className="px-2 py-2 text-ink-muted">
                          <Mono>
                            {log.recordsWritten ?? 0}/{log.recordsRejected ?? 0}/
                            {log.recordsUnchanged ?? 0}
                          </Mono>
                        </td>
                        <td className="max-w-[220px] truncate px-2 py-2 text-ink-muted">
                          {log.reason ?? log.attachmentName ?? "—"}
                          {selectedId &&
                          formIdOf(log.form) &&
                          formIdOf(log.form) !== selectedId
                            ? ` · ${formIdOf(log.form)}`
                            : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PageCard>
        </div>
      </div>
    </div>
  );
}
