"use client";

import Link from "next/link";
import { useState } from "react";

import { PageCard, PageFrame, StatusLine } from "@/components/shell/PageFrame";
import { appFieldClass, AppField, AppSelectNative } from "@/components/ui/AppField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildOpenSupplyHubUrl } from "@/lib/openSupplyHub";
import {
  describeEnforcementFlag,
  describeSbtiStatus,
  isRegistryRiskConcern,
  parseSourcesText,
  SBTI_STATUSES,
  SBTI_STATUS_LABELS,
  type EnforcementFlag,
  type SbtiStatus,
} from "@/lib/suppliers";
import { cn } from "@/lib/utils";

export type SupplierDetailDto = {
  id: string;
  name: string;
  contactEmail: string;
  category: string;
  annualSpend: number | null;
  country: string | null;
  openSupplyHubId: string | null;
  registryRisk: {
    sbtiStatus: SbtiStatus;
    enforcementFlag: EnforcementFlag;
    sources: string;
    notes: string | null;
    lastReviewedAt: string | null;
  };
};

const ENFORCEMENT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "unknown", label: "Unknown / not checked" },
  { value: "false", label: "Clear (checked, none found)" },
  { value: "true", label: "Flagged (known enforcement action)" },
];

function enforcementToSelectValue(flag: EnforcementFlag): string {
  if (flag === true) return "true";
  if (flag === false) return "false";
  return "unknown";
}

function selectValueToEnforcement(value: string): EnforcementFlag {
  if (value === "true") return true;
  if (value === "false") return false;
  return "unknown";
}

