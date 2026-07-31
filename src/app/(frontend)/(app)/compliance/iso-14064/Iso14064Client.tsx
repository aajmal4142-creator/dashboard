"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { CheckSquare, ChevronDown, ChevronRight, UserCheck } from "lucide-react";

import { EmptyState, StatusLine } from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ItemStatus = "not_started" | "in_progress" | "completed" | "na";
type ChecklistStatus = "not_started" | "in_progress" | "completed";
type Part = "part1" | "part2";
type AutoLinkHint =
  "none" | "csrd_report" | "datapoints" | "audit_logs" | "emission_factors";

type SectionRow = {
  id: string;
  itemKey: string;
  sectionNumber: string;
  part: Part;
  requirement: string;
  description: string | null;
  status: ItemStatus;
  evidenceIds: string[];
  notes: string | null;
  completedAt: string | null;
  autoLinkHint: AutoLinkHint;
};

type Progress = {
  total: number;
  applicable: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  na: number;
  percentComplete: number;
  label: string;
  checklistStatus: ChecklistStatus;
};

type Checklist = {
  id: string;
  status: ChecklistStatus;
  sections: SectionRow[];
  part1: SectionRow[];
  part2: SectionRow[];
  verifierAssigned: { id: string; email: string; name: string } | null;
  assurancePartnerId: string | null;
  lastReviewDate: string | null;
  nextReviewDate: string | null;
  complianceScore: number;
  progress: Progress;
  verifierNoticeSentAt: string | null;
};

type EvidenceOption = {
  id: string;
  filename: string;
  uploadedAt: string | null;
};

type Teammate = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type PartnerOption = {
  id: string;
  firmName: string;
};

function statusLabel(s: ItemStatus): string {
  if (s === "completed") return "Completed";
  if (s === "in_progress") return "In progress";
  if (s === "na") return "N/A";
  return "Not started";
}

function autoLinkLabel(hint: AutoLinkHint): string | null {
  if (hint === "csrd_report") return "Suggest: CSRD / report artefacts";
  if (hint === "datapoints") return "Suggest: activity datapoints";
  if (hint === "audit_logs") return "Suggest: audit logs";
  if (hint === "emission_factors") return "Suggest: emission factor registry";
  return null;
}

