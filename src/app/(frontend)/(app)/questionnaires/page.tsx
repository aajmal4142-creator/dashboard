"use client";

import { useState } from "react";

import {
  EmptyState,
  PageCard,
  PageFrame,
  StatusLine,
} from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import { Metric } from "@/components/ui/metric";
import { qualityLabel } from "@/lib/ui/displayLabels";

type FieldRow = {
  fieldId: string;
  label: string;
  metricKey: string;
  value: number | null;
  unit: string | null;
  quality: string;
  approvalState: string | null;
  status: string;
};

type ExportPayload = {
  questionnaireId: string;
  name: string;
  organisation: string;
  responses: FieldRow[];
  note?: string;
};

export default function QuestionnairesPage() {
  const [payload, setPayload] = useState<ExportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/app/questionnaires/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionnaireId: "ecovadis-lite" }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(
        typeof data === "object" && data && "error" in data
          ? String((data as { error: string }).error)
          : "Export failed. Finish onboarding or switch organisation.",
      );
      setPayload(null);
      return;
    }
    setPayload(data as ExportPayload);
  }

  function downloadJson() {
    if (!payload) return;
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clearesg-${payload.questionnaireId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const mapped = payload?.responses.filter((r) => r.status === "mapped").length ?? 0;
  const total = payload?.responses.length ?? 0;

  return (
    <PageFrame
      eyebrow="Inbound questionnaire"
      title="Buyer questionnaire response"
      help="Fills a buyer questionnaire (EcoVadis-lite) from the metrics you already entered. Same numbers every time — no AI. This is a response pack, not a filing."
      actions={
        <Button type="button" size="sm" disabled={busy} onClick={() => void generate()}>
          {busy ? "Generating…" : "Generate evidenced export"}
        </Button>
      }
      rail={
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Coverage
          </p>
          {payload ? (
            <p className="mt-2 font-data text-[28px] font-bold text-ink">
              <Metric
                value={mapped}
                size="lg"
                decimals={0}
                className="inline"
                inView={false}
              />
              <span className="text-ink-muted"> / {total}</span>
            </p>
          ) : (
            <p className="mt-2 text-[13px] text-ink-muted">
              Generate to see mapped fields.
            </p>
          )}
          {payload ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-4"
              onClick={downloadJson}
            >
              Download JSON
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
        {error ? <StatusLine tone="error">{error}</StatusLine> : null}

        {!payload && !error ? (
          <EmptyState
            title="No export yet"
            body="Generate a downloadable response from your current period data. Fields we cannot map stay blank — we never invent zeros."
          />
        ) : null}

        {payload ? (
          <PageCard title="Response pack">
            {payload.note ? (
              <p className="mb-3 text-[13px] text-ink-muted">{payload.note}</p>
            ) : null}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[12px]">
                <thead>
                  <tr className="border-b-2 border-rule-strong">
                    <th className="py-2.5 pr-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                      Field
                    </th>
                    <th className="py-2.5 pr-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                      Metric
                    </th>
                    <th className="py-2.5 pr-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                      Value
                    </th>
                    <th className="py-2.5 pr-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                      Quality
                    </th>
                    <th className="py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payload.responses.map((r) => (
                    <tr
                      key={r.fieldId}
                      className="border-b border-rule transition-colors last:border-b-0 hover:bg-surface-2"
                    >
                      <td className="py-2.5 pr-2 font-medium text-ink">{r.label}</td>
                      <td className="py-2.5 pr-2 font-data text-[11px] text-ink-muted">
                        {r.metricKey}
                      </td>
                      <td className="py-2.5 pr-2 font-data">
                        {r.value == null ? "—" : r.value}
                        {r.unit ? ` ${r.unit}` : ""}
                      </td>
                      <td className="py-2.5 pr-2 text-[11px]">
                        {qualityLabel(r.quality)}
                      </td>
                      <td className="py-2.5 text-[11px]">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PageCard>
        ) : null}
      </div>
    </PageFrame>
  );
}