export function SupplierDetailClient({
  supplier,
  canWrite,
}: {
  supplier: SupplierDetailDto;
  canWrite: boolean;
}) {
  const [osIdInput, setOsIdInput] = useState(supplier.openSupplyHubId ?? "");
  const [sbtiStatus, setSbtiStatus] = useState<SbtiStatus>(
    supplier.registryRisk.sbtiStatus,
  );
  const [enforcementFlag, setEnforcementFlag] = useState<EnforcementFlag>(
    supplier.registryRisk.enforcementFlag,
  );
  const [sources, setSources] = useState(supplier.registryRisk.sources);
  const [notes, setNotes] = useState(supplier.registryRisk.notes ?? "");
  const [savedOpenSupplyHubId, setSavedOpenSupplyHubId] = useState(
    supplier.openSupplyHubId,
  );
  const [lastReviewedAt, setLastReviewedAt] = useState(
    supplier.registryRisk.lastReviewedAt,
  );
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"neutral" | "error" | "ok">("neutral");

  const osUrl = buildOpenSupplyHubUrl(savedOpenSupplyHubId);
  const concern = isRegistryRiskConcern({ sbtiStatus, enforcementFlag });

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/app/suppliers/${supplier.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openSupplyHubId: osIdInput.trim() ? osIdInput.trim() : null,
          registryRisk: {
            sbtiStatus,
            enforcementFlag,
            sources,
            notes: notes.trim() ? notes.trim() : null,
          },
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setStatusTone("error");
        setStatus(data.error ?? "Could not save. Try again.");
        return;
      }
      setSavedOpenSupplyHubId(osIdInput.trim() ? osIdInput.trim().toUpperCase() : null);
      setLastReviewedAt(new Date().toISOString());
      setStatusTone("ok");
      setStatus("Saved.");
    } catch {
      setStatusTone("error");
      setStatus("Network error saving. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageFrame
      eyebrow="Supply chain"
      title={supplier.name}
      help="Open Supply Hub linkage and public-registry risk flags. Flags are operator-entered or CSV-imported — never a computed score."
      actions={
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/suppliers/${supplier.id}/scorecard`}
            className="inline-flex h-8 items-center rounded-[4px] border border-rule bg-surface-1 px-3 text-[12px] text-ink hover:border-rule-strong"
          >
            ESG scorecard
          </Link>
          <Link
            href={`/suppliers/${supplier.id}/risk-breakdown`}
            className="inline-flex h-8 items-center rounded-[4px] border border-rule bg-surface-1 px-3 text-[12px] text-ink hover:border-rule-strong"
          >
            Risk breakdown
          </Link>
          <Link
            href={`/suppliers/${supplier.id}/tier-emissions`}
            className="inline-flex h-8 items-center rounded-[4px] border border-rule bg-surface-1 px-3 text-[12px] text-ink hover:border-rule-strong"
          >
            Tier emissions
          </Link>
          <Link
            href="/suppliers"
            className="text-[13px] text-accent hover:text-accent-hover"
          >
            Back to suppliers
          </Link>
        </div>
      }
    >
      {status ? <StatusLine tone={statusTone}>{status}</StatusLine> : null}

      <div className="space-y-6">
        <PageCard title="Supplier">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-[12px] text-ink-muted">Category</p>
              <p className="text-ink">{supplier.category}</p>
            </div>
            <div>
              <p className="text-[12px] text-ink-muted">Email</p>
              <p className="text-ink">{supplier.contactEmail}</p>
            </div>
            <div>
              <p className="text-[12px] text-ink-muted">Country</p>
              <p className="text-ink">{supplier.country ?? "Not specified"}</p>
            </div>
          </div>
        </PageCard>

        <PageCard title="Open Supply Hub (Y07)">
          <p className="mb-3 text-[13px] text-ink-muted">
            Enter the supplier&apos;s free OS ID to link its public production-location
            profile. Never inferred — operator-entered only.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1">
              <AppField
                label="OS ID"
                placeholder="e.g. US2021250D1DTN7"
                value={osIdInput}
                disabled={!canWrite}
                onChange={(e) => setOsIdInput(e.target.value)}
              />
            </div>
            {osUrl ? (
              <a
                href={osUrl}
                target="_blank"
                rel="noreferrer"
                className="editorial-link pb-2 text-[13px] text-accent"
              >
                View OS Hub profile ↗
              </a>
            ) : savedOpenSupplyHubId ? (
              <p className="pb-2 text-[12px] text-ink-muted">
                Stored ID doesn&apos;t match the expected OS ID format — link withheld.
              </p>
            ) : null}
          </div>
        </PageCard>

        <PageCard title="Public-registry risk (Y08)">
          <p className="mb-4 text-[13px] text-ink-muted">
            Operator-entered / public registry — not a score. Sourced manually or via CSV
            import from public registries (e.g. the SBTi companies list, a
            regulator&apos;s public enforcement register).
          </p>

          {concern ? (
            <div
              role="status"
              className="mb-4 rounded-[6px] border border-rust/40 bg-rust/10 px-3 py-2 text-[13px] text-rust"
            >
              Flagged for attention — enforcement action known or no SBTi commitment on
              record. Not a numeric score; review the underlying source.
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <AppSelectNative
              label="SBTi status"
              value={sbtiStatus}
              disabled={!canWrite}
              onChange={(e) => setSbtiStatus(e.target.value as SbtiStatus)}
            >
              {SBTI_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {SBTI_STATUS_LABELS[s]}
                </option>
              ))}
            </AppSelectNative>
            <AppSelectNative
              label="Enforcement flag"
              value={enforcementToSelectValue(enforcementFlag)}
              disabled={!canWrite}
              onChange={(e) =>
                setEnforcementFlag(selectValueToEnforcement(e.target.value))
              }
            >
              {ENFORCEMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </AppSelectNative>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-ink-muted">
              <span className="label-caps">Sources (one per line)</span>
              <textarea
                className={cn(appFieldClass, "min-h-[84px]")}
                value={sources}
                disabled={!canWrite}
                placeholder={"https://sciencebasedtargets.org/companies-taking-action"}
                onChange={(e) => setSources(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-muted">
              <span className="label-caps">Notes</span>
              <textarea
                className={cn(appFieldClass, "min-h-[84px]")}
                value={notes}
                disabled={!canWrite}
                placeholder="Context for the flags above"
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-rule pt-3">
            <div className="flex flex-wrap gap-2 text-[11px] text-ink-muted">
              <Badge variant="outline">{describeSbtiStatus(sbtiStatus)}</Badge>
              <Badge variant="outline">{describeEnforcementFlag(enforcementFlag)}</Badge>
              {parseSourcesText(sources).length > 0 ? (
                <span>{parseSourcesText(sources).length} source(s)</span>
              ) : null}
              {lastReviewedAt ? (
                <span>Last reviewed {new Date(lastReviewedAt).toLocaleDateString()}</span>
              ) : null}
            </div>
            {canWrite ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/suppliers/registry-risk-import"
                  className="text-[12px] text-accent underline-offset-2 hover:underline"
                >
                  Bulk CSV import
                </Link>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void save()}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            ) : null}
          </div>
        </PageCard>
      </div>
    </PageFrame>
  );
}
