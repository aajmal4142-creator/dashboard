"use client";

import { useCallback, useEffect, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2, UserPlus, X } from "lucide-react";

import {
  EmptyState,
  PageFrame,
  PageSkeleton,
  StatusLine,
} from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { AppField, AppSelectNative } from "@/components/ui/AppField";
import {
  CAMPAIGN_GOAL_TYPE_LABELS,
  CAMPAIGN_STATUSES,
  CAMPAIGN_STATUS_LABELS,
  SURVEY_MODE_LABELS,
  SURVEY_MODES,
  type CampaignGoalType,
  type CampaignStatus,
  type EngagementCampaignDto,
  type SurveyMode,
} from "@/lib/engagement";
import { cn } from "@/lib/utils";

type ListPayload = {
  campaigns: EngagementCampaignDto[];
  canWrite?: boolean;
  canDelete?: boolean;
  error?: string;
};

type FormState = {
  title: string;
  status: CampaignStatus;
  startDate: string;
  endDate: string;
  goalType: CampaignGoalType;
  goalValue: string;
  achievedTco2e: string;
  linkCommuteChallenge: boolean;
  description: string;
  surveyMode: SurveyMode;
};

function emptyForm(): FormState {
  return {
    title: "",
    status: "draft",
    startDate: "",
    endDate: "",
    goalType: "participants",
    goalValue: "",
    achievedTco2e: "",
    linkCommuteChallenge: false,
    description: "",
    surveyMode: "none",
  };
}

function formatNum(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("font-[family-name:var(--font-mono)] tabular-nums", className)}>
      {children}
    </span>
  );
}

function statusClass(status: CampaignStatus): string {
  if (status === "completed") return "text-[color:var(--signal)]";
  if (status === "active") return "text-[color:var(--cobalt)]";
  if (status === "cancelled") return "text-[color:var(--ink-muted)]";
  return "text-[color:var(--amber)]";
}

function ProgressBar({ campaign }: { campaign: EngagementCampaignDto }) {
  const { progress } = campaign;
  const width =
    progress.quality === "measured" && progress.percent !== null
      ? Math.min(100, Math.max(0, progress.percent))
      : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[color:var(--ink-muted)]">
          Progress
        </p>
        <p className="text-[12px] text-[color:var(--ink-muted)]">
          {progress.quality === "measured" && progress.percent !== null ? (
            <>
              <Mono className="text-[color:var(--ink)]">
                {formatNum(progress.percent, 1)}
              </Mono>
              {"%"}
            </>
          ) : (
            <span className="text-[color:var(--amber)]">Missing goal</span>
          )}
        </p>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-[2px] bg-[color:var(--surface-2)]"
        role="img"
        aria-label={
          progress.percent !== null
            ? `${progress.percent}% progress`
            : "Progress unavailable — goal missing"
        }
      >
        <div
          className={cn(
            "h-full rounded-[2px]",
            progress.quality === "measured"
              ? "bg-[color:var(--accent)]"
              : "bg-[color:var(--rule)]",
          )}
          style={{ width: `${width}%` }}
        />
      </div>
      {progress.message ? (
        <p className="text-[11px] text-[color:var(--ink-muted)]">{progress.message}</p>
      ) : null}
    </div>
  );
}

function PublicSurveyLink({
  token,
  responseCount,
}: {
  token: string | null;
  responseCount: number;
}) {
  const [copied, setCopied] = useState(false);
  if (!token) {
    return (
      <p className="text-[12px] text-[color:var(--amber)]">
        Survey link is being generated — refresh in a moment.
      </p>
    );
  }
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/e/${token}`
      : `/e/${token}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — link is still visible to copy manually */
    }
  }

  return (
    <div className="space-y-1.5 border-t border-[color:var(--rule)] pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[color:var(--ink-muted)]">
        Public survey link
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="flex-1 break-all rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--surface-2)] px-2 py-1 text-[12px] text-[color:var(--ink)]">
          {url}
        </code>
        <Button type="button" size="sm" variant="outline" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="text-[12px] text-[color:var(--ink-muted)]">
        <Mono>{formatNum(responseCount, 0)}</Mono> survey responses recorded.
      </p>
    </div>
  );
}

