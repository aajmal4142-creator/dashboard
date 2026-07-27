"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

import { InkReveal, RuleDraw } from "@/components/motion";
import { useInkReveal, useRuleDraw } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** @deprecated Prefer `<InkReveal />` from `@/components/motion` */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <InkReveal delay={delay} className={className}>
      {children}
    </InkReveal>
  );
}

/** @deprecated Prefer `<RuleDraw />` from `@/components/motion` */
export function HairlineRule({
  className,
  delay = 0,
  accent = false,
}: {
  className?: string;
  delay?: number;
  accent?: boolean;
}) {
  return <RuleDraw className={className} delay={delay} accent={accent} />;
}

export function StrikeReveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ink = useInkReveal({ delay });
  const strike = useRuleDraw({ delay: delay + 0.15, duration: 0.45 });

  return (
    <motion.li className={cn("relative text-ink-muted", className)} {...ink}>
      <span className="relative inline-block">
        {children}
        <motion.span
          aria-hidden
          className="absolute left-0 top-1/2 h-px w-full origin-left bg-canvas-muted"
          {...strike}
        />
      </span>
    </motion.li>
  );
}
