import { cn } from "@/lib/utils";

export type RunwayStatusTone =
  "critical" | "warning" | "progress" | "success" | "neutral";

const TONE_CLASS: Record<RunwayStatusTone, string> = {
  critical: "bg-rust/10 text-rust",
  warning: "bg-amber/15 text-ink",
  progress: "bg-accent/10 text-accent",
  success: "bg-signal/10 text-signal",
  neutral: "bg-surface-2 text-ink-muted",
};

export function StatusBadge({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: RunwayStatusTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[4px] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]",
        TONE_CLASS[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}

export function statusFromApproval(state: string | undefined): {
  label: string;
  tone: RunwayStatusTone;
} {
  if (state === "approved") return { label: "Validated", tone: "success" };
  if (state === "rejected") return { label: "Sent back", tone: "critical" };
  if (state === "pending") return { label: "Not audited", tone: "warning" };
  return { label: "Not started", tone: "neutral" };
}

export function calmBadgeTone(level: string): RunwayStatusTone {
  if (level === "critical") return "critical";
  if (level === "at_risk") return "warning";
  if (level === "on_track") return "success";
  return "neutral";
}
