"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

import { ScrollReveal } from "@/components/marketing/acid/scroll";
import { Button } from "@/components/ui/button";
import { Metric } from "@/components/ui/metric";

const GAPS: Array<{
  gap: string;
  answer: string;
  figure: number;
  unit: string;
  image: string;
  alt: string;
}> = [
  {
    gap: "Most tools show charts. Few help you hit the deadline.",
    answer: "See how many days you have left — and what is still missing.",
    figure: 87,
    unit: "days to file",
    image: "/marketing/acid/photo-calendar-wall.png",
    alt: "Wall calendar with a circled deadline date",
  },
  {
    gap: "Getting data from suppliers is usually the hardest part.",
    answer:
      "Send a short request link. They answer a few fields — no new account needed.",
    figure: 90,
    unit: "% often from suppliers",
    image: "/marketing/acid/photo-handshake.png",
    alt: "Business handshake over a meeting table",
  },
  {
    gap: "Reviewers reject reports without proof.",
    answer: "Open any figure and see the document behind it.",
    figure: 1,
    unit: "click to proof",
    image: "/marketing/acid/photo-proof-docs.png",
    alt: "Comparing a report to source invoices",
  },
  {
    gap: "A PDF goes stale the moment you email it.",
    answer: "Share a living link that stays current as you update.",
    figure: 1,
    unit: "shareable link",
    image: "/marketing/acid/photo-journey-office.png",
    alt: "Bright modern office where teams share work",
  },
];

export function AcidGaps() {
  const reduce = useReducedMotion();

  return (
    <section id="gaps" className="border-t border-rule px-6 py-16 md:py-20">
      <div className="mx-auto max-w-6xl">
        <ScrollReveal>
          <p className="acid-label mb-3">Why teams switch</p>
          <h2 className="acid-display-sm text-ink">Problems we solve plainly.</h2>
        </ScrollReveal>

        <ul className="mt-10 space-y-5">
          {GAPS.map((g, i) => (
            <motion.li
              key={g.gap}
              className="grid overflow-hidden rounded-[var(--radius-panel)] border border-rule bg-surface-1 md:grid-cols-[160px_minmax(0,1fr)_auto]"
              initial={reduce ? false : { opacity: 0, y: 28, scale: 0.98 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{
                duration: 0.5,
                delay: i * 0.05,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <div className="relative min-h-32 md:min-h-full">
                <Image
                  src={g.image}
                  alt={g.alt}
                  fill
                  className="object-cover"
                  sizes="160px"
                />
              </div>
              <div className="p-5 md:p-6">
                <p className="text-sm font-medium text-ink-muted">{g.gap}</p>
                <p className="mt-2 text-base font-medium tracking-tight text-ink md:text-lg">
                  {g.answer}
                </p>
              </div>
              <div className="flex items-center px-5 pb-5 md:px-6 md:pb-0">
                <Metric value={g.figure} unit={g.unit} size="lg" tone="signal" />
              </div>
            </motion.li>
          ))}
        </ul>

        <motion.div
          className="relative mt-14 overflow-hidden rounded-[var(--radius-panel)] border border-rule"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
        >
          <div className="absolute inset-0">
            <Image
              src="/marketing/acid/photo-hills-mist.png"
              alt=""
              fill
              className="object-cover opacity-45"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-canvas/80" />
          </div>
          <div className="relative flex flex-wrap items-center gap-6 p-8 md:p-10">
            <div className="flex-1">
              <p className="acid-label mb-2">Ready when you are</p>
              <p className="acid-display-sm text-ink">Start free this quarter.</p>
            </div>
            <Button asChild size="lg" className="rounded-full px-7">
              <Link href="/sign-up">Start free</Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
