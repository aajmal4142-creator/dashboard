import { cn } from "@/lib/utils";

type ProgressRingProps = {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  label?: string;
};

/** Circular readiness ring — Variant 5. Uses --signal for the fill. */
export function ProgressRing({
  value,
  size = 140,
  strokeWidth = 10,
  className,
  label = "complete",
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${Math.round(clamped)}% ${label}`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--signal)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-data text-[32px] font-bold leading-none text-ink">
          {Math.round(clamped)}
          <span className="text-lg text-ink-muted">%</span>
        </span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
          {label}
        </span>
      </div>
    </div>
  );
}
