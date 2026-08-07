"use client";

import { useState } from "react";
import Link from "next/link";

import { BulkHistoryPanel } from "@/components/bulk/BulkHistoryPanel";
import { SelectableTable } from "@/components/bulk/SelectableTable";
import {
  EmptyState,
  PageCard,
  PageFrame,
  StatusLine,
} from "@/components/shell/PageFrame";
import { AppField, AppSelectNative } from "@/components/ui/AppField";
import { Button } from "@/components/ui/button";
import { Metric } from "@/components/ui/metric";
import { useBulkOperations } from "@/lib/hooks/useBulkOperations";
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
  emailConsent?: boolean;
  engagementStatus?: string | null;
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
    emailConsent: false,
  });
  const { createBulkOp } = useBulkOperations();

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
        emailConsent: form.emailConsent,
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
      emailConsent: false,
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

  async function handleBulkAction(
    action: string,
    itemIds: string[],
    items: Array<{ id: string; [key: string]: unknown }>,
  ) {
    if (!canWrite) {
      note("Viewers cannot run bulk actions.", "error");
      throw new Error("Forbidden");
    }

    if (action === "export") {
      const selected = rows.filter((r) => itemIds.includes(r.id));
      const header = "name,contactEmail,category,annualSpend,requestStatus";
      const lines = selected.map((r) =>
        [r.name, r.contactEmail, r.category, r.annualSpend ?? "", r.requestStatus]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      );
      const blob = new Blob([[header, ...lines].join("\n")], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "suppliers-export.csv";
      a.click();
      URL.revokeObjectURL(url);
      note(`Exported ${selected.length} suppliers`, "ok");
      return;
    }

    if (action === "email-reminder") {
      note("Sending reminders…");
      const res = await fetch("/api/app/suppliers/reminders", { method: "POST" });
      if (!res.ok) {
        note("Could not send reminders.", "error");
        throw new Error("Reminder failed");
      }
      await createBulkOp(action, "suppliers", itemIds, {}, items);
      note("Reminders sent", "ok");
      await refresh();
      return;
    }

    const changes = action === "update-status" ? { requestStatus: "pending" } : {};
    const op = await createBulkOp(action, "suppliers", itemIds, changes, items);
    if (!op) {
      note("Bulk operation failed. Check plan entitlements and try again.", "error");
      throw new Error("Bulk operation failed");
    }
    note(`Bulk ${action} completed for ${itemIds.length} suppliers`, "ok");
    await refresh();
  }

  return (
    <PageFrame
      eyebrow="Supplier chains"
      title="Scope 3 collection"
      help="Tokenised public forms. No supplier account. Responses flow into your Scope 3 as measured supplier data. For full ESG questionnaires, use Engagement."
      actions={
        !canWrite ? (
          <p className="text-sm text-ink-muted">View only</p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/scope3/category-1"
              className="text-sm font-medium text-ink underline-offset-2 hover:underline"
            >
              Category 1 breakdown
            </Link>
            <Link
              href="/suppliers/engagement"
              className="text-sm font-medium text-accent underline-offset-2 hover:underline"
            >
              ESG engagement
            </Link>
          </div>
        )
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
              <label className="flex items-center gap-2 text-[12px] text-ink md:col-span-2">
                <input
                  type="checkbox"
                  checked={form.emailConsent}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, emailConsent: e.target.checked }))
                  }
                />
                Supplier consents to email contact (required before ESG questionnaire)
              </label>
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
          <>
            <PageCard title="Suppliers">
              <SelectableTable
                items={rows}
                resourceType="suppliers"
                enableBulkActions={canWrite}
                onOperationComplete={() => void refresh()}
                onBulkAction={
                  canWrite
                    ? (action, itemIds, items) => handleBulkAction(action, itemIds, items)
                    : undefined
                }
                columns={[
                  {
                    key: "name",
                    label: "Name",
                    render: (_value, item) => {
                      const r = item as unknown as SupplierRow;
                      return (
                        <div>
                          <div className="font-medium text-ink">
                            <Link
                              href={`/suppliers/${r.id}/tier-emissions`}
                              className="text-ink underline-offset-2 hover:text-accent hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {r.name}
                            </Link>
                          </div>
                          <div className="text-[11px] text-ink-muted">
                            {r.contactEmail}
                          </div>
                        </div>
                      );
                    },
                  },
                  {
                    key: "category",
                    label: "Category",
                    render: (value) => (
                      <span className="text-ink-muted">{String(value)}</span>
                    ),
                  },
                  {
                    key: "annualSpend",
                    label: "Spend",
                    render: (value) => (
                      <span className="font-data text-ink">
                        {value == null ? "—" : Number(value).toLocaleString()}
                      </span>
                    ),
                  },
                  {
                    key: "requestStatus",
                    label: "Status",
                    render: (value) => (
                      <span className="text-ink-muted">
                        {requestStatusLabel(String(value))}
                      </span>
                    ),
                  },
                  {
                    key: "id",
                    label: "Actions",
                    render: (_value, item) => {
                      const r = item as unknown as SupplierRow;
                      if (!canWrite) {
                        return (
                          <Link
                            href={`/suppliers/${r.id}`}
                            className="text-[12px] text-accent underline-offset-2 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Detail
                          </Link>
                        );
                      }
                      return (
                        <div
                          className="flex flex-wrap gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link
                            href={`/suppliers/${r.id}`}
                            className="text-[12px] font-medium text-accent underline-offset-2 hover:underline"
                          >
                            Detail
                          </Link>
                          <Link
                            href={`/suppliers/${r.id}/tier-emissions`}
                            className="text-[12px] font-medium text-accent underline-offset-2 hover:underline"
                          >
                            Tier 2 estimate
                          </Link>
                          {r.requestStatus !== "submitted" ? (
                            <button
                              type="button"
                              className="text-[12px] font-medium text-accent underline-offset-2 hover:underline"
                              onClick={() => void sendRequest(r.id)}
                            >
                              {r.requestStatus === "not_sent" ? "Send request" : "Resend"}
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
                      );
                    },
                  },
                ]}
              />
            </PageCard>

            {canWrite ? (
              <BulkHistoryPanel
                resourceType="suppliers"
                onChanged={() => void refresh()}
              />
            ) : null}
          </>
        )}
      </div>
    </PageFrame>
  );
}
