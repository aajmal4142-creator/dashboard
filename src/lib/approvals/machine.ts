import {
  APPROVAL_STEPS,
  type ApprovalAction,
  type ApprovalStep,
  type ChainState,
  type ChainStatus,
  type LegacyApprovalState,
  type TransitionResult,
} from "./types";

const STEP_INDEX: Record<ApprovalStep, number> = {
  prepare: 0,
  review: 1,
  approve: 2,
  lock: 3,
};

export function isApprovalStep(value: unknown): value is ApprovalStep {
  return (
    value === "prepare" || value === "review" || value === "approve" || value === "lock"
  );
}

export function isApprovalAction(value: unknown): value is ApprovalAction {
  return value === "advance" || value === "reject" || value === "return";
}

export function isChainStatus(value: unknown): value is ChainStatus {
  return value === "in_progress" || value === "rejected" || value === "locked";
}

export function initialChainState(): ChainState {
  return { step: "prepare", status: "in_progress" };
}

/** Map legacy single-state field onto the multi-step chain. */
export function hydrateFromLegacy(approvalState: unknown): ChainState {
  if (approvalState === "approved") {
    return { step: "lock", status: "locked" };
  }
  if (approvalState === "rejected") {
    return { step: "prepare", status: "rejected" };
  }
  return initialChainState();
}

/** Keep `approvalState` in sync for callers that still read the legacy field. */
export function legacyApprovalState(state: ChainState): LegacyApprovalState {
  if (state.status === "locked") return "approved";
  if (state.status === "rejected") return "rejected";
  return "pending";
}

export function nextStep(step: ApprovalStep): ApprovalStep | null {
  const i = STEP_INDEX[step];
  if (i >= APPROVAL_STEPS.length - 1) return null;
  return APPROVAL_STEPS[i + 1] ?? null;
}

export function previousStep(step: ApprovalStep): ApprovalStep | null {
  const i = STEP_INDEX[step];
  if (i <= 0) return null;
  return APPROVAL_STEPS[i - 1] ?? null;
}

export function canTransition(state: ChainState, action: ApprovalAction): boolean {
  return transition(state, action).ok;
}

/**
 * Pure state-machine transition.
 * Illegal moves return `{ ok: false }` — never throw.
 */
export function transition(
  state: ChainState,
  action: ApprovalAction,
  opts?: {
    note?: string | null;
    assigneeRole?: string | null;
    assigneeUserId?: string | null;
  },
): TransitionResult {
  const note = opts?.note?.trim() ? opts.note.trim() : null;
  const assigneeRole = opts?.assigneeRole?.trim() ? opts.assigneeRole.trim() : null;
  const assigneeUserId = opts?.assigneeUserId?.trim() ? opts.assigneeUserId.trim() : null;

  if (state.status === "locked") {
    return { ok: false, error: "Chain is locked. No further transitions are allowed." };
  }

  if (action === "advance") {
    if (state.status === "rejected") {
      return {
        ok: false,
        error: "Rejected chain must be returned to prepare before advancing.",
      };
    }
    const to = nextStep(state.step);
    if (!to) {
      return { ok: false, error: "Already at final step; cannot advance." };
    }
    const next: ChainState =
      to === "lock"
        ? { step: "lock", status: "locked" }
        : { step: to, status: "in_progress" };
    return {
      ok: true,
      next,
      historyEntry: {
        fromStep: state.step,
        toStep: to,
        action: "advance",
        note,
        assigneeRole,
        assigneeUserId,
      },
    };
  }

  if (action === "reject") {
    if (state.status === "rejected") {
      return { ok: false, error: "Chain is already rejected." };
    }
    if (!note) {
      return { ok: false, error: "A reason is required when rejecting." };
    }
    return {
      ok: true,
      next: { step: state.step, status: "rejected" },
      historyEntry: {
        fromStep: state.step,
        toStep: state.step,
        action: "reject",
        note,
        assigneeRole,
        assigneeUserId,
      },
    };
  }

  // return
  if (state.status === "rejected") {
    return {
      ok: true,
      next: { step: "prepare", status: "in_progress" },
      historyEntry: {
        fromStep: state.step,
        toStep: "prepare",
        action: "return",
        note,
        assigneeRole,
        assigneeUserId,
      },
    };
  }

  const prev = previousStep(state.step);
  if (!prev) {
    return {
      ok: false,
      error: "Cannot return from prepare. Reject instead, or advance when ready.",
    };
  }

  return {
    ok: true,
    next: { step: prev, status: "in_progress" },
    historyEntry: {
      fromStep: state.step,
      toStep: prev,
      action: "return",
      note,
      assigneeRole,
      assigneeUserId,
    },
  };
}

/** Advance repeatedly until `target` step (inclusive) or lock. Illegal if target is behind. */
export function advanceTo(
  state: ChainState,
  target: ApprovalStep,
  opts?: { note?: string | null },
): TransitionResult {
  if (state.status === "locked") {
    return { ok: false, error: "Chain is locked. No further transitions are allowed." };
  }
  if (state.status === "rejected") {
    return {
      ok: false,
      error: "Rejected chain must be returned to prepare before advancing.",
    };
  }
  if (STEP_INDEX[target] < STEP_INDEX[state.step]) {
    return { ok: false, error: `Cannot advance backward to ${target}.` };
  }
  if (target === "lock") {
    if (state.step === "lock") {
      return { ok: false, error: "Already locked." };
    }
  } else if (state.step === target) {
    return { ok: false, error: `Already at ${target}.` };
  }

  let current = state;
  let last: TransitionResult | null = null;
  const done = (s: ChainState): boolean => {
    if (target === "lock") return s.status === "locked";
    return s.step === target;
  };

  while (!done(current)) {
    const result = transition(current, "advance", opts);
    if (!result.ok) return result;
    last = result;
    current = result.next;
  }
  if (!last || !last.ok) {
    return { ok: false, error: "Could not advance to target step." };
  }
  return last;
}
