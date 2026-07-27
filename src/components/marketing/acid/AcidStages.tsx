"use client";

import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

import { ScrollReveal, ScrollRule } from "@/components/marketing/acid/scroll";

const STAGES = [
  {
    title: "Keep proof with every number",
    body: "Bills, meter readings, and supplier replies stay attached. Nothing is invented to fill a blank.",
    image: "/marketing/acid/photo-notebook-desk.png",
    alt: "Open notebook on a sunlit office desk",
    align: "left" as const,
  },
  {
    title: "Enter once, use everywhere",
    body: "Build your picture once. Turn it into the formats banks and buyers expect — without starting over.",
    image: "/marketing/acid/photo-team-meeting.png",
    alt: "Team reviewing the same laptop together",
    align: "right" as const,
  },
  {
    title: "A report that stays alive",
    body: "Share a link, not a stale PDF attachment. Update it when your numbers change.",
    image: "/marketing/acid/photo-laptop-cafe.png",
    alt: "Laptop open with a report on screen",
    align: "left" as const,
  },
  {
    title: "Answer hard questions calmly",
    body: "When auditors or buyers ask for the source, open the file behind the figure in one click.",
    image: "/marketing/acid/photo-checklist-desk.png",
    alt: "Checklist and laptop with charts on a desk",
    align: "right" as const,
  },
];

export function AcidStages() {
  const reduce = useReducedMotion();

  return (
    <section id="stages" className="border-t border-rule">
      <div className="mx-auto max-w-6xl px-6 pt-16 pb-6 md:pt-20">
        <ScrollReveal>
          <p className="acid-label mb-3">What you get</p>
          <h2 className="acid-display-sm max-w-xl text-ink">
            Built for real businesses — not only specialists.
          </h2>
        </ScrollReveal>
        <ScrollRule className="mt-8 h-px w-24 bg-accent" />
      </div>

      <ul className="mx-auto max-w-6xl space-y-16 px-6 py-10 md:space-y-24 md:py-16">
        {STAGES.map((stage, i) => (
          <StageRow key={stage.title} stage={stage} index={i} reduce={Boolean(reduce)} />
        ))}
      </ul>
    </section>
  );
}

function StageRow({
  stage,
  index,
  reduce,
}: {
  stage: (typeof STAGES)[number];
  index: number;
  reduce: boolean;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [56, -56]);
  const imageFirst = stage.align === "left";

  return (
    <motion.li
      ref={ref}
      className="grid items-center gap-8 md:grid-cols-2 md:gap-14"
      initial={reduce ? false : { opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className={imageFirst ? "order-1" : "order-1 md:order-2"}>
        <div className="acid-visual relative aspect-[4/3]">
          <motion.div style={{ y }} className="absolute inset-[-14%]">
            <Image
              src={stage.image}
              alt={stage.alt}
              fill
              className="object-cover"
              sizes="(max-width:768px) 100vw, 50vw"
            />
          </motion.div>
        </div>
      </div>
      <div className={imageFirst ? "order-2" : "order-2 md:order-1"}>
        <p className="font-data text-sm text-accent">
          {String(index + 1).padStart(2, "0")}
        </p>
        <h3 className="mt-3 text-2xl font-medium tracking-tight md:text-3xl">
          {stage.title}
        </h3>
        <p className="mt-4 max-w-md text-base leading-relaxed text-ink-muted md:text-lg">
          {stage.body}
        </p>
      </div>
    </motion.li>
  );
}