export function EngagementClient(props: {
  orgName: string;
  canWrite: boolean;
  canDelete: boolean;
  eyebrow: string;
  title: string;
  help: string;
}) {
  const [payload, setPayload] = useState<ListPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    startTransition(async () => {
      setError(null);
      try {
        const qs = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
        const res = await fetch(`/api/app/engagement/campaigns${qs}`);
        const json = (await res.json()) as ListPayload;
        if (!res.ok) {
          setError(json.error ?? "Could not load campaigns");
          setPayload(null);
          return;
        }
        setPayload(json);
        if (selectedId && !json.campaigns.some((c) => c.id === selectedId)) {
          setSelectedId(null);
        }
      } catch {
        setError("Network error loading campaigns. Retry.");
        setPayload(null);
      }
    });
  }, [statusFilter, selectedId]);

  useEffect(() => {
    load();
  }, [load]);

  const canWrite = payload?.canWrite ?? props.canWrite;
  const canDelete = payload?.canDelete ?? props.canDelete;
  const selected = payload?.campaigns.find((c) => c.id === selectedId) ?? null;

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(campaign: EngagementCampaignDto) {
    setEditingId(campaign.id);
    setForm({
      title: campaign.title,
      status: campaign.status,
      startDate: campaign.startDate ?? "",
      endDate: campaign.endDate ?? "",
      goalType: campaign.goalType,
      goalValue: campaign.goalValue === null ? "" : String(campaign.goalValue),
      achievedTco2e:
        campaign.achievedTco2e === null ? "" : String(campaign.achievedTco2e),
      linkCommuteChallenge: campaign.linkCommuteChallenge,
      description: campaign.description ?? "",
      surveyMode: campaign.surveyMode,
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function saveCampaign() {
    setFormError(null);
    if (!form.title.trim()) {
      setFormError("Title is required.");
      return;
    }

    let goalValue: number | null = null;
    if (form.goalValue.trim() !== "") {
      const n = Number(form.goalValue);
      if (!Number.isFinite(n) || n < 0) {
        setFormError("Goal must be a non-negative number when provided.");
        return;
      }
      goalValue = n;
    }

    let achievedTco2e: number | null = null;
    if (form.achievedTco2e.trim() !== "") {
      const n = Number(form.achievedTco2e);
      if (!Number.isFinite(n) || n < 0) {
        setFormError("Achieved tCO₂e must be a non-negative number when provided.");
        return;
      }
      achievedTco2e = n;
    }

    const body = {
      title: form.title.trim(),
      status: form.status,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      goalType: form.goalType,
      goalValue,
      achievedTco2e,
      linkCommuteChallenge: form.linkCommuteChallenge,
      description: form.description.trim() || null,
      surveyMode: form.surveyMode,
    };

    const url = editingId
      ? `/api/app/engagement/campaigns/${editingId}`
      : "/api/app/engagement/campaigns";
    const method = editingId ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        campaign?: EngagementCampaignDto;
        error?: string;
      };
      if (!res.ok) {
        setFormError(json.error ?? "Could not save campaign");
        return;
      }
      setFormOpen(false);
      setActionMsg(editingId ? "Campaign saved." : "Campaign created.");
      if (json.campaign) setSelectedId(json.campaign.id);
      load();
    } catch {
      setFormError("Network error saving campaign. Retry.");
    }
  }

  async function deleteCampaign(id: string) {
    if (!canDelete) return;
    try {
      const res = await fetch(`/api/app/engagement/campaigns/${id}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setActionMsg(json.error ?? "Could not delete campaign");
        return;
      }
      if (selectedId === id) setSelectedId(null);
      setActionMsg("Campaign deleted.");
      load();
    } catch {
      setActionMsg("Network error deleting campaign. Retry.");
    }
  }

  async function recordParticipation(id: string) {
    if (!canWrite) return;
    try {
      const res = await fetch(`/api/app/engagement/campaigns/${id}/participate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 1 }),
      });
      const json = (await res.json()) as {
        campaign?: EngagementCampaignDto;
        error?: string;
      };
      if (!res.ok) {
        setActionMsg(json.error ?? "Could not record participation");
        return;
      }
      setActionMsg("Participation recorded.");
      load();
    } catch {
      setActionMsg("Network error recording participation. Retry.");
    }
  }

  if (!payload && !error) {
    return (
      <PageFrame eyebrow={props.eyebrow} title={props.title} help={props.help}>
        <PageSkeleton rows={6} />
      </PageFrame>
    );
  }

  if (error && !payload) {
    return (
      <PageFrame eyebrow={props.eyebrow} title={props.title} help={props.help}>
        <StatusLine tone="error">{error}</StatusLine>
        <Button type="button" variant="outline" className="mt-4" onClick={load}>
          Retry
        </Button>
      </PageFrame>
    );
  }

  const campaigns = payload?.campaigns ?? [];

  return (
    <PageFrame
      eyebrow={props.eyebrow}
      title={props.title}
      help={props.help}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <AppSelectNative
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="min-w-[8rem]"
          >
            <option value="">All statuses</option>
            {CAMPAIGN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CAMPAIGN_STATUS_LABELS[s]}
              </option>
            ))}
          </AppSelectNative>
          <Button type="button" variant="outline" onClick={load} disabled={pending}>
            Refresh
          </Button>
          {canWrite ? (
            <Button type="button" onClick={openCreate}>
              <Plus className="size-3.5" aria-hidden />
              New campaign
            </Button>
          ) : null}
        </div>
      }
    >
      <p className="mb-4 text-[12px] text-[color:var(--ink-muted)]">
        Organisation: {props.orgName}
      </p>
      {!canWrite ? (
        <StatusLine tone="neutral">
          View only — ask a contributor or admin to edit campaigns.
        </StatusLine>
      ) : null}

      {actionMsg ? <StatusLine tone="ok">{actionMsg}</StatusLine> : null}
      {error ? <StatusLine tone="error">{error}</StatusLine> : null}

      {formOpen ? (
        <div className="mb-6 border border-[color:var(--rule)] bg-[color:var(--surface-1)] p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[color:var(--ink)]">
              {editingId ? "Edit campaign" : "New campaign"}
            </h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFormOpen(false)}
              aria-label="Close form"
            >
              <X className="size-4" />
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <AppField
              label="Title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
            <AppSelectNative
              label="Status"
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  status: e.target.value as CampaignStatus,
                }))
              }
            >
              {CAMPAIGN_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CAMPAIGN_STATUS_LABELS[s]}
                </option>
              ))}
            </AppSelectNative>
            <AppField
              label="Start date"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            />
            <AppField
              label="End date"
              type="date"
              value={form.endDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
            />
            <AppSelectNative
              label="Goal type"
              value={form.goalType}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  goalType: e.target.value as CampaignGoalType,
                }))
              }
            >
              <option value="participants">
                {CAMPAIGN_GOAL_TYPE_LABELS.participants}
              </option>
              <option value="tco2e">{CAMPAIGN_GOAL_TYPE_LABELS.tco2e}</option>
            </AppSelectNative>
            <AppField
              label="Goal value"
              type="number"
              min={0}
              step="any"
              className="font-[family-name:var(--font-mono)]"
              placeholder="Leave blank if unset"
              value={form.goalValue}
              onChange={(e) => setForm((f) => ({ ...f, goalValue: e.target.value }))}
            />
            {form.goalType === "tco2e" ? (
              <AppField
                label="Achieved tCO₂e"
                type="number"
                min={0}
                step="any"
                className="font-[family-name:var(--font-mono)]"
                placeholder="Leave blank if unknown"
                value={form.achievedTco2e}
                onChange={(e) =>
                  setForm((f) => ({ ...f, achievedTco2e: e.target.value }))
                }
              />
            ) : null}
            <AppField
              label="Description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
            <AppSelectNative
              label="Public survey"
              value={form.surveyMode}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  surveyMode: e.target.value as SurveyMode,
                }))
              }
            >
              {SURVEY_MODES.map((m) => (
                <option key={m} value={m}>
                  {SURVEY_MODE_LABELS[m]}
                </option>
              ))}
            </AppSelectNative>
          </div>
          <label className="mt-3 flex items-center gap-2 text-[13px] text-[color:var(--ink)]">
            <input
              type="checkbox"
              checked={form.linkCommuteChallenge}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  linkCommuteChallenge: e.target.checked,
                }))
              }
              className="size-3.5 accent-[color:var(--accent)]"
            />
            Link commute challenge to Scope 3 travel &amp; commute
          </label>
          {formError ? <StatusLine tone="error">{formError}</StatusLine> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={saveCampaign}>
              {editingId ? "Save" : "Create"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {campaigns.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          body="Create a draft climate-action campaign with a participant or tCO₂e goal. Record participation as people join."
          action={
            canWrite ? (
              <Button type="button" onClick={openCreate}>
                <Plus className="size-3.5" aria-hidden />
                New campaign
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="overflow-x-auto border-t border-[color:var(--rule)]">
            <table className="w-full min-w-[36rem] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[color:var(--rule)] text-[10px] font-semibold uppercase tracking-[0.06em] text-[color:var(--ink-muted)]">
                  <th className="py-2 pr-3 font-medium">Campaign</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Participants</th>
                  <th className="py-2 pr-3 font-medium">Progress</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr
                    key={c.id}
                    className={cn(
                      "cursor-pointer border-b border-[color:var(--rule)] transition-colors",
                      selectedId === c.id
                        ? "bg-[color:var(--surface-2)]"
                        : "hover:bg-[color:var(--surface-1)]",
                    )}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <td className="py-2.5 pr-3">
                      <p className="font-medium text-[color:var(--ink)]">{c.title}</p>
                      <p className="text-[11px] text-[color:var(--ink-muted)]">
                        {CAMPAIGN_GOAL_TYPE_LABELS[c.goalType]}
                        {c.goalValue !== null ? (
                          <>
                            {" · goal "}
                            <Mono>{formatNum(c.goalValue)}</Mono>
                          </>
                        ) : (
                          " · no goal"
                        )}
                      </p>
                    </td>
                    <td className={cn("py-2.5 pr-3", statusClass(c.status))}>
                      {CAMPAIGN_STATUS_LABELS[c.status]}
                    </td>
                    <td className="py-2.5 pr-3">
                      <Mono>{formatNum(c.participantCount, 0)}</Mono>
                    </td>
                    <td className="py-2.5 pr-3">
                      {c.progress.percent !== null ? (
                        <Mono>{formatNum(c.progress.percent, 1)}%</Mono>
                      ) : (
                        <span className="text-[color:var(--amber)]">Missing</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border border-[color:var(--rule)] bg-[color:var(--surface-1)] p-4">
            {selected ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">
                      Selected
                    </p>
                    <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl text-[color:var(--ink)]">
                      {selected.title}
                    </h2>
                    <p className={cn("mt-1 text-[12px]", statusClass(selected.status))}>
                      {CAMPAIGN_STATUS_LABELS[selected.status]}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {canWrite && selected.status !== "cancelled" ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => recordParticipation(selected.id)}
                      >
                        <UserPlus className="size-3.5" aria-hidden />
                        Record +1
                      </Button>
                    ) : null}
                    {canWrite ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(selected)}
                      >
                        <Pencil className="size-3.5" aria-hidden />
                        Edit
                      </Button>
                    ) : null}
                    {canDelete ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => deleteCampaign(selected.id)}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                        Delete
                      </Button>
                    ) : null}
                  </div>
                </div>

                <ProgressBar campaign={selected} />

                <dl className="grid gap-2 text-[13px] sm:grid-cols-2">
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[color:var(--ink-muted)]">
                      Participants
                    </dt>
                    <dd>
                      <Mono>{formatNum(selected.participantCount, 0)}</Mono>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[color:var(--ink-muted)]">
                      Goal
                    </dt>
                    <dd>
                      {selected.goalValue !== null ? (
                        <>
                          <Mono>{formatNum(selected.goalValue)}</Mono>{" "}
                          {CAMPAIGN_GOAL_TYPE_LABELS[selected.goalType]}
                        </>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[color:var(--ink-muted)]">
                      Dates
                    </dt>
                    <dd className="text-[color:var(--ink-muted)]">
                      <Mono>{selected.startDate ?? "—"}</Mono>
                      {" → "}
                      <Mono>{selected.endDate ?? "—"}</Mono>
                    </dd>
                  </div>
                  {selected.goalType === "tco2e" ? (
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[color:var(--ink-muted)]">
                        Achieved tCO₂e
                      </dt>
                      <dd>
                        <Mono>{formatNum(selected.achievedTco2e)}</Mono>
                      </dd>
                    </div>
                  ) : null}
                </dl>

                {selected.description ? (
                  <p className="text-[13px] text-[color:var(--ink-muted)]">
                    {selected.description}
                  </p>
                ) : null}

                {selected.status === "active" && selected.surveyMode === "commute" ? (
                  <PublicSurveyLink
                    token={selected.publicToken}
                    responseCount={selected.surveyResponseCount}
                  />
                ) : null}

                {selected.linkCommuteChallenge ? (
                  <p className="text-[13px]">
                    <Link
                      href="/scope3/travel"
                      className="text-[color:var(--accent)] underline-offset-2 hover:underline"
                    >
                      Open Scope 3 travel &amp; commute metrics
                    </Link>
                    <span className="text-[color:var(--ink-muted)]">
                      {" "}
                      for this commute challenge.
                    </span>
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-[13px] text-[color:var(--ink-muted)]">
                Select a campaign to see progress and record participation.
              </p>
            )}
          </div>
        </div>
      )}
    </PageFrame>
  );
}