function ProgressBar({ progress }: { progress: Progress }) {
  const width = Math.max(0, Math.min(100, progress.percentComplete));
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-[family-name:var(--font-mono)] text-sm tabular-nums text-[color:var(--ink)]">
          {progress.label}
        </p>
        <p className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
          {progress.checklistStatus.replace("_", " ")}
        </p>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-[2px] bg-[color:var(--surface-2)]"
        role="progressbar"
        aria-valuenow={progress.percentComplete}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={progress.label}
      >
        <div
          className="h-full bg-[color:var(--accent)] transition-[width] duration-300"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function ItemRow({
  item,
  evidenceOptions,
  pending,
  onSave,
}: {
  item: SectionRow;
  evidenceOptions: EvidenceOption[];
  pending: boolean;
  onSave: (args: {
    itemId: string;
    status: ItemStatus;
    evidenceIds: string[];
    notes: string;
  }) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<ItemStatus>(item.status);
  const [evidenceIds, setEvidenceIds] = useState<string[]>(item.evidenceIds);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  const hint = autoLinkLabel(item.autoLinkHint);
  const completeBlocked = status === "completed" && evidenceIds.length === 0;

  return (
    <li className="border-b border-[color:var(--rule)] last:border-b-0">
      <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
        <button
          type="button"
          className="flex flex-1 items-start gap-2 text-left"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <span className="mt-0.5 text-[color:var(--ink-muted)]">
            {expanded ? (
              <ChevronDown className="h-4 w-4" aria-hidden />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden />
            )}
          </span>
          <span>
            <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-[color:var(--ink-muted)]">
              {item.sectionNumber}
            </span>
            <span className="ml-2 text-sm text-[color:var(--ink)]">
              {item.status === "completed" ? "☑" : "☐"} {item.requirement}
            </span>
            {item.description && expanded ? (
              <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
                {item.description}
              </p>
            ) : null}
            {hint ? (
              <p className="mt-1 text-xs text-[color:var(--cobalt)]">{hint}</p>
            ) : null}
          </span>
        </button>
        <div className="flex flex-wrap items-center gap-2 pl-6 sm:pl-0">
          <span
            className={cn(
              "rounded-[2px] border px-2 py-0.5 text-xs",
              item.status === "completed"
                ? "border-[color:var(--signal)] text-[color:var(--signal)]"
                : item.status === "in_progress"
                  ? "border-[color:var(--amber)] text-[color:var(--amber)]"
                  : "border-[color:var(--rule)] text-[color:var(--ink-muted)]",
            )}
          >
            {statusLabel(item.status)}
          </span>
          <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-[color:var(--ink-muted)]">
            {item.evidenceIds.length} evidence
          </span>
        </div>
      </div>

      {expanded ? (
        <div className="mb-3 space-y-3 border-t border-[color:var(--rule)] bg-[color:var(--surface-1)] px-3 py-3 pl-8">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-[color:var(--ink-muted)]">
              Status
              <select
                className="mt-1 w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 text-sm text-[color:var(--ink)]"
                value={status}
                onChange={(e) => setStatus(e.target.value as ItemStatus)}
                disabled={pending}
              >
                <option value="not_started">Not started</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
                <option value="na">N/A</option>
              </select>
            </label>
            <label className="block text-xs text-[color:var(--ink-muted)]">
              Evidence
              <select
                multiple
                className="mt-1 h-24 w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 text-sm text-[color:var(--ink)]"
                value={evidenceIds}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions).map(
                    (o) => o.value,
                  );
                  setEvidenceIds(selected);
                }}
                disabled={pending}
              >
                {evidenceOptions.length === 0 ? (
                  <option value="" disabled>
                    No evidence uploaded yet
                  </option>
                ) : (
                  evidenceOptions.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.filename}
                    </option>
                  ))
                )}
              </select>
              <span className="mt-1 block text-[10px] text-[color:var(--ink-muted)]">
                Hold Ctrl/Cmd to select multiple. Required when marking complete.
              </span>
            </label>
          </div>
          <label className="block text-xs text-[color:var(--ink-muted)]">
            Notes
            <textarea
              className="mt-1 w-full rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 text-sm text-[color:var(--ink)]"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={pending}
            />
          </label>
          {completeBlocked || localError ? (
            <p className="text-xs text-[color:var(--rust)]" role="alert">
              {localError ?? "Attach at least one evidence link before marking complete."}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending || completeBlocked}
              onClick={() => {
                setLocalError(null);
                if (status === "completed" && evidenceIds.length === 0) {
                  setLocalError(
                    "Attach at least one evidence link before marking complete.",
                  );
                  return;
                }
                onSave({
                  itemId: item.id || item.itemKey,
                  status,
                  evidenceIds,
                  notes,
                });
              }}
            >
              Save item
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function PartSection({
  title,
  subtitle,
  items,
  evidenceOptions,
  pending,
  defaultOpen,
  onSave,
}: {
  title: string;
  subtitle: string;
  items: SectionRow[];
  evidenceOptions: EvidenceOption[];
  pending: boolean;
  defaultOpen: boolean;
  onSave: (args: {
    itemId: string;
    status: ItemStatus;
    evidenceIds: string[];
    notes: string;
  }) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const done = items.filter((i) => i.status === "completed").length;

  return (
    <section className="rounded-[6px] border border-[color:var(--rule)]">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg text-[color:var(--ink)]">
            {title}
          </h2>
          <p className="text-xs text-[color:var(--ink-muted)]">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-[color:var(--ink-muted)]">
            {done}/{items.length}
          </span>
          {open ? (
            <ChevronDown className="h-4 w-4 text-[color:var(--ink-muted)]" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[color:var(--ink-muted)]" />
          )}
        </div>
      </button>
      {open ? (
        <ul className="border-t border-[color:var(--rule)] px-4">
          {items.map((item) => (
            <ItemRow
              key={item.itemKey}
              item={item}
              evidenceOptions={evidenceOptions}
              pending={pending}
              onSave={onSave}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function Iso14064Client({ orgName }: { orgName: string }) {
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [evidenceOptions, setEvidenceOptions] = useState<EvidenceOption[]>([]);
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);
  const [verifierId, setVerifierId] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [verifierMsg, setVerifierMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/app/compliance/iso-14064");
        const data = (await res.json()) as {
          checklist?: Checklist | null;
          error?: string;
        };
        if (!res.ok) {
          setError(data.error ?? "Failed to load checklist");
          setLoaded(true);
          return;
        }
        const cl = data.checklist ?? null;
        setChecklist(cl);

        if (cl) {
          const detail = await fetch(`/api/app/compliance/iso-14064/${cl.id}`);
          const detailData = (await detail.json()) as {
            evidenceOptions?: EvidenceOption[];
            checklist?: Checklist;
          };
          if (detail.ok) {
            if (detailData.checklist) setChecklist(detailData.checklist);
            setEvidenceOptions(detailData.evidenceOptions ?? []);
            if (detailData.checklist?.verifierAssigned) {
              setVerifierId(detailData.checklist.verifierAssigned.id);
            }
            if (detailData.checklist?.assurancePartnerId) {
              setPartnerId(detailData.checklist.assurancePartnerId);
            }
          }
        }

        const [tmRes, apRes] = await Promise.all([
          fetch("/api/app/teammates"),
          fetch("/api/app/assurance-partners"),
        ]);
        if (tmRes.ok) {
          const tm = (await tmRes.json()) as { teammates?: Teammate[] };
          setTeammates(tm.teammates ?? []);
        }
        if (apRes.ok) {
          const ap = (await apRes.json()) as {
            partners?: Array<{ id: string; name?: string; firmName?: string }>;
          };
          const list = ap.partners ?? [];
          setPartners(
            list.map((p) => ({
              id: p.id,
              firmName: p.firmName ?? p.name ?? p.id,
            })),
          );
        }
      } catch {
        setError("Failed to load ISO 14064 checklist");
      } finally {
        setLoaded(true);
      }
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createChecklist = () => {
    startTransition(async () => {
      setError(null);
      const res = await fetch("/api/app/compliance/iso-14064", {
        method: "POST",
      });
      const data = (await res.json()) as {
        checklist?: Checklist;
        error?: string;
      };
      if (!res.ok && res.status !== 409) {
        setError(data.error ?? "Could not create checklist");
        return;
      }
      load();
    });
  };

  const saveItem = (args: {
    itemId: string;
    status: ItemStatus;
    evidenceIds: string[];
    notes: string;
  }) => {
    if (!checklist) return;
    startTransition(async () => {
      setError(null);
      const res = await fetch(
        `/api/app/compliance/iso-14064/${checklist.id}/items/${encodeURIComponent(args.itemId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: args.status,
            evidenceIds: args.evidenceIds,
            notes: args.notes,
          }),
        },
      );
      const data = (await res.json()) as {
        checklist?: Checklist;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not update item");
        return;
      }
      if (data.checklist) setChecklist(data.checklist);
    });
  };

  const assignVerifier = () => {
    if (!checklist || !verifierId) {
      setVerifierMsg("Select a teammate to assign as verifier.");
      return;
    }
    startTransition(async () => {
      setVerifierMsg(null);
      setError(null);
      const res = await fetch(`/api/app/compliance/iso-14064/${checklist.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verifierUserId: verifierId,
          assurancePartnerId: partnerId || null,
          sendNotice: true,
        }),
      });
      const data = (await res.json()) as {
        checklist?: Checklist;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not assign verifier");
        return;
      }
      if (data.checklist) setChecklist(data.checklist);
      setVerifierMsg(`Verifier assigned for ${orgName}. Notice sent.`);
    });
  };

  if (!loaded && pending) {
    return <StatusLine>Loading ISO 14064 checklist…</StatusLine>;
  }

  if (error && !checklist) {
    return (
      <div className="space-y-3">
        <StatusLine tone="error">{error}</StatusLine>
        <Button type="button" onClick={load}>
          Retry
        </Button>
      </div>
    );
  }

  if (!checklist) {
    return (
      <EmptyState
        title="No ISO 14064 checklist yet"
        body="Create a checklist seeded with 30 Part 1 and Part 2 requirements from the catalog. Requirements are not hardcoded in this page."
        action={
          <Button type="button" onClick={createChecklist} disabled={pending}>
            <CheckSquare className="mr-2 h-4 w-4" aria-hidden />
            Create checklist
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {error ? <StatusLine tone="error">{error}</StatusLine> : null}
      {pending ? <StatusLine>Saving…</StatusLine> : null}

      <div className="rounded-[6px] border border-[color:var(--rule)] p-4">
        <ProgressBar progress={checklist.progress} />
        {checklist.nextReviewDate ? (
          <p className="mt-3 text-xs text-[color:var(--ink-muted)]">
            Next review:{" "}
            <span className="font-[family-name:var(--font-mono)] tabular-nums">
              {checklist.nextReviewDate.slice(0, 10)}
            </span>
          </p>
        ) : null}
      </div>

      <div className="rounded-[6px] border border-[color:var(--rule)] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[color:var(--ink)]">
              Assign verifier
            </h2>
            <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
              Select an active teammate as third-party auditor. Optionally link an
              assurance partner firm and send a notice.
            </p>
            {checklist.verifierAssigned ? (
              <p className="mt-2 text-sm text-[color:var(--ink)]">
                Current:{" "}
                {checklist.verifierAssigned.name ||
                  checklist.verifierAssigned.email ||
                  checklist.verifierAssigned.id}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="block text-xs text-[color:var(--ink-muted)]">
              Teammate
              <select
                className="mt-1 block min-w-[12rem] rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 text-sm text-[color:var(--ink)]"
                value={verifierId}
                onChange={(e) => setVerifierId(e.target.value)}
                disabled={pending}
              >
                <option value="">Select…</option>
                {teammates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name || t.email} ({t.role})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-[color:var(--ink-muted)]">
              Assurance partner
              <select
                className="mt-1 block min-w-[12rem] rounded-[4px] border border-[color:var(--rule)] bg-[color:var(--canvas)] px-2 py-1.5 text-sm text-[color:var(--ink)]"
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
                disabled={pending}
              >
                <option value="">None</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firmName}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              onClick={assignVerifier}
              disabled={pending || !verifierId}
            >
              <UserCheck className="mr-2 h-4 w-4" aria-hidden />
              Assign + notify
            </Button>
          </div>
        </div>
        {verifierMsg ? (
          <p className="mt-2 text-xs text-[color:var(--signal)]">{verifierMsg}</p>
        ) : null}
      </div>

      <PartSection
        title="Part 1 — Organisation GHG"
        subtitle="ISO 14064-1: design, quantification, and reporting of organisational GHG inventories."
        items={checklist.part1}
        evidenceOptions={evidenceOptions}
        pending={pending}
        defaultOpen
        onSave={saveItem}
      />

      <PartSection
        title="Part 2 — Project GHG"
        subtitle="ISO 14064-2: project-level quantification, monitoring, and verification."
        items={checklist.part2}
        evidenceOptions={evidenceOptions}
        pending={pending}
        defaultOpen={false}
        onSave={saveItem}
      />
    </div>
  );
}
