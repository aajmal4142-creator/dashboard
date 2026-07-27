"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";

type Framework = "CSRD_SIMPLIFIED" | "BRSR";

function recommend(input: { sites: number; scope3: boolean; framework: Framework }): {
  plan: "Free" | "Pro" | "Consultant";
  reason: string;
} {
  if (input.sites > 15 || input.scope3) {
    return {
      plan: "Pro",
      reason:
        "Multiple sites or Scope 3 / supplier collection usually needs Pro (evidence vault + supplier requests).",
    };
  }
  if (input.framework === "BRSR" && input.sites <= 3 && !input.scope3) {
    return {
      plan: "Free",
      reason:
        "Small value-chain response can start on Free (watermarked PDF). Upgrade when you need evidence vault or more suppliers.",
    };
  }
  return {
    plan: "Pro",
    reason:
      "Full PDF without watermark, evidence vault, and supplier chains fit most SME filings.",
  };
}

export default function PriceEstimatePage() {
  const [sector, setSector] = useState("manufacturing");
  const [sites, setSites] = useState(3);
  const [scope3, setScope3] = useState(true);
  const [framework, setFramework] = useState<Framework>("BRSR");

  const result = useMemo(
    () => recommend({ sites, scope3, framework }),
    [sites, scope3, framework],
  );

  return (
    <MarketingLayout>
      <main className="mx-auto max-w-2xl flex-1 px-6 py-16">
        <p className="acid-label">Tool</p>
        <h1 className="mt-2 acid-display-sm text-ink">Price / readiness estimate</h1>
        <p className="mt-4 text-ink-muted">
          Self-serve plan recommendation. Indicative only — not a quote. IBM Envizi
          Essential for ~10 facilities with full GHG + value-chain modules often estimates
          near <span className="font-data text-ink">USD 90,000+/yr</span>.
        </p>

        <form className="mt-10 space-y-6 border-t border-rule pt-8">
          <label className="block text-sm">
            <span className="label-caps">Sector</span>
            <select
              className="mt-2 w-full border border-rule bg-surface-1 px-3 py-2 text-ink"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
            >
              <option value="manufacturing">Manufacturing</option>
              <option value="logistics">Logistics</option>
              <option value="professional-services">Professional services</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="label-caps">Number of sites / facilities</span>
            <input
              type="number"
              min={1}
              max={500}
              className="mt-2 w-full border border-rule bg-surface-1 px-3 py-2 font-data text-ink"
              value={sites}
              onChange={(e) => setSites(Number(e.target.value) || 1)}
            />
          </label>
          <fieldset>
            <legend className="label-caps">Scope 3 / suppliers needed?</legend>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={scope3}
                onChange={(e) => setScope3(e.target.checked)}
              />
              Yes — collect supplier or value-chain data
            </label>
          </fieldset>
          <fieldset>
            <legend className="label-caps">Framework focus</legend>
            <div className="mt-2 flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={framework === "BRSR"}
                  onChange={() => setFramework("BRSR")}
                />
                BRSR-readiness / India value-chain
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={framework === "CSRD_SIMPLIFIED"}
                  onChange={() => setFramework("CSRD_SIMPLIFIED")}
                />
                CSRD simplified
              </label>
            </div>
          </fieldset>
        </form>

        <div className="mt-10 border border-rule bg-surface-1 p-6">
          <p className="label-caps">Recommended</p>
          <p className="font-display mt-2 text-2xl text-ink">{result.plan}</p>
          <p className="mt-2 text-sm text-ink-muted">{result.reason}</p>
          <p className="mt-4 font-data text-xs text-ink-muted">
            ClearESG list: Free €0 · Pro €49/mo · Consultant €199/mo. Sector: {sector}.
          </p>
          <p className="mt-6">
            <Link href="/sign-up" className="acid-link">
              Start free
            </Link>
            {" · "}
            <Link href="/pricing" className="acid-link">
              Full pricing
            </Link>
            {" · "}
            <Link href="/compare/envizi" className="acid-link">
              vs Envizi
            </Link>
          </p>
        </div>
      </main>
    </MarketingLayout>
  );
}
