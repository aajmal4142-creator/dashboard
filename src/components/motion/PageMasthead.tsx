"use client";

import type { ReactNode } from "react";

import { Assemble, InkReveal, RuleDraw } from "@/components/motion";
import { cn } from "@/lib/utils";

type PageMastheadProps = {
  label: string;
  title: string;
  children?: ReactNode;
  className?: string;
  /** Secondary copy under the title */
  description?: string;
};

/**
 * App page chrome: accent rule draws, then masthead ink-settles.
 * Compose metrics as children in a data-layer Assemble.
 */
export function PageMasthead({
  label,
  title,
  children,
  className,
  description,
}: PageMastheadProps) {
  return (
    <Assemble layer="structure" className={cn("pt-4", className)}>
      <RuleDraw accent onMount duration={0.45} className="mb-4" />
      <p className="label-caps">{label}</p>
      <h1 className="font-display mt-2 text-3xl text-ink">{title}</h1>
      {description ? <p className="mt-2 max-w-xl text-ink-muted">{description}</p> : null}
      {children}
    </Assemble>
  );
}

/** Scroll-enter section with rule drawn before body copy. */
export function PageSection({
  children,
  className,
  delay = 0,
  rule = true,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  rule?: boolean;
}) {
  return (
    <InkReveal delay={delay} className={className}>
      {rule ? <RuleDraw delay={0} duration={0.4} className="mb-4" /> : null}
      {children}
    </InkReveal>
  );
}
