"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { Plus, Trash2 } from "lucide-react";

import { EmptyState, PageSkeleton, StatusLine } from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { AppField, AppSelectNative } from "@/components/ui/AppField";
import { useI18n } from "@/components/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import type {
  AllocationMode,
  CascadeProgressRollup,
  CascadeStatus,
  ProgressQuality,
} from "@/lib/analytics/targetCascade";

type FacilityOpt = {
  id: string;
  name: string;
  code: string;
  active: boolean;
  parentId: string | null;
};

type SbtiOpt = {
  id: string;
  name: string;
  baselineYear: number;
  targetYear: number;
  baselineEmissions: number;
  targetEmissions: number | null;
  reductionPercent: number | null;
  status: string;
};

type Teammate = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type AllocationForm = {
  key: string;
  id?: string;
  facilityId: string;
  ownerId: string;
  mode: AllocationMode;
  sharePct: string;
  absoluteTco2e: string;
  reportedCurrentTco2e: string;
  notes: string;
};

type CascadeDto = {
  id: string;
  name: string;
  sbtiTargetId: string | null;
  baselineYear: number;
  targetYear: number;
  orgBaselineTco2e: number;
  orgTargetTco2e: number;
  requireExactShares: boolean;
  status: CascadeStatus;
  notes: string | null;
  allocations: Array<{
    id: string;
    facilityId: string;
    ownerId: string | null;
    mode: AllocationMode;
    sharePct: number | null;
    absoluteTco2e: number | null;
    reportedCurrentTco2e: number | null;
    notes: string | null;
    resolvedTargetTco2e: number | null;
  }>;
  shareSumPct: number;
  allocatedTargetTco2e: number;
  unallocatedTargetTco2e: number;
};

type CascadeBundle = {
  cascade: CascadeDto;
  progress: CascadeProgressRollup;
};

type IndexPayload = {
  cascades: CascadeBundle[];
  facilities: FacilityOpt[];
  sbtiTargets: SbtiOpt[];
  canWrite?: boolean;
};

type EditorState = {
  id: string | null;
  name: string;
  sbtiTargetId: string;
  baselineYear: string;
  targetYear: string;
  orgBaselineTco2e: string;
  orgTargetTco2e: string;
  requireExactShares: boolean;
  status: CascadeStatus;
  notes: string;
  allocations: AllocationForm[];
};

function Mono({ children }: { children: ReactNode }) {
  return (
    <span className="font-[family-name:var(--font-mono)] tabular-nums">{children}</span>
  );
}

