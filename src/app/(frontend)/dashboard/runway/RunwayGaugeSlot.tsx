"use client";

import dynamic from "next/dynamic";

const Gauge = dynamic(
  () => import("@/components/gauge/Gauge").then((mod) => ({ default: mod.Gauge })),
  {
    ssr: false,
    loading: () => (
      <div
        className="animate-pulse rounded-full bg-surface-2"
        style={{ width: 160, height: 120 }}
        aria-hidden
      />
    ),
  },
);

export function RunwayGaugeSlot({ score, size = 160 }: { score: number; size?: number }) {
  return <Gauge score={score} playOnView={false} size={size} />;
}
