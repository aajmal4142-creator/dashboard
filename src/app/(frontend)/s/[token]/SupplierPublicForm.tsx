"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { brandingCssVarsToInlineStyle, brandingToCssVars } from "@/lib/branding";
import {
  DEFAULT_PORTAL_WELCOME,
  portalFormProgress,
  type SupplierPortalConfigView,
} from "@/lib/portal";
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
  portalPaused?: boolean;
  branding?: {
    primaryColor: string | null;
    logoUrl: string | null;
  };
  portal?: SupplierPortalConfigView;
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

function PortalChrome({
  meta,
  children,
}: {
  meta: SupplierFormMeta;
  children: ReactNode;
}) {
  const brandStyle = brandingCssVarsToInlineStyle(
    brandingToCssVars({
      primaryColor: meta.branding?.primaryColor ?? null,
      secondaryColor: null,
      fontFamily: null,
      defaultMode: null,
      radius: null,
      logoId: null,
      logoUrl: meta.branding?.logoUrl ?? null,
      domain: null,
    }),
  );

  return (
    <div className="min-h-full bg-canvas text-ink" style={brandStyle} data-portal-chrome>
      <header className="border-b border-rule bg-surface-1">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-5 py-4 sm:px-6">
          {meta.branding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={meta.branding.logoUrl}
              alt=""
              className="h-9 w-auto max-w-[10rem] object-contain"
            />
          ) : (
            <div className="flex size-9 items-center justify-center rounded-[var(--radius-chip)] bg-accent text-xs font-medium text-on-accent">
              {(meta.orgName || "?").slice(0, 2).toUpperCase()}
            </div>
          )}
          <p className="label-caps text-ink-muted">{meta.orgName}</p>
        </div>
      </header>
      {children}
    </div>
  );
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
  const portal = meta.portal;
  const progress = portalFormProgress(values);

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
    if (meta.expired || meta.error || meta.portalPaused) return;
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
      <PortalChrome meta={meta}>
        <main className="mx-auto max-w-lg px-6 py-16">
          <p className="text-ink-muted">{meta.error}</p>
        </main>
      </PortalChrome>
    );
  }

  if (meta.portalPaused) {
    return (
      <PortalChrome meta={meta}>
        <main className="mx-auto max-w-lg px-6 py-16">
          <p className="label-caps">{meta.orgName}</p>
          <h1
            className="mt-4 text-3xl font-medium"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Portal paused
          </h1>
          <p className="mt-4 text-ink-muted">
            {meta.orgName} has temporarily paused supplier data collection. Ask them for a
            new invite when collection reopens.
          </p>
        </main>
      </PortalChrome>
    );
  }

  if (done) {
    return (
      <PortalChrome meta={meta}>
        <main className="mx-auto max-w-lg px-6 py-16">
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
              Keep this page as your acknowledgement, or download the receipt PDF.
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
            <a
              href={`/api/s/${token}/receipt`}
              className="mt-8 inline-flex min-h-12 items-center justify-center rounded-[var(--radius)] border border-accent bg-accent px-4 py-3 text-base font-medium text-on-accent"
            >
              Download receipt PDF
            </a>
            {meta.expiresAt && !isTokenPast(meta.expiresAt) ? (
              <p className="mt-6 text-xs text-ink-muted">
                Need to correct a figure? Reopen this link before{" "}
                <span className="font-data">{meta.expiresAt.slice(0, 10)}</span>.
              </p>
            ) : null}
          </div>
        </main>
      </PortalChrome>
    );
  }

  if (meta.expired) {
    return (
      <PortalChrome meta={meta}>
        <main className="mx-auto max-w-lg px-6 py-16">
          <p className="label-caps">{meta.orgName}</p>
          <h1
            className="mt-4 text-3xl font-medium"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Link expired
          </h1>
          <p className="mt-4 text-ink-muted">Ask {meta.orgName} to send a new request.</p>
        </main>
      </PortalChrome>
    );
  }

  const headline = portal?.headline?.trim() || "Quick data return";
  const welcome =
    portal?.welcomeMessage?.trim() ||
    `For ${meta.supplierName}. About 90 seconds. ${DEFAULT_PORTAL_WELCOME}`;
  const showPoweredBy = portal?.showPoweredBy !== false;

  return (
    <PortalChrome meta={meta}>
      <main className="mx-auto max-w-lg px-5 py-10 sm:px-6 sm:py-12">
        <h1
          className="text-3xl leading-tight font-medium sm:text-4xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {headline}
        </h1>
        <p className="mt-3 text-base text-ink-muted sm:text-lg">{welcome}</p>
        {meta.alreadySubmitted ? (
          <p className="mt-2 text-sm text-ink-muted">
            You already submitted — changing values below will update your response.
          </p>
        ) : null}
        <p className="mt-2 text-sm text-ink-muted">
          Why am I being asked? {meta.orgName} needs value-chain data for mandatory ESG
          reporting. Accurate answers make you a lower-risk supplier.
        </p>

        <div className="mt-6" aria-live="polite">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-ink-muted">Progress</span>
            <span className="font-data text-ink">
              {progress.filled}/{progress.total}
            </span>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-[var(--radius-chip)] bg-surface-2"
            role="progressbar"
            aria-valuenow={progress.filled}
            aria-valuemin={0}
            aria-valuemax={progress.total}
          >
            <div
              className="h-full bg-accent transition-[width] duration-300"
              style={{ width: `${Math.round(progress.ratio * 100)}%` }}
            />
          </div>
        </div>

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
            className="min-h-12 w-full rounded-[var(--radius)] border border-accent bg-accent px-4 py-3 text-base font-medium text-on-accent disabled:opacity-50 sm:w-auto"
          >
            {saving
              ? "Submitting…"
              : meta.alreadySubmitted
                ? "Update response"
                : "Submit"}
          </button>
        </form>
        {showPoweredBy ? (
          <p className="mt-12 border-t border-rule pt-6 text-xs text-ink-muted">
            Powered by{" "}
            <Link href="/" className="editorial-link">
              ClearESG
            </Link>
          </p>
        ) : null}
      </main>
    </PortalChrome>
  );
}

function isTokenPast(iso: string): boolean {
  return Date.parse(iso) < Date.now();
}
