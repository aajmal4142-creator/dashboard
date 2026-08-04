"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  EmptyState,
  PageCard,
  PageFrame,
  PageSkeleton,
  StatusLine,
} from "@/components/shell/PageFrame";

type DocRow = {
  id: string;
  filename: string;
  docType: string;
  uploadedAt: string;
  expiryDate?: string;
};

const DOC_TYPES = [
  { value: "sustainability_report", label: "Sustainability report" },
  { value: "esg_report", label: "ESG report" },
  { value: "certification", label: "Certification" },
  { value: "carbon_data", label: "Carbon data" },
  { value: "audit_report", label: "Audit report" },
  { value: "verification", label: "Verification" },
  { value: "policy", label: "Policy" },
  { value: "other", label: "Other" },
] as const;

export function SupplierDocumentsClient({
  supplier,
}: {
  supplier: { id: string; name: string };
}) {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState<string>("certification");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/app/suppliers/documents/search?supplierId=${encodeURIComponent(supplier.id)}`,
      );
      const body = (await res.json()) as {
        error?: string;
        documents?: Array<{
          id: string;
          filename: string;
          docType: string;
          uploadedAt: string | Date;
          expiryDate?: string | Date;
        }>;
      };
      if (!res.ok) {
        setError(body.error ?? "Could not load documents.");
        setDocs([]);
        return;
      }
      setDocs(
        (body.documents ?? []).map((d) => ({
          id: d.id,
          filename: d.filename,
          docType: d.docType,
          uploadedAt:
            typeof d.uploadedAt === "string"
              ? d.uploadedAt
              : new Date(d.uploadedAt).toISOString(),
          expiryDate: d.expiryDate
            ? typeof d.expiryDate === "string"
              ? d.expiryDate
              : new Date(d.expiryDate).toISOString()
            : undefined,
        })),
      );
    } catch {
      setError("Network error loading documents. Retry.");
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [supplier.id]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setMsg("Choose a file before uploading.");
      return;
    }
    setUploading(true);
    setMsg(null);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("supplierId", supplier.id);
      form.set("docType", docType);
      if (description.trim()) form.set("description", description.trim());
      const res = await fetch("/api/app/suppliers/documents/upload", {
        method: "POST",
        body: form,
      });
      const body = (await res.json()) as { error?: string; success?: boolean };
      if (!res.ok || !body.success) {
        setError(body.error ?? "Upload failed.");
        return;
      }
      setMsg("Document uploaded.");
      setFile(null);
      setDescription("");
      await load();
    } catch {
      setError("Network error during upload. Retry.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <PageFrame
      eyebrow="Supply chain"
      title={`${supplier.name} — documents`}
      help="Store sustainability reports, certifications, and carbon evidence for this supplier. Virus scan is a placeholder path until a production scanner is wired."
      actions={
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/suppliers/${supplier.id}/risk-breakdown`}
            className="inline-flex h-8 items-center rounded-[4px] border border-rule bg-surface-1 px-3 text-[12px] text-ink hover:border-rule-strong"
          >
            Risk breakdown
          </Link>
          <Link
            href={`/suppliers/${supplier.id}/scorecard`}
            className="inline-flex h-8 items-center rounded-[4px] border border-rule bg-surface-1 px-3 text-[12px] text-ink hover:border-rule-strong"
          >
            Scorecard
          </Link>
        </div>
      }
    >
      {loading ? <PageSkeleton rows={4} /> : null}

      {!loading && error ? (
        <StatusLine tone="error">
          {error}{" "}
          <button
            type="button"
            className="text-accent underline-offset-2 hover:underline"
            onClick={() => void load()}
          >
            Retry
          </button>
        </StatusLine>
      ) : null}

      {msg ? <StatusLine tone="ok">{msg}</StatusLine> : null}

      {!loading && !error ? (
        <div className="space-y-6">
          <PageCard title="Upload">
            <form onSubmit={(e) => void onUpload(e)} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-[12px] text-ink-muted">
                  Document type
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className="mt-1 h-9 w-full rounded-[4px] border border-rule bg-surface-1 px-2 text-[13px] text-ink"
                  >
                    {DOC_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-[12px] text-ink-muted">
                  File
                  <input
                    type="file"
                    className="mt-1 block w-full text-[12px] text-ink"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
              <label className="block text-[12px] text-ink-muted">
                Description (optional)
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 h-9 w-full rounded-[4px] border border-rule bg-surface-1 px-2 text-[13px] text-ink"
                />
              </label>
              <button
                type="submit"
                disabled={uploading}
                className="inline-flex h-8 items-center rounded-[4px] bg-accent px-3 text-[12px] text-canvas hover:bg-accent-hover disabled:opacity-50"
              >
                {uploading ? "Uploading…" : "Upload document"}
              </button>
            </form>
          </PageCard>

          <PageCard title="On file">
            {docs.length === 0 ? (
              <EmptyState
                title="No documents yet"
                body="Upload a PDF, Word, Excel, or image file to start the supplier repository."
              />
            ) : (
              <ul className="divide-y divide-rule">
                {docs.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-3"
                  >
                    <div>
                      <p className="text-[13px] font-semibold text-ink">{d.filename}</p>
                      <p className="mt-0.5 text-[11px] text-ink-muted">
                        <span className="font-mono">{d.docType}</span>
                        {" · "}
                        <span className="font-mono tabular-nums">
                          {d.uploadedAt.slice(0, 10)}
                        </span>
                        {d.expiryDate ? (
                          <>
                            {" · expires "}
                            <span className="font-mono tabular-nums">
                              {d.expiryDate.slice(0, 10)}
                            </span>
                          </>
                        ) : null}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </PageCard>
        </div>
      ) : null}
    </PageFrame>
  );
}
