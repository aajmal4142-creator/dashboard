"use client";

import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

import { ScrollReveal } from "@/components/marketing/acid/scroll";

export function AcidCinematic() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const scale = useTransform(
    scrollYProgress,
    [0, 0.45, 1],
    reduce ? [1, 1, 1] : [1.14, 1, 1.05],
  );
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0.35, 1, 1, 0.5]);
  const textY = useTransform(scrollYProgress, [0.15, 0.45], reduce ? [0, 0] : [28, 0]);

  return (
    <section ref={ref} className="relative overflow-hidden border-y border-rule">
      <motion.div
        style={{ scale, opacity }}
        className="relative h-[54vw] min-h-72 max-h-[540px] w-full"
      >
        <Image
          src="/marketing/acid/photo-journey-office.png"
          alt="Modern office workspace"
          fill
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/45 to-canvas/65" />
        <motion.div
          style={{ y: textY }}
          className="absolute inset-x-0 bottom-0 px-6 pb-10 md:pb-14"
        >
          <ScrollReveal className="mx-auto max-w-6xl">
            <p className="acid-label mb-2">From start to finish</p>
            <p className="acid-display-sm max-w-lg text-ink">
              One clear path from your paperwork to a report you can send with confidence.
            </p>
          </ScrollReveal>
        </motion.div>
      </motion.div>
    </section>
  );
}
