"use client";

import {
  type SpringOptions,
  type Transition,
  type Variants,
  useInView,
  useReducedMotion,
  useSpring,
} from "motion/react";
import { type RefObject, useEffect, useRef } from "react";

/** Exactly three public springs — BUILD_PLAN §3 Motion */
export const spring = {
  type: "spring",
  stiffness: 260,
  damping: 30,
} as const satisfies Transition;

export const springSoft = {
  type: "spring",
  stiffness: 180,
  damping: 24,
} as const satisfies Transition;

export const springSnap = {
  type: "spring",
  stiffness: 400,
  damping: 32,
} as const satisfies Transition;

/** Gauge needle — underdamped; not a fourth public spring; Gauge only */
export const needleSpringOptions: SpringOptions = {
  stiffness: 180,
  damping: 12,
  mass: 1.2,
};

export const arcSpringOptions: SpringOptions = {
  stiffness: 200,
  damping: 26,
};

/** @deprecated Prefer `spring` */
export const houseSpring: Transition = spring;

export const houseSpringOptions: SpringOptions = {
  stiffness: 260,
  damping: 30,
};

/** Authoritative cubic — ink settle / rule draw. Never bounce. */
export const inkEase = [0.22, 1, 0.36, 1] as const;

export const inkSettleTransition = {
  duration: 0.45,
  ease: inkEase,
} as const satisfies Transition;

export const ruleDrawTransition = {
  duration: 0.5,
  ease: inkEase,
} as const satisfies Transition;

/** One-shot scroll viewport — never re-trigger on scroll-back */
export const onceViewport = {
  once: true,
  margin: "-40px 0px" as const,
  amount: 0.2 as const,
};

export const onceViewportTight = {
  once: true,
  margin: "-20px 0px" as const,
  amount: 0.15 as const,
};

/**
 * Page assembly delays (seconds). Always chrome → structure → data.
 * Stagger 40ms between layers — never simultaneous.
 */
export const pageLayer = {
  chrome: 0,
  structure: 0.04,
  data: 0.08,
} as const;

export type PageLayer = keyof typeof pageLayer;

/** Hero print order on first load (seconds) */
export const heroStage = {
  chromeRules: 0,
  masthead: 0.12,
  gauge: 0.28,
  primaryMetric: 0.55,
} as const;

export const stagger = {
  container: {
    animate: {
      transition: { staggerChildren: 0.04, delayChildren: 0.06 },
    },
  },
  item: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0, transition: inkSettleTransition },
  },
} as const;

/** Variants: ink settles onto paper (opacity + 8–12px rise) */
export const inkRevealVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

export const inkRevealChildVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      ...inkSettleTransition,
      delay: typeof i === "number" ? i * 0.04 : 0,
    },
  }),
};

/** Variants: structural rules draw themselves */
export const ruleDrawXVariants: Variants = {
  hidden: { scaleX: 0 },
  visible: { scaleX: 1 },
};

export const ruleDrawYVariants: Variants = {
  hidden: { scaleY: 0 },
  visible: { scaleY: 1 },
};

const INSTANT: Transition = { type: "tween", duration: 0 };

export function useMotionSafe(variant: "house" | "soft" | "snap" = "house"): Transition {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return INSTANT;
  }

  if (variant === "soft") return springSoft;
  if (variant === "snap") return springSnap;
  return spring;
}

export function usePrefersReducedMotion(): boolean {
  return Boolean(useReducedMotion());
}

type InkRevealOptions = {
  delay?: number;
  layer?: PageLayer;
  /** When true, animate on mount instead of whileInView (hero / above-fold). */
  onMount?: boolean;
  rise?: number;
};

/**
 * Ink-settle reveal props for motion elements.
 * Short opacity + rise; staggered via delay / layer. One-shot.
 */
export function useInkReveal({
  delay = 0,
  layer,
  onMount = false,
  rise = 10,
}: InkRevealOptions = {}) {
  const reduced = usePrefersReducedMotion();
  const layerDelay = layer ? pageLayer[layer] : 0;
  const totalDelay = reduced ? 0 : delay + layerDelay;

  const initial = reduced ? false : { opacity: 0, y: rise };
  const visible = { opacity: 1, y: 0 };
  const transition: Transition = reduced
    ? INSTANT
    : { ...inkSettleTransition, delay: totalDelay };

  if (onMount) {
    return {
      initial,
      animate: visible,
      transition,
    };
  }

  return {
    initial,
    whileInView: visible,
    viewport: onceViewport,
    transition,
  };
}

type RuleDrawOptions = {
  delay?: number;
  axis?: "x" | "y";
  /** 400–600ms */
  duration?: number;
  onMount?: boolean;
};

/**
 * Structural rule draw props — scaleX/scaleY from origin.
 * Rules arrive before the content they frame.
 */
export function useRuleDraw({
  delay = 0,
  axis = "x",
  duration = 0.5,
  onMount = false,
}: RuleDrawOptions = {}) {
  const reduced = usePrefersReducedMotion();
  const hidden = axis === "x" ? { scaleX: 0 } : { scaleY: 0 };
  const visible = axis === "x" ? { scaleX: 1 } : { scaleY: 1 };
  const transition: Transition = reduced
    ? INSTANT
    : { duration: Math.min(0.6, Math.max(0.4, duration)), ease: inkEase, delay };

  if (onMount) {
    return {
      initial: reduced ? false : hidden,
      animate: visible,
      transition,
    };
  }

  return {
    initial: reduced ? false : hidden,
    whileInView: visible,
    viewport: onceViewportTight,
    transition,
  };
}

type CountUpOptions = {
  /** Seconds before the counter starts rolling */
  delay?: number;
  enabled?: boolean;
  /** When false, count on mount (hero staged delays). Default: scroll-enter. */
  inView?: boolean;
};

/**
 * Mechanical tick-count into `value` — JetBrains Mono / tabular via the Metric consumer.
 * One-shot; reduced motion → jump to final.
 */
export function useCountUp(
  value: number,
  { delay = 0, enabled = true, inView: useInViewTrigger = true }: CountUpOptions = {},
) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<Element | null>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px 0px", amount: 0.2 });
  const shouldAnimate = enabled && !reduced;
  const armed = !useInViewTrigger || isInView || reduced || !shouldAnimate;

  const springValue = useSpring(shouldAnimate && !armed ? 0 : value, {
    stiffness: 120,
    damping: 22,
    mass: 0.8,
  });

  useEffect(() => {
    if (!shouldAnimate) {
      springValue.jump(value);
      return;
    }
    if (!armed) {
      springValue.jump(0);
      return;
    }
    springValue.jump(0);
    const id = window.setTimeout(() => {
      springValue.set(value);
    }, delay * 1000);
    return () => window.clearTimeout(id);
  }, [value, shouldAnimate, armed, delay, springValue]);

  return {
    ref: ref as RefObject<Element | null>,
    springValue,
    reduced,
  };
}