function formatNum(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function newRowKey(): string {
  return `k-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyAllocation(facilityId = ""): AllocationForm {
  return {
    key: newRowKey(),
    facilityId,
    ownerId: "",
    mode: "sharePct",
    sharePct: "",
    absoluteTco2e: "",
    reportedCurrentTco2e: "",
    notes: "",
  };
}

function emptyEditor(year = new Date().getFullYear()): EditorState {
  return {
    id: null,
    name: "",
    sbtiTargetId: "",
    baselineYear: String(year - 1),
    targetYear: String(year + 4),
    orgBaselineTco2e: "",
    orgTargetTco2e: "",
    requireExactShares: false,
    status: "draft",
    notes: "",
    allocations: [emptyAllocation()],
  };
}

function cascadeToEditor(c: CascadeDto): EditorState {
  return {
    id: c.id,
    name: c.name,
    sbtiTargetId: c.sbtiTargetId ?? "",
    baselineYear: String(c.baselineYear),
    targetYear: String(c.targetYear),
    orgBaselineTco2e: String(c.orgBaselineTco2e),
    orgTargetTco2e: String(c.orgTargetTco2e),
    requireExactShares: c.requireExactShares,
    status: c.status,
    notes: c.notes ?? "",
    allocations:
      c.allocations.length > 0
        ? c.allocations.map((a) => ({
            key: a.id,
            id: a.id,
            facilityId: a.facilityId,
            ownerId: a.ownerId ?? "",
            mode: a.mode,
            sharePct: a.sharePct !== null ? String(a.sharePct) : "",
            absoluteTco2e: a.absoluteTco2e !== null ? String(a.absoluteTco2e) : "",
            reportedCurrentTco2e:
              a.reportedCurrentTco2e !== null ? String(a.reportedCurrentTco2e) : "",
            notes: a.notes ?? "",
          }))
        : [emptyAllocation()],
  };
}

function qualityClass(q: ProgressQuality): string {
  if (q === "measured") return "text-[color:var(--signal)]";
  if (q === "partial") return "text-[color:var(--amber)]";
  return "text-[color:var(--rust)]";
}

function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function TargetCascadeClient({
  canWrite,
  canDelete,
}: {
  canWrite: boolean;
  canDelete: boolean;
}) {
  const { t } = useI18n();
  const [index, setIndex] = useState<IndexPayload | null>(null);
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editor, setEditor] = useState<EditorState>(() => emptyEditor());

  const load = useCallback(() => {
    startTransition(async () => {
      setError(null);
      try {
        const [cascadeRes, teamRes] = await Promise.all([
          fetch("/api/app/analytics/target-cascade"),
          fetch("/api/app/teammates"),
        ]);
        if (!cascadeRes.ok) {
          const body = (await cascadeRes.json().catch(() => ({}))) as {
            error?: string;
          };
          setError(body.error ?? t("targetCascade.errorLoad"));
          setIndex(null);
          return;
        }
        const data = (await cascadeRes.json()) as IndexPayload;
        setIndex(data);

        if (teamRes.ok) {
          const teamBody = (await teamRes.json()) as { teammates?: Teammate[] };
          setTeammates(teamBody.teammates ?? []);
        }

        if (!creating && selectedId) {
          const found = data.cascades.find((b) => b.cascade.id === selectedId);
          if (found) setEditor(cascadeToEditor(found.cascade));
        }
      } catch {
        setError(t("targetCascade.errorLoad"));
        setIndex(null);
      }
    });
  }, [creating, selectedId, t]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  const selectedBundle = useMemo(() => {
    if (!index || !selectedId) return null;
    return index.cascades.find((b) => b.cascade.id === selectedId) ?? null;
  }, [index, selectedId]);

  const facilityLabel = useCallback(
    (id: string) => {
      const f = index?.facilities.find((x) => x.id === id);
      return f ? `${f.name} (${f.code})` : id;
    },
    [index],
  );

  function startCreate() {
    setCreating(true);
    setSelectedId(null);
    setEditor(emptyEditor());
    setStatus(null);
  }

  function selectCascade(id: string) {
    const found = index?.cascades.find((b) => b.cascade.id === id);
    if (!found) return;
    setCreating(false);
    setSelectedId(id);
    setEditor(cascadeToEditor(found.cascade));
    setStatus(null);
  }

  function applySbti(id: string) {
    const sbti = index?.sbtiTargets.find((s) => s.id === id);
    setEditor((prev) => {
      if (!sbti) {
        return { ...prev, sbtiTargetId: id };
      }
      const target =
        sbti.targetEmissions !== null && sbti.targetEmissions !== undefined
          ? sbti.targetEmissions
          : sbti.reductionPercent !== null
            ? sbti.baselineEmissions * (1 - sbti.reductionPercent / 100)
            : prev.orgTargetTco2e;
      return {
        ...prev,
        sbtiTargetId: id,
        name: prev.name.trim() ? prev.name : sbti.name,
        baselineYear: String(sbti.baselineYear),
        targetYear: String(sbti.targetYear),
        orgBaselineTco2e: String(sbti.baselineEmissions),
        orgTargetTco2e: String(target),
      };
    });
  }

  function updateAllocation(key: string, patch: Partial<AllocationForm>) {
    setEditor((prev) => ({
      ...prev,
      allocations: prev.allocations.map((row) =>
        row.key === key ? { ...row, ...patch } : row,
      ),
    }));
  }

  function buildBody(): Record<string, unknown> {
    return {
      name: editor.name.trim(),
      sbtiTargetId: editor.sbtiTargetId || null,
      baselineYear: Number(editor.baselineYear),
      targetYear: Number(editor.targetYear),
      orgBaselineTco2e: Number(editor.orgBaselineTco2e),
      orgTargetTco2e: Number(editor.orgTargetTco2e),
      requireExactShares: editor.requireExactShares,
      status: editor.status,
      notes: editor.notes.trim() || null,
      allocations: editor.allocations.map((row) => ({
        id: row.id,
        facilityId: row.facilityId,
        ownerId: row.ownerId || null,
        mode: row.mode,
        sharePct: row.mode === "sharePct" ? parseOptionalNumber(row.sharePct) : null,
        absoluteTco2e:
          row.mode === "absolute" ? parseOptionalNumber(row.absoluteTco2e) : null,
        reportedCurrentTco2e: parseOptionalNumber(row.reportedCurrentTco2e),
        notes: row.notes.trim() || null,
      })),
    };
  }

  function save() {
    if (!canWrite) return;
    startTransition(async () => {
      setStatus(null);
      setError(null);
      const body = buildBody();
      const isNew = creating || !editor.id;
      try {
        const res = await fetch(
          isNew
            ? "/api/app/analytics/target-cascade"
            : `/api/app/analytics/target-cascade/${editor.id}`,
          {
            method: isNew ? "POST" : "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          cascade?: CascadeDto;
          progress?: CascadeProgressRollup;
        };
        if (!res.ok) {
          setError(data.error ?? t("targetCascade.actionFailed"));
          return;
        }
        if (!data.cascade) {
          setError(t("targetCascade.actionFailed"));
          return;
        }
        setStatus(isNew ? t("targetCascade.createOk") : t("targetCascade.saveOk"));
        setCreating(false);
        setSelectedId(data.cascade.id);
        setEditor(cascadeToEditor(data.cascade));
        load();
      } catch {
        setError(t("targetCascade.actionFailed"));
      }
    });
  }

  function remove() {
    if (!canDelete || !editor.id || creating) return;
    startTransition(async () => {
      setStatus(null);
      setError(null);
      try {
        const res = await fetch(`/api/app/analytics/target-cascade/${editor.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setError(data.error ?? t("targetCascade.deleteFailed"));
          return;
        }
        setStatus(t("targetCascade.deleteOk"));
        setSelectedId(null);
        setCreating(false);
        setEditor(emptyEditor());
        load();
      } catch {
        setError(t("targetCascade.deleteFailed"));
      }
    });
  }

  if (!index && !error) {
    return <PageSkeleton />;
  }

  if (error && !index) {
    return (
      <div className="space-y-4">
        <StatusLine tone="error">{error}</StatusLine>
        <Button type="button" variant="outline" onClick={load}>
          {t("targetCascade.retry")}
        </Button>
      </div>
    );
  }

  const facilities = index?.facilities ?? [];
  const cascades = index?.cascades ?? [];
  const showEditor = creating || selectedId !== null;

  return (
    <div className="space-y-6">
      {!canWrite ? (
        <p className="text-sm text-[color:var(--ink-muted)]">
          {t("targetCascade.viewOnly")}
        </p>
      ) : null}

      {status ? <StatusLine tone="ok">{status}</StatusLine> : null}
      {error && index ? <StatusLine tone="error">{error}</StatusLine> : null}

      <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--rule)] pb-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={load}
          disabled={pending}
        >
          {t("targetCascade.refresh")}
        </Button>
        {canWrite ? (
          <Button type="button" size="sm" onClick={startCreate} disabled={pending}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            {t("targetCascade.create")}
          </Button>
        ) : null}
        {facilities.length === 0 ? (
          <span className="text-sm text-[color:var(--amber)]">
            {t("targetCascade.noFacilities")}
          </span>
        ) : null}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        <section>
          <h2 className="mb-2 font-[family-name:var(--font-display)] text-lg text-[color:var(--ink)]">
            {t("targetCascade.listTitle")}
          </h2>
          {cascades.length === 0 && !creating ? (
            <EmptyState
              title={t("targetCascade.emptyTitle")}
              body={t("targetCascade.emptyHelp")}
            />
          ) : (
            <ul className="border-t border-[color:var(--rule)]">
              {cascades.map(({ cascade, progress }) => (
                <li key={cascade.id}>
                  <button
                    type="button"
                    onClick={() => selectCascade(cascade.id)}
                    className={cn(
                      "flex w-full flex-col gap-1 border-b border-[color:var(--rule)] px-2 py-3 text-left transition-colors",
                      selectedId === cascade.id && !creating
                        ? "bg-[color:var(--surface-2)]"
                        : "hover:bg-[color:var(--surface-1)]",
                    )}
                  >
                    <span className="text-sm font-medium text-[color:var(--ink)]">
                      {cascade.name}
                    </span>
                    <span className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[color:var(--ink-muted)]">
                      <span>
                        <Mono>
                          {String(cascade.baselineYear)}–{String(cascade.targetYear)}
                        </Mono>
                      </span>
                      <span>
                        {t("targetCascade.rolledProgress")}{" "}
                        <Mono>
                          {progress.rolledProgressPercent === null
                            ? "—"
                            : `${formatNum(progress.rolledProgressPercent, 0)}%`}
                        </Mono>
                      </span>
                      <span className={qualityClass(progress.quality)}>
                        {progress.quality === "measured"
                          ? t("targetCascade.qualityMeasured")
                          : progress.quality === "partial"
                            ? t("targetCascade.qualityPartial")
                            : t("targetCascade.qualityMissing")}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-6">
          {!showEditor ? (
            <p className="text-sm text-[color:var(--ink-muted)]">
              {t("targetCascade.selectHelp")}
            </p>
          ) : (
            <>
              <div className="space-y-4">
                <h2 className="font-[family-name:var(--font-display)] text-lg text-[color:var(--ink)]">
                  {t("targetCascade.editorTitle")}
                </h2>

                <div className="grid gap-3 sm:grid-cols-2">
                  <AppField
                    label={t("targetCascade.fieldName")}
                    value={editor.name}
                    onChange={(e) => setEditor((p) => ({ ...p, name: e.target.value }))}
                    disabled={!canWrite || pending}
                  />
                  <AppSelectNative
                    label={t("targetCascade.fieldStatus")}
                    value={editor.status}
                    onChange={(e) =>
                      setEditor((p) => ({
                        ...p,
                        status: e.target.value as CascadeStatus,
                      }))
                    }
                    disabled={!canWrite || pending}
                  >
                    <option value="draft">{t("targetCascade.statusDraft")}</option>
                    <option value="active">{t("targetCascade.statusActive")}</option>
                    <option value="archived">{t("targetCascade.statusArchived")}</option>
                  </AppSelectNative>
                  <AppField
                    label={t("targetCascade.fieldBaselineYear")}
                    type="number"
                    value={editor.baselineYear}
                    onChange={(e) =>
                      setEditor((p) => ({ ...p, baselineYear: e.target.value }))
                    }
                    disabled={!canWrite || pending}
                  />
                  <AppField
                    label={t("targetCascade.fieldTargetYear")}
                    type="number"
                    value={editor.targetYear}
                    onChange={(e) =>
                      setEditor((p) => ({ ...p, targetYear: e.target.value }))
                    }
                    disabled={!canWrite || pending}
                  />
                  <AppField
                    label={t("targetCascade.fieldOrgBaseline")}
                    type="number"
                    value={editor.orgBaselineTco2e}
                    onChange={(e) =>
                      setEditor((p) => ({
                        ...p,
                        orgBaselineTco2e: e.target.value,
                      }))
                    }
                    disabled={!canWrite || pending}
                  />
                  <AppField
                    label={t("targetCascade.fieldOrgTarget")}
                    type="number"
                    value={editor.orgTargetTco2e}
                    onChange={(e) =>
                      setEditor((p) => ({
                        ...p,
                        orgTargetTco2e: e.target.value,
                      }))
                    }
                    disabled={!canWrite || pending}
                  />
                  <AppSelectNative
                    label={t("targetCascade.fieldSbti")}
                    value={editor.sbtiTargetId}
                    onChange={(e) => applySbti(e.target.value)}
                    disabled={!canWrite || pending}
                  >
                    <option value="">{t("targetCascade.noneSbti")}</option>
                    {(index?.sbtiTargets ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </AppSelectNative>
                  <label className="flex items-end gap-2 pb-2 text-sm text-[color:var(--ink)]">
                    <input
                      type="checkbox"
                      checked={editor.requireExactShares}
                      onChange={(e) =>
                        setEditor((p) => ({
                          ...p,
                          requireExactShares: e.target.checked,
                        }))
                      }
                      disabled={!canWrite || pending}
                      className="h-4 w-4 accent-[color:var(--accent)]"
                    />
                    {t("targetCascade.fieldExactShares")}
                  </label>
                </div>

                <AppField
                  label={t("targetCascade.fieldNotes")}
                  value={editor.notes}
                  onChange={(e) => setEditor((p) => ({ ...p, notes: e.target.value }))}
                  disabled={!canWrite || pending}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-[color:var(--ink)]">
                    {t("targetCascade.allocations")}
                  </h3>
                  {canWrite ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending || facilities.length === 0}
                      onClick={() =>
                        setEditor((p) => ({
                          ...p,
                          allocations: [
                            ...p.allocations,
                            emptyAllocation(facilities[0]?.id ?? ""),
                          ],
                        }))
                      }
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      {t("targetCascade.addRow")}
                    </Button>
                  ) : null}
                </div>

                <div className="overflow-x-auto border-t border-[color:var(--rule)]">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[color:var(--rule)] text-[11px] uppercase tracking-wide text-[color:var(--ink-muted)]">
                        <th className="px-2 py-2 font-medium">
                          {t("targetCascade.facility")}
                        </th>
                        <th className="px-2 py-2 font-medium">
                          {t("targetCascade.owner")}
                        </th>
                        <th className="px-2 py-2 font-medium">
                          {t("targetCascade.mode")}
                        </th>
                        <th className="px-2 py-2 font-medium">
                          {t("targetCascade.sharePct")} / {t("targetCascade.absolute")}
                        </th>
                        <th className="px-2 py-2 font-medium">
                          {t("targetCascade.current")}
                        </th>
                        <th className="px-2 py-2 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {editor.allocations.map((row) => (
                        <tr
                          key={row.key}
                          className="border-b border-[color:var(--rule)] align-top"
                        >
                          <td className="px-2 py-2">
                            <select
                              className="w-full border border-[color:var(--rule)] bg-[color:var(--surface-1)] px-2 py-1.5 text-sm text-[color:var(--ink)]"
                              value={row.facilityId}
                              disabled={!canWrite || pending}
                              onChange={(e) =>
                                updateAllocation(row.key, {
                                  facilityId: e.target.value,
                                })
                              }
                            >
                              <option value="">—</option>
                              {facilities.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.name} ({f.code})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <select
                              className="w-full border border-[color:var(--rule)] bg-[color:var(--surface-1)] px-2 py-1.5 text-sm text-[color:var(--ink)]"
                              value={row.ownerId}
                              disabled={!canWrite || pending}
                              onChange={(e) =>
                                updateAllocation(row.key, {
                                  ownerId: e.target.value,
                                })
                              }
                            >
                              <option value="">{t("targetCascade.noOwner")}</option>
                              {teammates.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name || m.email}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <select
                              className="w-full border border-[color:var(--rule)] bg-[color:var(--surface-1)] px-2 py-1.5 text-sm text-[color:var(--ink)]"
                              value={row.mode}
                              disabled={!canWrite || pending}
                              onChange={(e) =>
                                updateAllocation(row.key, {
                                  mode: e.target.value as AllocationMode,
                                })
                              }
                            >
                              <option value="sharePct">
                                {t("targetCascade.modeShare")}
                              </option>
                              <option value="absolute">
                                {t("targetCascade.modeAbsolute")}
                              </option>
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              className="w-full border border-[color:var(--rule)] bg-[color:var(--surface-1)] px-2 py-1.5 font-[family-name:var(--font-mono)] text-sm tabular-nums text-[color:var(--ink)]"
                              value={
                                row.mode === "sharePct" ? row.sharePct : row.absoluteTco2e
                              }
                              disabled={!canWrite || pending}
                              onChange={(e) =>
                                updateAllocation(
                                  row.key,
                                  row.mode === "sharePct"
                                    ? { sharePct: e.target.value }
                                    : { absoluteTco2e: e.target.value },
                                )
                              }
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              placeholder={t("targetCascade.currentHint")}
                              className="w-full border border-[color:var(--rule)] bg-[color:var(--surface-1)] px-2 py-1.5 font-[family-name:var(--font-mono)] text-sm tabular-nums text-[color:var(--ink)] placeholder:text-[color:var(--ink-muted)]"
                              value={row.reportedCurrentTco2e}
                              disabled={!canWrite || pending}
                              onChange={(e) =>
                                updateAllocation(row.key, {
                                  reportedCurrentTco2e: e.target.value,
                                })
                              }
                            />
                          </td>
                          <td className="px-2 py-2">
                            {canWrite && editor.allocations.length > 1 ? (
                              <button
                                type="button"
                                className="text-[color:var(--ink-muted)] hover:text-[color:var(--rust)]"
                                disabled={pending}
                                aria-label={t("targetCascade.delete")}
                                onClick={() =>
                                  setEditor((p) => ({
                                    ...p,
                                    allocations: p.allocations.filter(
                                      (a) => a.key !== row.key,
                                    ),
                                  }))
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {canWrite ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={save} disabled={pending}>
                    {pending ? t("targetCascade.working") : t("targetCascade.save")}
                  </Button>
                  {canDelete && editor.id && !creating ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={remove}
                      disabled={pending}
                    >
                      {t("targetCascade.delete")}
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {selectedBundle && !creating ? (
                <div className="space-y-3 border-t border-[color:var(--rule)] pt-4">
                  <h3 className="font-[family-name:var(--font-display)] text-base text-[color:var(--ink)]">
                    {t("targetCascade.progressTitle")}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-4 text-sm">
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-[color:var(--ink-muted)]">
                        {t("targetCascade.shareSum")}
                      </div>
                      <div>
                        <Mono>{formatNum(selectedBundle.cascade.shareSumPct, 1)}%</Mono>
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-[color:var(--ink-muted)]">
                        {t("targetCascade.allocated")}
                      </div>
                      <div>
                        <Mono>
                          {formatNum(selectedBundle.cascade.allocatedTargetTco2e)}
                        </Mono>
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-[color:var(--ink-muted)]">
                        {t("targetCascade.unallocated")}
                      </div>
                      <div>
                        <Mono>
                          {formatNum(selectedBundle.cascade.unallocatedTargetTco2e)}
                        </Mono>
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-[color:var(--ink-muted)]">
                        {t("targetCascade.rolledProgress")}
                      </div>
                      <div className={qualityClass(selectedBundle.progress.quality)}>
                        <Mono>
                          {selectedBundle.progress.rolledProgressPercent === null
                            ? "—"
                            : `${formatNum(selectedBundle.progress.rolledProgressPercent, 0)}%`}
                        </Mono>
                      </div>
                    </div>
                  </div>
                  {selectedBundle.progress.message ? (
                    <p className="text-sm text-[color:var(--ink-muted)]">
                      {selectedBundle.progress.message}
                    </p>
                  ) : null}
                  <div className="overflow-x-auto border-t border-[color:var(--rule)]">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[color:var(--rule)] text-[11px] uppercase tracking-wide text-[color:var(--ink-muted)]">
                          <th className="px-2 py-2 font-medium">
                            {t("targetCascade.facility")}
                          </th>
                          <th className="px-2 py-2 font-medium">
                            {t("targetCascade.resolvedTarget")}
                          </th>
                          <th className="px-2 py-2 font-medium">
                            {t("targetCascade.current")}
                          </th>
                          <th className="px-2 py-2 font-medium">
                            {t("targetCascade.rolledProgress")}
                          </th>
                          <th className="px-2 py-2 font-medium">
                            {t("targetCascade.quality")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedBundle.progress.children.map((c) => (
                          <tr
                            key={c.allocationId}
                            className="border-b border-[color:var(--rule)]"
                          >
                            <td className="px-2 py-2">{facilityLabel(c.facilityId)}</td>
                            <td className="px-2 py-2">
                              <Mono>{formatNum(c.targetTco2e)}</Mono>
                            </td>
                            <td className="px-2 py-2">
                              <Mono>
                                {c.currentTco2e === null
                                  ? "—"
                                  : formatNum(c.currentTco2e)}
                              </Mono>
                            </td>
                            <td className="px-2 py-2">
                              <Mono>
                                {c.progressTowardTargetPercent === null
                                  ? "—"
                                  : `${formatNum(c.progressTowardTargetPercent, 0)}%`}
                              </Mono>
                            </td>
                            <td
                              className={cn(
                                "px-2 py-2",
                                c.quality === "measured"
                                  ? "text-[color:var(--signal)]"
                                  : "text-[color:var(--rust)]",
                              )}
                            >
                              {c.quality === "measured"
                                ? t("targetCascade.qualityMeasured")
                                : t("targetCascade.qualityMissing")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
