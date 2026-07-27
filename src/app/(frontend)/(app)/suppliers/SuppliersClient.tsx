"use client";

import { useState } from "react";

import {
  EmptyState,
  PageCard,
  PageFrame,
  StatusLine,
} from "@/components/shell/PageFrame";
import { AppField, AppSelectNative } from "@/components/ui/AppField";
import { Button } from "@/components/ui/button";
import { Metric } from "@/components/ui/metric";
import { requestStatusLabel } from "@/lib/ui/displayLabels";

export type SupplierRow = {
  id: string;
  name: string;
  contactEmail: string;
  category: string;
  annualSpend: number | null;
  requestStatus: string;
  requestToken: string | null;
  reminderCount: number;
};

const CATEGORIES = [
  { value: "purchased_goods", label: "Purchased goods" },
  { value: "capital_goods", label: "Capital goods" },
  { value: "transport", label: "Transport" },
  { value: "waste", label: "Waste" },
  { value: "business_travel", label: "Business travel" },
  { value: "other", label: "Other" },
];

export function SuppliersClient({
  initialSuppliers,
  initialCoveragePct,
  initialResponseRatePct,
  canWrite = true,
}: {
  initialSuppliers: SupplierRow[];
  initialCoveragePct: number | null;
  initialResponseRatePct: number | null;
  canWrite?: boolean;
}) {
  const [rows, setRows] = useState(initialSuppliers);
  const [coveragePct, setCoveragePct] = useState(initialCoveragePct);
  const [responseRate, setResponseRate] = useState(initialResponseRatePct);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"neutral" | "error" | "ok">("neutral");
  const [form, setForm] = useState({
    name: "",
    contactEmail: "",
    category: "purchased_goods",
    annualSpend: "",
  });

  function note(message: string, tone: "neutral" | "error" | "ok" = "neutral") {
    setStatusTone(tone);
    setStatus(message);
  }

  async function refresh() {
    const res = await fetch("/api/app/suppliers");
    if (!res.ok) {
      note("Could not load suppliers. Refresh the page and try again.", "error");
      return;
    }
    const data = (await res.json()) as {
      suppliers: SupplierRow[];
      coveragePct: number | null;
      responseRatePct: number | null;
    };
    setRows(data.suppliers);
    setCoveragePct(data.coveragePct);
    setResponseRate(data.responseRatePct);
  }

  async function addSupplier(e: React.FormEvent) {
    e.preventDefault();
    if (!canWrite) {
      note("Viewers cannot add suppliers. Ask a contributor or admin.", "error");
      return;
    }
    note("Saving…");
    const res = await fetch("/api/app/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        contactEmail: form.contactEmail,
        category: form.category,
        annualSpend: form.annualSpend === "" ? null : Number(form.annualSpend),
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      const raw = data.error ?? "Could not add supplier";
      note(
        raw === "Forbidden" ? "You do not have permission to add suppliers." : raw,
        "error",
      );
      return;
    }
    setForm({
      name: "",
      contactEmail: "",
      category: "purchased_goods",
      annualSpend: "",
    });
    note("Supplier added", "ok");
    await refresh();
  }

  async function sendRequest(id: string) {
    if (!canWrite) {
      note("Viewers cannot send requests.", "error");
      return;
    }
    note("Sending request…");
    const res = await fetch(`/api/app/suppliers/${id}/request`, { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as {
      link?: string;
      error?: string;
      delivery?: string;
    };
    if (!res.ok) {
      const raw = data.error ?? "Could not send request";
      note(
        raw === "Forbidden"
          ? "You do not have permission to send supplier requests."
          : raw,
        "error",
      );
      return;
    }
    if (data.link) {
      try {
        await navigator.clipboard.writeText(data.link);
      } catch {
        /* ignore */
      }
      const via =
        data.delivery === "resend"
          ? "Email sent via Resend."
          : data.delivery === "failed"
            ? "Email failed."
            : "No RESEND_API_KEY — email logged to server console only.";
      note(`${via} Link copied.`, "ok");
    } else {
      note(data.error ?? "Request sent", "ok");
    }
    await refresh();
  }

  async function chaseReminders() {
    if (!canWrite) {
      note("Viewers cannot send reminders.", "error");
      return;
    }
    note("Sending reminders…");
    const res = await fetch("/api/app/suppliers/reminders", { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as {
      remindersSent?: number;
      error?: string;
    };
    if (!res.ok) {
      const raw = data.error ?? "Could not send reminders";
      note(
        raw === "Forbidden" ? "You do not have permission to send reminders." : raw,
        "error",
      );
      return;
    }
    note(`Reminders sent: ${data.remindersSent ?? 0}`, "ok");
    await refresh();
  }

  async function remove(id: string) {
    if (!canWrite) {
      note("Viewers cannot remove suppliers.", "error");
      return;
    }
    if (!window.confirm("Remove this supplier?")) return;
    const res = await fetch(`/api/app/suppliers/${id}`, { method: "DELETE" });
    if (!res.ok) {
      note("Could not remove supplier. Try again.", "error");
      return;
    }
    note("Supplier removed", "ok");
    await refresh();
  }

  function copyChase(r: SupplierRow) {
    const origin = window.location.origin;
    const link = r.requestToken ? `${origin}/s/${r.requestToken}` : null;
    const text = [
      `Hi ${r.name},`,
      ``,
      `Please complete our sustainability data request for ClearESG.`,
      link ? `Link: ${link}` : `Ask us to resend your secure link.`,
      ``,
      `Outstanding: electricity, fuels, water, waste, travel, and Scope 3 where available.`,
      `About 90 seconds. Numbers only.`,
    ].join("\n");
    void navigator.clipboard.writeText(text).then(
      () => note("Chase message copied.", "ok"),
      () => note("Could not copy — select and copy manually.", "error"),
    );
  }

  return (
    <PageFrame
      eyebrow="Supplier chains"
      title="Scope 3 collection"
      help="Tokenised public forms. No supplier account. Responses flow into your Scope 3 as measured supplier data."
      actions={
        !canWrite ? <p className="text-sm text-ink-muted">View only</p> : undefined
      }
      rail={
        <div className="space-y-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              Spend covered
            </p>
            <div className="mt-2">
              {coveragePct === null ? (
                <span className="font-data text-[28px] font-bold text-ink-muted">—</span>
              ) : (
                <Metric value={coveragePct} unit="%" size="xl" decimals={0} />
              )}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              Response rate
            </p>
            <div className="mt-2">
              {responseRate === null ? (
                <span className="font-data text-[28px] font-bold text-ink-muted">—</span>
              ) : (
                <Metric value={responseRate} unit="%" size="xl" decimals={0} />
              )}
            </div>
          </div>
          <p className="text-[12px] text-ink-muted">
            Coverage uses annual spend on suppliers you have listed. Response rate counts
            submitted forms.
          </p>
        </div>
      }
    >
      {status ? <StatusLine tone={statusTone}>{status}</StatusLine> : null}

      <div className="space-y-4">
        {canWrite ? (
          <PageCard title="Add supplier">
            <form
              onSubmit={(e) => void addSupplier(e)}
              className="grid gap-3 md:grid-cols-2"
            >
              <AppField
                required
                label="Supplier name"
                placeholder="Acme Supplies Ltd"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <AppField
                required
                type="email"
                label="Contact email"
                placeholder="contact@supplier.com"
                value={form.contactEmail}
                onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
              />
              <AppSelectNative
                label="Category"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </AppSelectNative>
              <AppField
                type="number"
                min={0}
                label="Annual spend"
                placeholder="0"
                className="font-data"
                value={form.annualSpend}
                onChange={(e) => setForm((f) => ({ ...f, annualSpend: e.target.value }))}
              />
              <Button type="submit" className="md:col-span-2" size="sm">
                Add supplier
              </Button>
            </form>
          </PageCard>
        ) : null}

        {canWrite && rows.length > 0 ? (
          <div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void chaseReminders()}
            >
              Send due reminders (day 7 / 14)
            </Button>
          </div>
        ) : null}

        {rows.length === 0 ? (
          <EmptyState
            title="No suppliers yet"
            body="Add a supplier with a contact email, then send them a one-link request. Their reply lands in Scope 3 — they do not need an account."
          />
        ) : (
          <PageCard title="Suppliers">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[12px]">
                <thead>
                  <tr className="border-b-2 border-rule-strong">
                    <th className="py-2.5 pr-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                      Name
                    </th>
                    <th className="py-2.5 pr-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                      Category
                    </th>
                    <th className="py-2.5 pr-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                      Spend
                    </th>
                    <th className="py-2.5 pr-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                      Status
                    </th>
                    <th className="py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-rule transition-colors last:border-b-0 hover:bg-surface-2"
                    >
                      <td className="py-2.5 pr-2 align-top">
                        <div className="font-medium text-ink">{r.name}</div>
                        <div className="text-[11px] text-ink-muted">{r.contactEmail}</div>
                      </td>
                      <td className="py-2.5 pr-2 align-top text-ink-muted">
                        {r.category}
                      </td>
                      <td className="py-2.5 pr-2 align-top font-data text-ink">
                        {r.annualSpend === null ? "—" : r.annualSpend.toLocaleString()}
                      </td>
                      <td className="py-2.5 pr-2 align-top text-ink-muted">
                        {requestStatusLabel(r.requestStatus)}
                      </td>
                      <td className="py-2.5 align-top">
                        {canWrite ? (
                          <div className="flex flex-wrap gap-2">
                            {r.requestStatus !== "submitted" ? (
                              <button
                                type="button"
                                className="text-[12px] font-medium text-accent underline-offset-2 hover:underline"
                                onClick={() => void sendRequest(r.id)}
                              >
                                {r.requestStatus === "not_sent"
                                  ? "Send request"
                                  : "Resend"}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="text-[12px] text-ink underline-offset-2 hover:underline"
                              onClick={() => copyChase(r)}
                            >
                              Copy chase
                            </button>
                            <button
                              type="button"
                              className="text-[12px] text-ink-muted hover:text-rust"
                              onClick={() => void remove(r.id)}
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PageCard>
        )}
      </div>
    </PageFrame>
  );
}
