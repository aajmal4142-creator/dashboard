"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import type { CSSProperties, ReactNode } from "react";

import {
  type PageLayer,
  pageLayer,
  useInkReveal,
  useMotionSafe,
  usePrefersReducedMotion,
  useRuleDraw,
} from "@/lib/motion";
import { cn } from "@/lib/utils";

type AssembleProps = {
  layer: PageLayer;
  children: ReactNode;
  className?: string;
  as?: "div" | "header" | "main" | "section" | "nav" | "article" | "aside";
  /** Mount assembly (default) vs scroll-enter */
  onMount?: boolean;
  style?: CSSProperties;
};

/**
 * Page assembly layer: chrome → structure → data.
 * The report typesets, then the numbers land.
 */
export function Assemble({
  layer,
  children,
  className,
  as = "div",
  onMount = true,
  style,
}: AssembleProps) {
  const props = useInkReveal({
    layer,
    onMount,
    rise: layer === "chrome" ? 0 : 10,
  });
  const Comp = motion[as];

  return (
    <Comp className={className} style={style} {...props}>
      {children}
    </Comp>
  );
}

type InkRevealProps = {
  children: ReactNode;
  delay?: number;
  layer?: PageLayer;
  className?: string;
  onMount?: boolean;
  as?: "div" | "section" | "li" | "header" | "article";
};

/** Ink hitting paper — opacity + short rise, one-shot on scroll (or mount). */
export function InkReveal({
  children,
  delay = 0,
  layer,
  className,
  onMount = false,
  as = "div",
}: InkRevealProps) {
  const props = useInkReveal({ delay, layer, onMount });
  const Comp = motion[as];
  return (
    <Comp className={className} {...props}>
      {children}
    </Comp>
  );
}

type RuleDrawProps = {
  className?: string;
  delay?: number;
  accent?: boolean;
  axis?: "x" | "y";
  duration?: number;
  onMount?: boolean;
};

/** Structural rule that draws itself before the content it frames. */
export function RuleDraw({
  className,
  delay = 0,
  accent = false,
  axis = "x",
  duration = 0.5,
  onMount = false,
}: RuleDrawProps) {
  const props = useRuleDraw({ delay, axis, duration, onMount });
  return (
    <motion.div
      aria-hidden
      className={cn(
        "w-full origin-left",
        axis === "y" && "origin-top",
        accent ? "h-0.5 bg-accent" : "h-px bg-rule",
        className,
      )}
      {...props}
    />
  );
}

type StaggerProps = {
  children: ReactNode;
  className?: string;
  as?: "div" | "ul" | "ol" | "section";
  delayChildren?: number;
};

/** Parent for staggered ink children — chrome→structure→data order via child delays. */
export function InkStagger({
  children,
  className,
  as = "div",
  delayChildren = 0.06,
}: StaggerProps) {
  const reduced = usePrefersReducedMotion();
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      initial={reduced ? false : "hidden"}
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: reduced ? 0 : 0.04,
            delayChildren: reduced ? 0 : delayChildren,
          },
        },
      }}
    >
      {children}
    </Comp>
  );
}

type InkChildProps = {
  children: ReactNode;
  className?: string;
  as?: "div" | "li" | "section";
  index?: number;
};

export function InkChild({ children, className, as = "div", index = 0 }: InkChildProps) {
  const reduced = usePrefersReducedMotion();
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      custom={index}
      variants={{
        hidden: reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 },
        visible: {
          opacity: 1,
          y: 0,
          transition: reduced
            ? { duration: 0 }
            : { duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: index * 0.04 },
        },
      }}
    >
      {children}
    </Comp>
  );
}

/** Accent title rule that draws on mount — page chrome before masthead. */
export function TitleRuleDraw({
  className,
  delay = pageLayer.chrome,
}: {
  className?: string;
  delay?: number;
}) {
  return (
    <RuleDraw
      accent
      onMount
      delay={delay}
      duration={0.45}
      className={cn("mb-0", className)}
    />
  );
}

/** Hover accent bar for rows — springSnap scaleY, no lift. */
export function HoverAccentBar(props: HTMLMotionProps<"span">) {
  const transition = useMotionSafe("snap");
  return (
    <motion.span
      aria-hidden
      className="absolute bottom-0 left-0 top-0 w-0.5 origin-top bg-accent"
      initial={{ scaleY: 0 }}
      whileHover={{ scaleY: 1 }}
      transition={transition}
      {...props}
    />
  );
}
