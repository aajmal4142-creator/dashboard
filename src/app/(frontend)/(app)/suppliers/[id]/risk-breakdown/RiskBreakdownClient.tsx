"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

import type { RiskScoreBreakdown } from "@/lib/suppliers/riskScoringEngine";
import { PageCard, PageFrame } from "@/components/shell/PageFrame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SupplierInfo {
  id: string;
  name: string;
  category: string;
  annualSpend: number | null;
  contactEmail: string;
}

function badgeVariant(badge: "low" | "medium" | "high"): "signal" | "amber" | "rust" {
  if (badge === "low") return "signal";
  if (badge === "medium") return "amber";
  return "rust";
}

function badgeLabel(badge: "low" | "medium" | "high"): string {
  if (badge === "low") return "Low";
  if (badge === "medium") return "Med";
  return "High";
}

function getTierDescription(tier: string): string {
  switch (tier) {
    case "low":
      return "Strong ESG signals across environmental, social, and governance pillars.";
    case "medium":
      return "Mixed ESG signals. Engage on incomplete pillars.";
    case "high":
      return "Elevated ESG risk. Prioritise mitigation and data collection.";
    case "critical":
      return "Critical ESG risk. Escalate engagement and track mitigations.";
    default:
      return "";
  }
}

export function RiskBreakdownClient({
  supplier,
  breakdown,
}: {
  supplier: SupplierInfo;
  breakdown: RiskScoreBreakdown | null;
}) {
  const [mitigations, setMitigations] = useState(breakdown?.mitigations ?? []);
  const [action, setAction] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addMitigation(e: React.FormEvent) {
    e.preventDefault();
    if (!action.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/app/suppliers/${supplier.id}/risk-breakdown`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: action.trim(), status: "open" }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Could not save mitigation.");
        return;
      }
      const data = (await res.json()) as {
        mitigations: typeof mitigations;
      };
      setMitigations(data.mitigations);
      setAction("");
    } catch {
      setError("Could not save mitigation. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function markDone(id: string, currentAction: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/app/suppliers/${supplier.id}/risk-breakdown`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: currentAction, status: "done" }),
      });
      if (!res.ok) {
        setError("Could not update mitigation status.");
        return;
      }
      const data = (await res.json()) as { mitigations: typeof mitigations };
      setMitigations(data.mitigations);
    } catch {
      setError("Could not update mitigation status.");
    } finally {
      setSaving(false);
    }
  }

  if (!breakdown) {
    return (
      <PageFrame eyebrow="Supply chain" title={supplier.name} help="Risk score breakdown">
        <PageCard>
          <p className="text-[13px] text-amber">
            Risk score could not be calculated. Ensure the supplier has ESG or
            questionnaire data, then recalculate.
          </p>
          <Link
            href="/suppliers/risk-dashboard"
            className="mt-4 inline-block text-[13px] text-accent"
          >
            Back to risk dashboard
          </Link>
        </PageCard>
      </PageFrame>
    );
  }

  const pillars = [
    {
      key: "environmental",
      label: "Environmental",
      weight: "40%",
      score: breakdown.factors.environmental.score,
      contributors: breakdown.factors.environmental.contributors,
      help: "Missing emissions, YoY trend, ISO 14001 / env certifications",
    },
    {
      key: "social",
      label: "Social",
      weight: "30%",
      score: breakdown.factors.social.score,
      contributors: breakdown.factors.social.contributors,
      help: "UN Global Compact, social certifications, questionnaire, compliance",
    },
    {
      key: "governance",
      label: "Governance",
      weight: "30%",
      score: breakdown.factors.governance.score,
      contributors: breakdown.factors.governance.contributors,
      help: "B Corp, data completeness, regulatory flags",
    },
  ] as const;

  return (
    <PageFrame
      eyebrow="Supply chain"
      title={supplier.name}
      help="Pillar breakdown for the ESG risk score (higher = worse)."
      actions={
        <Link
          href="/suppliers/risk-dashboard"
          className="text-[13px] text-accent hover:text-accent-hover"
        >
          Back to dashboard
        </Link>
      }
    >
      {breakdown.highRiskAlert ||
      breakdown.tier === "high" ||
      breakdown.tier === "critical" ? (
        <div
          role="status"
          className="mb-4 flex items-start gap-2 rounded-[6px] border border-rust/40 bg-rust/10 px-3 py-2 text-[13px] text-rust"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>
            High-risk alert. Track mitigations below and complete missing ESG data.
          </span>
        </div>
      ) : null}

      <PageCard className="mb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              Overall risk
            </p>
            <div className="mt-2 flex items-baseline gap-3">
              <p className="font-data text-[48px] font-bold leading-none text-ink">
                {breakdown.totalScore}
              </p>
              <Badge variant={badgeVariant(breakdown.badge)}>
                {badgeLabel(breakdown.badge)}
              </Badge>
            </div>
            <p className="mt-3 max-w-[66ch] text-[13px] text-ink-muted">
              {getTierDescription(breakdown.tier)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              Data quality
            </p>
            <p className="mt-1 text-[16px] font-semibold capitalize text-ink">
              {breakdown.dataQuality}
            </p>
          </div>
        </div>
      </PageCard>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        {pillars.map((pillar) => (
          <PageCard key={pillar.key}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  {pillar.label}
                </p>
                <p className="mt-1 font-data text-[28px] font-bold text-ink">
                  {pillar.score}
                </p>
              </div>
              <span className="rounded-[2px] border border-rule px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                {pillar.weight}
              </span>
            </div>
            <p className="mt-2 text-[12px] text-ink-muted">{pillar.help}</p>
            <ul className="mt-3 space-y-1 text-[11px] text-ink-muted">
              {pillar.contributors.map((c) => (
                <li key={c} className="font-data">
                  {c}
                </li>
              ))}
            </ul>
          </PageCard>
        ))}
      </div>

      <PageCard className="mb-4" title="Supplier">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[12px] text-ink-muted">Category</p>
            <p className="text-ink">{supplier.category}</p>
          </div>
          <div>
            <p className="text-[12px] text-ink-muted">Email</p>
            <p className="text-ink">{supplier.contactEmail}</p>
          </div>
          <div>
            <p className="text-[12px] text-ink-muted">Annual spend</p>
            <p className="font-data text-ink">
              {supplier.annualSpend != null
                ? `${(supplier.annualSpend / 1_000_000).toFixed(2)}M`
                : "Not specified"}
            </p>
          </div>
          <div>
            <p className="text-[12px] text-ink-muted">Flags</p>
            <p className="font-data text-[12px] text-ink">
              {breakdown.flags.length > 0 ? breakdown.flags.join(", ") : "None"}
            </p>
          </div>
        </div>
      </PageCard>

      <PageCard title="Mitigation tracking">
        {error ? <p className="mb-3 text-[13px] text-rust">{error}</p> : null}
        {mitigations.length === 0 ? (
          <p className="mb-3 text-[13px] text-ink-muted">
            No mitigation actions yet. Add one to track risk reduction work.
          </p>
        ) : (
          <ul className="mb-4 space-y-2">
            {mitigations.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-rule py-2 last:border-b-0"
              >
                <div>
                  <p className="text-[13px] text-ink">{m.action}</p>
                  <p className="font-data text-[11px] text-ink-muted">
                    {m.status}
                    {m.completedAt ? ` · ${m.completedAt.slice(0, 10)}` : ""}
                  </p>
                </div>
                {m.status !== "done" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={saving}
                    onClick={() => void markDone(m.id, m.action)}
                  >
                    Mark done
                  </Button>
                ) : (
                  <Badge variant="signal">Done</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={(e) => void addMitigation(e)} className="flex flex-wrap gap-2">
          <input
            type="text"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="Mitigation action"
            className="min-w-[220px] flex-1 rounded-[4px] border border-rule bg-surface-1 px-3 py-2 text-ink"
          />
          <Button type="submit" disabled={saving || !action.trim()}>
            Add mitigation
          </Button>
        </form>
      </PageCard>
    </PageFrame>
  );
}
