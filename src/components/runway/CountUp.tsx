"use client";

import { Metric } from "@/components/ui/metric";

/** @deprecated Prefer `<Metric />` — kept as a thin wrapper for existing call sites. */
export function CountUp({
  value,
  className,
  unit,
}: {
  value: number;
  className?: string;
  unit?: string;
}) {
  return (
    <Metric value={value} unit={unit} size="display" decimals={0} className={className} />
  );
}
