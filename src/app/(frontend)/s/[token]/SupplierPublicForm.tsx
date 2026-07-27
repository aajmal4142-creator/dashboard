"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { SUPPLIER_FORM_FIELDS } from "@/lib/suppliers/fields";

export type SupplierFormMeta = {
  orgName: string;
  supplierName: string;
  expired: boolean;
  /** @deprecated Corrections allowed — prefer alreadySubmitted. */
  used: boolean;
  alreadySubmitted?: boolean;
  expiresAt: string | null;
  error?: string;
};

function draftKey(token: string) {
  return `clearesg-supplier-draft:${token}`;
}

function whyCopy(key: string): string {
  switch (key) {
    case "electricity_kwh":
      return "Helps estimate energy-related emissions in your operations.";
    case "diesel_litres":
      return "Fuel used in vehicles or generators.";
    case "natural_gas_m3":
      return "Heating and process gas.";
    case "business_travel_km":
      return "Staff travel distance for work trips.";
    case "employees_total":
      return "Used to scale intensity figures fairly.";
    case "estimated_tco2e":
      return "If you already calculate your footprint, share that total. Leave blank if not.";
    default:
      return "";
  }
}

export function SupplierPublicForm({
  token,
  initial,
}: {
  token: string;
  initial: SupplierFormMeta;
}) {
  const [error, setError] = useState<string | null>(initial.error ?? null);
  const [done, setDone] = useState(false);
  const [isResubmit, setIsResubmit] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [isMetered, setIsMetered] = useState(false);
  const [saving, setSaving] = useState(false);
  const meta = initial;

  useEffect(() => {
    void Promise.resolve().then(() => {
      try {
        const raw = sessionStorage.getItem(draftKey(token));
        if (raw) setValues(JSON.parse(raw) as Record<string, string>);
      } catch {
        /* ignore */
      }
    });
  }, [token]);

  useEffect(() => {
    try {
      sessionStorage.setItem(draftKey(token), JSON.stringify(values));
    } catch {
      /* ignore */
    }
  }, [token, values]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (meta.expired || meta.error) return;
    setSaving(true);
    setError(null);
    const body: Record<string, number | null | boolean> = {};
    for (const f of SUPPLIER_FORM_FIELDS) {
      const raw = values[f.key]?.trim() ?? "";
      if (!raw) {
        body[f.key] = null;
        continue;
      }
      body[f.key] = Number(raw);
    }
    body.is_metered = isMetered;
    const res = await fetch(`/api/s/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not submit");
      return;
    }
    const data = (await res.json().catch(() => ({}))) as { isResubmit?: boolean };
    try {
      sessionStorage.removeItem(draftKey(token));
    } catch {
      /* ignore */
    }
    setIsResubmit(Boolean(data.isResubmit));
    setDone(true);
  }

  if (meta.error) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16 text-ink">
        <p className="text-ink-muted">{meta.error}</p>
      </main>
    );
  }

  if (done) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16 text-ink">
        <div className="panel float-shadow p-8">
          <p className="label-caps text-signal">Recorded</p>
          <h1
            className="mt-4 text-3xl font-medium tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Thank you — you helped {meta.orgName}
          </h1>
          <p className="measure-body mt-4 text-ink-muted">
            {isResubmit
              ? "Your corrected figures replaced the previous response."
              : `Your response is on file for ${meta.orgName}'s compliance report.`}{" "}
            Keep this page as your acknowledgement.
          </p>
          <dl className="mt-8 space-y-2 border-t border-rule pt-6 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Buyer</dt>
              <dd>{meta.orgName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Supplier</dt>
              <dd>{meta.supplierName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Status</dt>
              <dd className="text-signal">{isResubmit ? "Updated" : "Submitted"}</dd>
            </div>
          </dl>
          {meta.expiresAt && !isTokenPast(meta.expiresAt) ? (
            <p className="mt-6 text-xs text-ink-muted">
              Need to correct a figure? Reopen this link before{" "}
              <span className="font-data">{meta.expiresAt.slice(0, 10)}</span>.
            </p>
          ) : null}
        </div>
      </main>
    );
  }

  if (meta.expired) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16 text-ink">
        <p className="label-caps">{meta.orgName}</p>
        <h1
          className="mt-4 text-3xl font-medium"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Link expired
        </h1>
        <p className="mt-4 text-ink-muted">Ask {meta.orgName} to send a new request.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-5 py-10 text-ink sm:px-6 sm:py-12">
      <p className="label-caps">{meta.orgName}</p>
      <h1
        className="mt-4 text-3xl leading-tight font-medium sm:text-4xl"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Quick data return
      </h1>
      <p className="mt-3 text-base text-ink-muted sm:text-lg">
        For <span className="text-ink">{meta.supplierName}</span>. About 90 seconds.
        {meta.alreadySubmitted
          ? " You already submitted — changing values below will update your response."
          : " Plain figures only. Your draft stays on this device until you submit."}
      </p>
      <p className="mt-2 text-sm text-ink-muted">
        Why am I being asked? {meta.orgName} needs value-chain data for mandatory ESG
        reporting. Accurate answers make you a lower-risk supplier.
      </p>
      {error ? <p className="mt-4 text-sm text-rust">{error}</p> : null}

      <form className="mt-10 space-y-7" onSubmit={(e) => void submit(e)}>
        {SUPPLIER_FORM_FIELDS.map((f) => (
          <div key={f.key} className="input-well p-4">
            <label
              className="flex items-baseline justify-between gap-2 text-base"
              htmlFor={f.key}
            >
              <span>
                {f.label}
                {f.required ? "" : " (optional)"}
              </span>
              <span className="font-data text-sm text-ink-muted">{f.unit}</span>
            </label>
            <p className="mt-1 text-xs text-ink-muted">{whyCopy(f.key)}</p>
            <input
              id={f.key}
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              required={f.required}
              className="mt-2 min-h-12 w-full rounded-[var(--radius)] border border-rule bg-canvas px-4 py-3 font-data text-base text-ink"
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
          </div>
        ))}
        <label className="flex items-start gap-3 text-sm text-ink-muted">
          <input
            type="checkbox"
            className="mt-1"
            checked={isMetered}
            onChange={(e) => setIsMetered(e.target.checked)}
          />
          <span>
            These emissions figures come from metered or inventoried measurement (not an
            estimate). Leave unchecked if unsure.
          </span>
        </label>
        <button
          type="submit"
          disabled={saving}
          className="min-h-12 w-full rounded-[var(--radius)] border border-accent bg-accent px-4 py-3 text-base font-medium text-canvas disabled:opacity-50 sm:w-auto"
        >
          {saving ? "Submitting…" : meta.alreadySubmitted ? "Update response" : "Submit"}
        </button>
      </form>
      <p className="mt-12 border-t border-rule pt-6 text-xs text-ink-muted">
        Powered by{" "}
        <Link href="/" className="editorial-link">
          ClearESG
        </Link>
      </p>
    </main>
  );
}

function isTokenPast(iso: string): boolean {
  return Date.parse(iso) < Date.now();
}
