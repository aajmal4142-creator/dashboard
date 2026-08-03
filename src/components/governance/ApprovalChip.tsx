import { cn } from "@/lib/utils";

export type ApprovalState = "pending" | "approved" | "rejected";

const LEGACY_LABEL: Record<ApprovalState, string> = {
  pending: "Not audited",
  approved: "Validated",
  rejected: "Sent back",
};

const STEP_LABEL: Record<string, string> = {
  prepare: "Prepare",
  review: "Review",
  approve: "Approve",
  lock: "Locked",
};

/**
 * Traffic-light approval chip. §18.1.3 — uses data colour tokens only.
 * Supports legacy approvalState and multi-step chain (step + chainStatus).
 */
export function ApprovalChip({
  state,
  step,
  chainStatus,
  className,
  placeholder = false,
}: {
  state?: ApprovalState | string | null;
  step?: string | null;
  chainStatus?: string | null;
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

  if (chainStatus === "locked" || step === "lock") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-[2px] border border-[var(--rule)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[var(--ink)]",
          className,
        )}
      >
        <span aria-hidden className="size-1.5 rounded-full bg-[var(--signal)]" />
        Locked
      </span>
    );
  }

  if (chainStatus === "rejected") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-[2px] border border-[var(--rule)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[var(--ink)]",
          className,
        )}
      >
        <span aria-hidden className="size-1.5 rounded-full bg-[var(--rust)]" />
        {step && STEP_LABEL[step] ? `${STEP_LABEL[step]} · sent back` : "Sent back"}
      </span>
    );
  }

  if (step && STEP_LABEL[step]) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-[2px] border border-[var(--rule)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[var(--ink)]",
          className,
        )}
      >
        <span aria-hidden className="size-1.5 rounded-full bg-[var(--amber)]" />
        {STEP_LABEL[step]}
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
      {LEGACY_LABEL[s]}
    </span>
  );
}
