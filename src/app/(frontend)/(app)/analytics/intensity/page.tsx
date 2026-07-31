"use client";

import { Suspense } from "react";
import Link from "next/link";

import { PageFrame } from "@/components/shell/PageFrame";
import ConsumptionIntensity from "../ConsumptionIntensity";

function IntensityLoading() {
  return (
    <div
      className="h-64 w-full animate-pulse rounded-[6px] border border-rule bg-surface-2"
      aria-hidden
    />
  );
}

export default function IntensityDetailPage() {
  return (
    <PageFrame eyebrow="Analytics" title="Emissions intensity">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-[13px] text-ink-muted">
          Emissions per unit of activity — revenue, employees, output, and floor area —
          with year-over-year change and peer median comparison.
        </p>
        <Link
          href="/analytics"
          className="text-[12px] text-accent hover:text-accent-hover"
        >
          All analytics
        </Link>
      </div>
      <Suspense fallback={<IntensityLoading />}>
        <ConsumptionIntensity />
      </Suspense>
    </PageFrame>
  );
}
