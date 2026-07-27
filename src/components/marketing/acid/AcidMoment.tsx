"use client";

import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

import { ScrollReveal } from "@/components/marketing/acid/scroll";

/** Extra scroll moment — soft pin + fade of a human visual. */
export function AcidMoment() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const opacity = useTransform(scrollYProgress, [0, 0.25, 0.7, 1], [0, 1, 1, 0.4]);
  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [60, -30]);

  return (
    <section
      ref={ref}
      className="relative overflow-hidden border-t border-rule py-20 md:py-28"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 md:grid-cols-2 md:gap-16">
        <ScrollReveal>
          <p className="acid-label mb-3">Peace of mind</p>
          <h2 className="acid-display-sm text-ink">Know where every number came from.</h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-ink-muted md:text-lg">
            ClearESG keeps your proof next to the figure. When someone asks a hard
            question, you are ready — without digging through email.
          </p>
        </ScrollReveal>

        <motion.div
          style={{ opacity, y }}
          className="acid-visual relative aspect-square max-w-md justify-self-center md:justify-self-end"
        >
          <Image
            src="/marketing/acid/photo-desk-plant.png"
            alt="Desk plant beside a notebook in soft daylight"
            fill
            className="object-cover"
            sizes="(max-width:768px) 90vw, 420px"
          />
        </motion.div>
      </div>
    </section>
  );
}
