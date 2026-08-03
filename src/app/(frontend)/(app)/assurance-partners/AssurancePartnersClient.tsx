"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";

import {
  EmptyState,
  PageCard,
  PageFrame,
  PageSkeleton,
  StatusLine,
} from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import {
  CERT_LABELS,
  FIRM_TYPE_LABELS,
  FIRM_TYPES,
  type FirmType,
  type PartnerListItem,
} from "@/lib/assurancePartners";
import { cn } from "@/lib/utils";

const CERT_OPTIONS = Object.keys(CERT_LABELS);

const SPEC_OPTIONS = [
  "CSRD assurance",
  "GHG inventory",
  "BRSR",
  "Energy",
  "Manufacturing",
  "Climate risk",
  "Supply chain",
  "TCFD",
] as const;

const COUNTRY_OPTIONS = [
  "GB",
  "IN",
  "US",
  "DE",
  "NL",
  "FR",
  "NO",
  "CH",
  "SG",
  "AU",
] as const;

function availabilityLabel(value: string | null): string {
  if (value === "available") return "Available";
  if (value === "limited") return "Limited capacity";
  if (value === "booked") return "Fully booked";
  return "—";
}

export function AssurancePartnersClient() {
  const [partners, setPartners] = useState<PartnerListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [cert, setCert] = useState("");
  const [firmType, setFirmType] = useState<FirmType | "">("");
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"neutral" | "error" | "ok">("neutral");
  const [pending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    startTransition(async () => {
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (country) params.set("country", country);
        if (specialization) params.set("specialization", specialization);
        if (cert) params.set("cert", cert);
        if (firmType) params.set("firmType", firmType);

        const qs = params.toString();
        const res = await fetch(`/api/app/assurance-partners${qs ? `?${qs}` : ""}`);
        const data = (await res.json()) as {
          partners?: PartnerListItem[];
          total?: number;
          error?: string;
        };
        if (!res.ok) {
          setTone("error");
          setMessage(data.error ?? "Failed to load directory");
          setPartners([]);
          setTotal(0);
          setLoaded(true);
          return;
        }
        setPartners(data.partners ?? []);
        setTotal(data.total ?? 0);
        setTone("neutral");
        setMessage(null);
        setLoaded(true);
      } catch {
        setTone("error");
        setMessage("Failed to load directory");
        setPartners([]);
        setTotal(0);
        setLoaded(true);
      }
    });
  }, [q, country, specialization, cert, firmType]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  function clearFilters() {
    setQ("");
    setCountry("");
    setSpecialization("");
    setCert("");
    setFirmType("");
  }

  return (
    <PageFrame
      eyebrow="Assurance"
      title="Partner directory"
      help="Curated ESG assurance firms for orientation only. ClearESG does not provide assurance. Contacts are directory demo placeholders — use the firm website for engagement."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href="/assurance/engagements">Assurance pathways</Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="/assurance">Assurance Room</Link>
          </Button>
        </div>
      }
      rail={
        <div className="space-y-4 text-[13px] text-ink-muted">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
              How to use
            </p>
            <p className="mt-2">
              Filter by country and specialization. Open the firm website to inquire —
              this directory does not book engagements.
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
              Demo data
            </p>
            <p className="mt-2">
              Seeded Big 4, mid-tier, and specialists. Emails use @example.com
              placeholders.
            </p>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {message ? <StatusLine tone={tone}>{message}</StatusLine> : null}

        <PageCard title="Filter">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block text-[12px] text-ink-muted">
              Search
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Firm or specialization"
                className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 text-[13px] text-ink outline-none focus:border-rule-strong"
              />
            </label>
            <label className="block text-[12px] text-ink-muted">
              Country
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 text-[13px] text-ink outline-none focus:border-rule-strong"
              >
                <option value="">All</option>
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[12px] text-ink-muted">
              Specialization
              <select
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 text-[13px] text-ink outline-none focus:border-rule-strong"
              >
                <option value="">All</option>
                {SPEC_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[12px] text-ink-muted">
              Certification
              <select
                value={cert}
                onChange={(e) => setCert(e.target.value)}
                className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 text-[13px] text-ink outline-none focus:border-rule-strong"
              >
                <option value="">All</option>
                {CERT_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {CERT_LABELS[c] ?? c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[12px] text-ink-muted">
              Firm type
              <select
                value={firmType}
                onChange={(e) => setFirmType((e.target.value || "") as FirmType | "")}
                className="mt-1 w-full border border-rule bg-surface-1 px-3 py-2 text-[13px] text-ink outline-none focus:border-rule-strong"
              >
                <option value="">All</option>
                {FIRM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {FIRM_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={clearFilters}
                disabled={pending}
              >
                Clear
              </Button>
              <p className="pb-2 font-data text-[12px] text-ink-muted">
                {pending ? "Loading…" : `${total} firm${total === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>
        </PageCard>

        {!loaded || (pending && partners.length === 0) ? (
          <PageSkeleton rows={4} />
        ) : partners.length === 0 ? (
          <EmptyState
            title="No partners match"
            body="Widen country or specialization filters, or clear filters to see the full curated directory."
            action={
              <Button type="button" size="sm" variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {partners.map((p) => (
              <li key={p.id}>
                <article className="h-full rounded-[6px] border border-rule bg-surface-1 p-4 md:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-[16px] font-semibold text-ink">{p.name}</h2>
                      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent">
                        {FIRM_TYPE_LABELS[p.firmType]}
                      </p>
                    </div>
                    {p.rating != null ? (
                      <p className="font-data text-[13px] text-ink">
                        {p.rating.toFixed(1)}
                        <span className="text-ink-muted"> / 5</span>
                      </p>
                    ) : null}
                  </div>

                  <p className="mt-3 text-[13px] text-ink-muted">{p.location}</p>
                  <p className="mt-1 font-data text-[12px] text-ink-muted">
                    {p.countries.join(" · ") || p.country}
                  </p>

                  {p.specializations.length > 0 ? (
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {p.specializations.map((s) => (
                        <li
                          key={s}
                          className="rounded-[2px] border border-rule px-1.5 py-0.5 text-[11px] text-ink"
                        >
                          {s}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {p.certifications.length > 0 ? (
                    <p className="mt-3 text-[12px] text-ink-muted">
                      {p.certifications
                        .map((c) => CERT_LABELS[c.cert] ?? c.cert)
                        .join(" · ")}
                    </p>
                  ) : null}

                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] text-ink-muted">
                    <div>
                      <dt className="inline">Availability </dt>
                      <dd className="inline text-ink">
                        {availabilityLabel(p.availability)}
                      </dd>
                    </div>
                    {p.leadTime != null ? (
                      <div>
                        <dt className="inline">Lead time </dt>
                        <dd className="inline font-data text-ink">{p.leadTime}d</dd>
                      </div>
                    ) : null}
                  </dl>

                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-rule pt-3">
                    <a
                      href={p.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn("text-[13px] text-accent editorial-link")}
                    >
                      Website
                    </a>
                    <span className="font-data text-[11px] text-ink-muted">
                      {p.email}
                    </span>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageFrame>
  );
}
