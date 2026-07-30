"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState, PageFrame, StatusLine } from "@/components/shell/PageFrame";
import { cn } from "@/lib/utils";
import type { IssbAnswersMap, IssbQuestion, IssbStandard } from "@/lib/issb";

type DisclosureListItem = {
  id: string;
  reportingYear: number;
  status: string;
  linkedTcfdId: string | null;
  finalisedAt: string | null;
};

export function IssbWizardClient({
  canWrite,
  defaultYear,
  questions,
}: {
  canWrite: boolean;
  defaultYear: number;
  questions: IssbQuestion[];
}) {
  const [list, setList] = useState<DisclosureListItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [year, setYear] = useState(defaultYear);
  const [status, setStatus] = useState("draft");
  const [linkedTcfdId, setLinkedTcfdId] = useState<string | null>(null);
  const [s1Answers, setS1Answers] = useState<IssbAnswersMap>({});
  const [s2Answers, setS2Answers] = useState<IssbAnswersMap>({});
  const [standard, setStandard] = useState<IssbStandard>("S1");
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"neutral" | "error" | "ok">("neutral");
  const [pending, startTransition] = useTransition();

  const locked = status === "final" || !canWrite;

  const loadList = useCallback(() => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/app/issb");
        const data = (await res.json()) as {
          disclosures?: DisclosureListItem[];
          error?: string;
        };
        if (!res.ok) {
          setTone("error");
          setMessage(data.error ?? "Failed to load ISSB disclosures");
          return;
        }
        setList(data.disclosures ?? []);
      } catch (err) {
        setTone("error");
        setMessage(err instanceof Error ? err.message : "Failed to load");
      }
    });
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      loadList();
    }, 0);
    return () => window.clearTimeout(id);
  }, [loadList]);

  function openDisclosure(id: string) {
    startTransition(async () => {
      setTone("neutral");
      setMessage(null);
      try {
        const res = await fetch(`/api/app/issb/${id}`);
        const data = (await res.json()) as {
          id?: string;
          reportingYear?: number;
          status?: string;
          linkedTcfdId?: string | null;
          s1Answers?: IssbAnswersMap;
          s2Answers?: IssbAnswersMap;
          error?: string;
        };
        if (!res.ok) {
          setTone("error");
          setMessage(data.error ?? "Failed to open");
          return;
        }
        setActiveId(data.id ?? id);
        setYear(Number(data.reportingYear ?? defaultYear));
        setStatus(String(data.status ?? "draft"));
        setLinkedTcfdId(data.linkedTcfdId ?? null);
        setS1Answers(data.s1Answers ?? {});
        setS2Answers(data.s2Answers ?? {});
        setStandard("S1");
      } catch (err) {
        setTone("error");
        setMessage(err instanceof Error ? err.message : "Failed to open");
      }
    });
  }

  function createDraft() {
    startTransition(async () => {
      setMessage("Creating ISSB draft…");
      try {
        const res = await fetch("/api/app/issb", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportingYear: year, autofill: true }),
        });
        const data = (await res.json()) as {
          id?: string;
          error?: string;
          s1Answers?: IssbAnswersMap;
          s2Answers?: IssbAnswersMap;
          linkedTcfdId?: string | null;
          status?: string;
          reportingYear?: number;
        };
        if (!res.ok) {
          setTone("error");
          setMessage(data.error ?? "Create failed");
          if (data.id) openDisclosure(String(data.id));
          return;
        }
        setTone("ok");
        setMessage(`Draft ISSB ${data.reportingYear} created`);
        setActiveId(data.id ?? null);
        setStatus(String(data.status ?? "draft"));
        setLinkedTcfdId(data.linkedTcfdId ?? null);
        setS1Answers(data.s1Answers ?? {});
        setS2Answers(data.s2Answers ?? {});
        loadList();
      } catch (err) {
        setTone("error");
        setMessage(err instanceof Error ? err.message : "Create failed");
      }
    });
  }

  function patch(action: "save" | "autofill" | "inherit_tcfd") {
    if (!activeId || locked) return;
    startTransition(async () => {
      setMessage(action === "save" ? "Saving…" : "Updating…");
      try {
        const res = await fetch(`/api/app/issb/${activeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            action === "save" ? { action: "save", s1Answers, s2Answers } : { action },
          ),
        });
        const data = (await res.json()) as {
          s1Answers?: IssbAnswersMap;
          s2Answers?: IssbAnswersMap;
          linkedTcfdId?: string | null;
          error?: string;
        };
        if (!res.ok) {
          setTone("error");
          setMessage(data.error ?? "Update failed");
          return;
        }
        setS1Answers(data.s1Answers ?? s1Answers);
        setS2Answers(data.s2Answers ?? s2Answers);
        if (data.linkedTcfdId !== undefined) setLinkedTcfdId(data.linkedTcfdId);
        setTone("ok");
        setMessage(
          action === "inherit_tcfd"
            ? "S2 inherited from linked TCFD"
            : action === "autofill"
              ? "Autofill applied"
              : "Saved",
        );
      } catch (err) {
        setTone("error");
        setMessage(err instanceof Error ? err.message : "Update failed");
      }
    });
  }

  function finalize() {
    if (!activeId || locked) return;
    startTransition(async () => {
      setMessage("Finalising…");
      try {
        const res = await fetch(`/api/app/issb/${activeId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "finalize" }),
        });
        const data = (await res.json()) as { status?: string; error?: string };
        if (!res.ok) {
          setTone("error");
          setMessage(data.error ?? "Finalise failed");
          return;
        }
        setStatus("final");
        setTone("ok");
        setMessage("Finalised — disclosure is locked");
        loadList();
      } catch (err) {
        setTone("error");
        setMessage(err instanceof Error ? err.message : "Finalise failed");
      }
    });
  }

  const visible = questions.filter((q) => q.standard === standard);
  const answers = standard === "S1" ? s1Answers : s2Answers;
  const setAnswers = standard === "S1" ? setS1Answers : setS2Answers;

  return (
    <PageFrame
      eyebrow="Compliance"
      title="ISSB"
      help="S1 general sustainability disclosures plus S2 climate (extends TCFD). Link a TCFD disclosure to inherit climate answers. Draft → final; light-theme PDF."
      context={{
        period: activeId ? `Year ${year}` : undefined,
        status: activeId ? status : undefined,
      }}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-[12px] text-ink-muted">
            Year
            <input
              type="number"
              className="w-20 border border-rule bg-surface-1 px-2 py-1 font-data text-ink"
              value={year}
              disabled={Boolean(activeId) || pending}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </label>
          {canWrite ? (
            <Button type="button" size="sm" disabled={pending} onClick={createDraft}>
              New draft
            </Button>
          ) : null}
          {activeId ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending || locked}
                onClick={() => patch("autofill")}
              >
                Autofill
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending || locked || !linkedTcfdId}
                onClick={() => patch("inherit_tcfd")}
              >
                Inherit TCFD
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending || locked}
                onClick={() => patch("save")}
              >
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={pending || locked}
                onClick={finalize}
              >
                Finalise
              </Button>
              <a
                className="inline-flex h-8 items-center border border-rule px-3 text-[12px] text-ink hover:border-rule-strong"
                href={`/api/app/issb/${activeId}/pdf`}
                target="_blank"
                rel="noreferrer"
              >
                PDF
              </a>
            </>
          ) : null}
        </div>
      }
      rail={
        <div className="space-y-5 text-[13px] text-ink-muted">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
              Disclosures
            </p>
            <ul className="mt-2 space-y-1">
              {list.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    className={cn(
                      "w-full text-left font-data text-[12px]",
                      activeId === d.id ? "text-accent" : "text-ink hover:text-accent",
                    )}
                    onClick={() => openDisclosure(d.id)}
                  >
                    {d.reportingYear} · {d.status}
                  </button>
                </li>
              ))}
              {list.length === 0 ? (
                <li className="text-[12px]">No disclosures yet.</li>
              ) : null}
            </ul>
          </div>
          {activeId ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
                Linked TCFD
              </p>
              <p className="mt-2 font-data text-[12px] text-ink">
                {linkedTcfdId ?? "None — create a same-year TCFD draft first"}
              </p>
            </div>
          ) : null}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
              S2 extends TCFD
            </p>
            <p className="mt-2">
              Climate answers map onto TCFD pillars. Inherit pulls from the linked
              disclosure without duplicating the CSRD Reports flow.
            </p>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {message ? <StatusLine tone={tone}>{message}</StatusLine> : null}

        {!activeId ? (
          <EmptyState
            title="No ISSB disclosure open"
            body="Create a draft. S2 climate autofills from ClearESG emissions and can inherit from a linked TCFD disclosure."
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-2 border-b border-rule pb-3">
              {(["S1", "S2"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={cn(
                    "px-3 py-1.5 text-[12px]",
                    standard === s
                      ? "border-b-2 border-accent font-semibold text-ink"
                      : "text-ink-muted hover:text-ink",
                  )}
                  onClick={() => setStandard(s)}
                >
                  {s === "S1" ? "S1 General" : "S2 Climate"}
                </button>
              ))}
            </div>

            <div className="space-y-6">
              {visible.map((q) => {
                const row = answers[q.id];
                return (
                  <div key={q.id} className="border-b border-rule pb-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
                      {q.label}
                      {q.tcfdPillar ? ` · TCFD ${q.tcfdPillar}` : ""}
                      {row?.autoFilled ? " · auto" : ""}
                    </p>
                    <p className="mt-1 text-[13px] text-ink-muted">{q.prompt}</p>
                    <textarea
                      className="mt-3 w-full min-h-[96px] border border-rule bg-surface-1 px-3 py-2 text-[13px] text-ink outline-none focus:border-rule-strong disabled:opacity-60"
                      value={row?.text ?? ""}
                      disabled={locked || pending}
                      onChange={(e) => {
                        const text = e.target.value;
                        setAnswers((prev) => ({
                          ...prev,
                          [q.id]: {
                            text,
                            source: "manual",
                            autoFilled: false,
                            updatedAt: new Date().toISOString(),
                          },
                        }));
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </PageFrame>
  );
}
