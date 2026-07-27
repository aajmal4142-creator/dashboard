"use client";

import { motion, type MotionValue, useTransform } from "motion/react";
import type { RefObject } from "react";

import { useCountUp } from "@/lib/motion";
import { cn } from "@/lib/utils";

export { Assemble } from "@/components/motion";

type MetricSize = "sm" | "md" | "lg" | "xl" | "display" | "gauge";

const SIZE_CLASS: Record<MetricSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
  xl: "text-2xl",
  display: "text-[56px] leading-none md:text-[80px]",
  gauge: "text-[80px] leading-none md:text-[112px] font-medium",
};

type MetricTone = "ink" | "signal" | "amber" | "rust" | "muted" | "bone" | "ash";

type MetricProps = {
  value: number;
  unit?: string;
  decimals?: number;
  size?: MetricSize;
  /** Mechanical count-up on enter. Default true. */
  animate?: boolean;
  /** Seconds before the counter starts (hero staging). */
  animateDelay?: number;
  /**
   * When true (default), count starts on scroll-enter (one-shot).
   * Set false for hero/mount staging with animateDelay only.
   */
  inView?: boolean;
  className?: string;
  integerClassName?: string;
  unitClassName?: string;
  tone?: MetricTone;
};

function splitParts(
  value: number,
  decimals: number | undefined,
): { integer: string; fraction: string | null } {
  const abs = Math.abs(value);
  let fixed: string;
  if (decimals !== undefined) {
    fixed = abs.toFixed(decimals);
  } else if (Number.isInteger(abs) || Math.abs(abs - Math.round(abs)) < 1e-9) {
    fixed = String(Math.round(abs));
  } else {
    const rounded = Math.round(abs * 100) / 100;
    fixed = String(rounded);
  }

  const [intPart, fracPart] = fixed.split(".");
  const sign = value < 0 ? "-" : "";
  return {
    integer: `${sign}${intPart}`,
    fraction: fracPart !== undefined && fracPart.length > 0 ? fracPart : null,
  };
}

function MetricDigits({
  springValue,
  decimals,
  toneClass,
  integerClassName,
}: {
  springValue: MotionValue<number>;
  decimals: number | undefined;
  toneClass: string;
  integerClassName?: string;
}) {
  const integer = useTransform(springValue, (v) => splitParts(v, decimals).integer);
  const fraction = useTransform(springValue, (v) => {
    const f = splitParts(v, decimals).fraction;
    return f !== null ? `.${f}` : "";
  });

  return (
    <span className={cn("font-medium", toneClass, integerClassName)}>
      <motion.span>{integer}</motion.span>
      <motion.span className="text-[0.85em] text-ink-muted">{fraction}</motion.span>
    </span>
  );
}

/**
 * Editorial number primitive — integer at --ink weight 500, decimal muted @ 0.85em,
 * unit as 12px uppercase label. JetBrains Mono, tabular, slashed zero.
 * Counts up on scroll-enter (printed counter) unless animate={false}.
 */
export function Metric({
  value,
  unit,
  decimals,
  size = "md",
  animate = true,
  animateDelay = 0,
  inView = true,
  className,
  integerClassName,
  unitClassName,
  tone = "ink",
}: MetricProps) {
  const { ref, springValue } = useCountUp(value, {
    delay: animateDelay,
    enabled: animate,
    inView,
  });

  const toneClass =
    tone === "signal"
      ? "text-signal"
      : tone === "amber"
        ? "text-amber"
        : tone === "rust"
          ? "text-rust"
          : tone === "muted" || tone === "ash"
            ? "text-ink-muted"
            : "text-ink";

  return (
    <span
      ref={ref as RefObject<HTMLSpanElement | null>}
      className={cn("font-data inline-flex items-baseline", SIZE_CLASS[size], className)}
    >
      <MetricDigits
        springValue={springValue}
        decimals={decimals}
        toneClass={toneClass}
        integerClassName={integerClassName}
      />
      {unit ? (
        <span
          className={cn(
            "label-caps ml-[0.4em] !normal-case tracking-normal",
            unitClassName,
          )}
        >
          {unit}
        </span>
      ) : null}
    </span>
  );
}
