"use client";

import { useState } from "react";
import Link from "next/link";

import { Input } from "@/components/ui/input";
import { Metric } from "@/components/ui/metric";

/** Open illustrative factors — educational; production calc uses registry. */
const FACTORS: Record<string, { label: string; kgPerKwh: number; source: string }> = {
  IE: { label: "Ireland", kgPerKwh: 0.3, source: "Illustrative grid factor, 2024" },
  DE: { label: "Germany", kgPerKwh: 0.35, source: "Illustrative grid factor, 2024" },
  IN: { label: "India", kgPerKwh: 0.7, source: "Illustrative grid factor, 2024" },
  GB: {
    label: "United Kingdom",
    kgPerKwh: 0.2,
    source: "Illustrative grid factor, 2024",
  },
};

export function Scope2Calculator() {
  const [kwh, setKwh] = useState(100000);
  const [region, setRegion] = useState("IE");

  const f = FACTORS[region] ?? FACTORS.IE;
  const tco2e = (kwh * f.kgPerKwh) / 1000;

  return (
    <div className="surface-1 space-y-4 rounded-[4px] p-4">
      <label className="block text-sm text-ink-muted">
        Electricity (kWh)
        <Input
          type="number"
          className="mt-1"
          value={kwh}
          onChange={(e) => setKwh(Number(e.target.value))}
        />
      </label>
      <label className="block text-sm text-ink-muted">
        Region
        <select
          className="surface-2 mt-1 h-9 w-full rounded-[4px] px-3 text-ink"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
        >
          {Object.entries(FACTORS).map(([code, meta]) => (
            <option key={code} value={code}>
              {meta.label}
            </option>
          ))}
        </select>
      </label>
      <div className="surface-2 rounded-[4px] p-3">
        <p className="text-sm text-ink-muted">Location-based Scope 2</p>
        <Metric value={tco2e} unit="tCO2e" size="xl" decimals={2} tone="signal" />
        <div className="mt-2">
          <Metric
            value={f.kgPerKwh}
            unit="kgCO2e/kWh"
            size="sm"
            decimals={2}
            animate={false}
            tone="ash"
          />
        </div>
        <p className="mt-1 text-xs text-ink-muted">{f.source}</p>
        <p className="mt-4 text-sm text-ink-muted">
          Save this and track it over time →{" "}
          <Link href="/sign-up" className="text-ink underline">
            Start free
          </Link>
        </p>
      </div>
    </div>
  );
}
