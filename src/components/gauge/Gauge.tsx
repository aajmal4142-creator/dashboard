"use client";

import { motion, useInView, useMotionValue, useSpring, useTransform } from "motion/react";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";

import { Metric } from "@/components/ui/metric";
import {
  arcSpringOptions,
  needleSpringOptions,
  springSoft,
  usePrefersReducedMotion,
} from "@/lib/motion";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

/** false on server + hydration; true after client mount (avoids motion mismatch). */
function useIsClient(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

type GaugeProps = {
  score: number;
  previousScore?: number | null;
  estimated?: boolean;
  size?: number;
  className?: string;
  /**
   * Live mode: needle follows score without bravura reset.
   * Use after the hero sweep has settled.
   */
  live?: boolean;
  /**
   * Wait for scroll-enter before the bravura sweep (one-shot).
   * Default true when not live.
   */
  playOnView?: boolean;
  /** Extra delay (s) before the needle starts — hero staging. */
  playDelay?: number;
};

function bandColor(score: number): string {
  if (score >= 70) return "var(--signal)";
  if (score >= 45) return "var(--amber)";
  return "var(--rust)";
}

function polar(
  cx: number,
  cy: number,
  angleDeg: number,
  radius: number,
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  /* Round for stable SSR/client SVG attribute strings */
  return {
    x: Math.round((cx + radius * Math.cos(rad)) * 1000) / 1000,
    y: Math.round((cy + radius * Math.sin(rad)) * 1000) / 1000,
  };
}

/** Tapered needle: 7px at hub → 1.5px at tip — oxblood ink */
function needlePath(cx: number, cy: number, length: number): string {
  const hubHalf = 3.5;
  const tipHalf = 0.75;
  return [
    `M ${cx - hubHalf} ${cy}`,
    `L ${cx - tipHalf} ${cy - length}`,
    `L ${cx + tipHalf} ${cy - length}`,
    `L ${cx + hubHalf} ${cy}`,
    "Z",
  ].join(" ");
}

/**
 * Printed dial on good paper — three placements: marketing hero, dashboard, PDF page 1.
 * Ink on cream (dark: warm-paper-on-black). Engraved ticks. Oxblood needle.
 * Underdamped oscillation is a SPEC, not a bug.
 */
export function Gauge({
  score,
  previousScore = null,
  estimated = false,
  size = 280,
  className,
  live = false,
  playOnView = true,
  playDelay = 0,
}: GaugeProps) {
  const reducedPref = usePrefersReducedMotion();
  const mounted = useIsClient();
  /** Prefer false until mount so SSR markup matches the first client paint. */
  const reduced = mounted ? reducedPref : false;
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { once: true, margin: "-40px 0px", amount: 0.25 });
  const canPlay = live || !playOnView || inView || reduced;

  const clamped = Math.max(0, Math.min(100, score));
  const startAngle = -210;
  const sweep = 240;
  const r = size * 0.38;
  const cx = size / 2;
  const cy = size / 2 + size * 0.06;
  const dishR = r + 28;
  const needleLen = r - 14;

  const progress = useMotionValue(reduced || live ? clamped / 100 : 0);
  const needleSpring = useSpring(progress, {
    ...(reduced ? { stiffness: 1000, damping: 100, mass: 0.1 } : needleSpringOptions),
  });
  const arcProgress = useMotionValue(reduced || live ? clamped / 100 : 0);
  const arcSpring = useSpring(arcProgress, {
    ...(reduced ? { stiffness: 1000, damping: 100, mass: 0.1 } : arcSpringOptions),
  });

  useEffect(() => {
    const target = clamped / 100;
    if (reduced) {
      progress.jump(target);
      arcProgress.jump(target);
      return;
    }
    if (live) {
      progress.set(target);
      window.setTimeout(() => arcProgress.set(target), 40);
      return;
    }
    if (!canPlay) {
      progress.jump(0);
      arcProgress.jump(0);
      return;
    }
    progress.jump(0);
    arcProgress.jump(0);
    let raf = 0;
    const timeout = window.setTimeout(() => {
      raf = requestAnimationFrame(() => {
        progress.set(target);
        window.setTimeout(() => arcProgress.set(target), 40);
      });
    }, playDelay * 1000);
    return () => {
      window.clearTimeout(timeout);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [clamped, progress, arcProgress, reduced, live, canPlay, playDelay]);

  const rotation = useTransform(needleSpring, (p) => startAngle + 90 + sweep * p);
  const arcLength = arcSpring;
  const ticks = useMemo(() => Array.from({ length: 21 }, (_, i) => i * 5), []);

  const start = polar(cx, cy, startAngle, r);
  const end = polar(cx, cy, startAngle + sweep, r);
  const arcPath = `M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${end.x} ${end.y}`;

  const ghostRotation =
    previousScore === null || previousScore === undefined
      ? null
      : startAngle + 90 + sweep * (Math.max(0, Math.min(100, previousScore)) / 100);

  const band = bandColor(clamped);
  const readoutDelay = reduced || live ? 0 : playDelay + 1.3;

  /* Avoid SSR/client float drift on SVG tick coordinates (Node vs browser Math). */
  if (!mounted) {
    return (
      <div
        className={cn("relative inline-flex flex-col items-center", className)}
        style={{ width: size, height: size * 0.72 + 48 }}
        aria-hidden
      />
    );
  }

  return (
    <div
      ref={rootRef}
      className={cn("relative inline-flex flex-col items-center", className)}
    >
      <div className="relative" style={{ width: size, height: size * 0.72 }}>
        <div
          className="gauge-dish pointer-events-none absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ width: dishR * 2, height: dishR * 2 }}
          aria-hidden
        />
        <svg
          width={size}
          height={size * 0.72}
          viewBox={`0 0 ${size} ${size * 0.72}`}
          className="relative z-[1]"
          role="img"
          aria-label={`ESG score ${Math.round(clamped)}${estimated ? ", estimated" : ""}`}
        >
          {/* Thin engraved dial ring — not a glowing bezel */}
          <path d={arcPath} fill="none" stroke="var(--dial-ring)" strokeWidth={1.25} />
          <motion.path
            d={arcPath}
            fill="none"
            stroke={band}
            strokeWidth={3.5}
            strokeLinecap="butt"
            pathLength={1}
            style={{ pathLength: arcLength }}
          />

          {ticks.map((v, i) => {
            const a = startAngle + sweep * (v / 100);
            const major = v % 20 === 0;
            /* Engraved ticks: short major gradations, hairline minors */
            const outer = polar(cx, cy, a, r - 3);
            const inner = polar(cx, cy, a, r - (major ? 12 : 6));
            const label = polar(cx, cy, a, r - 24);
            return (
              <motion.g
                key={v}
                initial={false}
                animate={{ opacity: !mounted || canPlay || reduced ? 1 : 0 }}
                transition={{
                  ...springSoft,
                  delay: reduced || !canPlay || !mounted ? 0 : playDelay + i * 0.008,
                }}
              >
                <line
                  x1={inner.x}
                  y1={inner.y}
                  x2={outer.x}
                  y2={outer.y}
                  stroke={major ? "var(--ink)" : "var(--rule-strong)"}
                  strokeWidth={major ? 1.25 : 0.75}
                />
                {major ? (
                  <text
                    x={label.x}
                    y={label.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="var(--ink)"
                    fontSize={11}
                    fontFamily="var(--font-jetbrains-mono)"
                  >
                    {v}
                  </text>
                ) : null}
              </motion.g>
            );
          })}

          {ghostRotation !== null ? (
            <g transform={`rotate(${ghostRotation} ${cx} ${cy})`}>
              <line
                x1={cx}
                y1={cy}
                x2={cx}
                y2={cy - needleLen}
                stroke="var(--rule-strong)"
                strokeWidth={1}
                strokeOpacity={0.6}
              />
            </g>
          ) : null}

          <motion.g style={{ rotate: rotation, transformOrigin: `${cx}px ${cy}px` }}>
            <path d={needlePath(cx, cy, needleLen)} fill="var(--accent)" />
            <line
              x1={cx}
              y1={cy}
              x2={cx}
              y2={cy - needleLen}
              stroke="var(--canvas)"
              strokeWidth={0.7}
            />
          </motion.g>

          <circle
            cx={cx}
            cy={cy}
            r={7}
            fill="var(--surface-1)"
            stroke="var(--dial-ring)"
            strokeWidth={1}
          />
          <circle cx={cx} cy={cy} r={3} fill="var(--accent)" />
        </svg>

        <div className="pointer-events-none absolute inset-x-0 bottom-[6%] flex flex-col items-center">
          <Metric
            value={clamped}
            decimals={0}
            size="gauge"
            animate={!live}
            animateDelay={readoutDelay}
            inView={false}
          />
          {estimated ? (
            <span className="label-caps mt-2 text-amber">Estimated</span>
          ) : (
            <span className="label-caps mt-2">Overall</span>
          )}
        </div>
      </div>
    </div>
  );
}
