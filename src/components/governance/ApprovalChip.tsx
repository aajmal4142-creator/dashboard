import { cn } from "@/lib/utils";

export type ApprovalState = "pending" | "approved" | "rejected";

const LABEL: Record<ApprovalState, string> = {
  pending: "Not audited",
  approved: "Validated",
  rejected: "Sent back",
};

/**
 * Traffic-light approval chip. §18.1.3 — uses data colour tokens only.
 * Placeholder is visually distinct from every real state (1.5E.4) —
 * dashed border, hollow dot, copy that cannot be read as approval.
 */
export function ApprovalChip({
  state,
  className,
  placeholder = false,
}: {
  state?: ApprovalState | string | null;
  className?: string;
  /** Distinct from pending/approved/rejected — never reads as genuine approval */
  placeholder?: boolean;
}) {
  if (placeholder) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-[2px] border border-dashed border-rule px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-muted",
          className,
        )}
      >
        <span
          aria-hidden
          className="size-1.5 rounded-full border border-rule bg-transparent"
        />
        Status unavailable
      </span>
    );
  }

  const s: ApprovalState =
    state === "approved" || state === "rejected" ? state : "pending";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[2px] border border-[var(--rule)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[var(--ink)]",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          s === "approved" && "bg-[var(--signal)]",
          s === "pending" && "bg-[var(--amber)]",
          s === "rejected" && "bg-[var(--rust)]",
        )}
      />
      {LABEL[s]}
    </span>
  );
}
