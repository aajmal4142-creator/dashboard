"use client";

import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";

const STEPS = [
  {
    label: "01",
    title: "Gather",
    body: "Add your company numbers and upload proof — bills, meters, supplier replies. Simple forms, no guesswork.",
    image: "/marketing/acid/photo-collect-desk.png",
    alt: "Professional collecting documents at a desk",
  },
  {
    label: "02",
    title: "Organise",
    body: "We sort everything into a clear picture of your impact — ready for the reports people actually ask for.",
    image: "/marketing/acid/photo-analytics-laptop.png",
    alt: "Laptop showing sustainability analytics charts",
  },
  {
    label: "03",
    title: "Share",
    body: "Send a living report link. Banks, buyers, and partners open one page — always up to date.",
    image: "/marketing/acid/photo-share-phone.png",
    alt: "Colleagues sharing a report on a phone",
  },
  {
    label: "04",
    title: "Stand behind it",
    body: "Every figure ties back to a document. When someone asks “where did this come from?”, you can show them.",
    image: "/marketing/acid/photo-filing-real.png",
    alt: "Office filing cabinet with organised folders",
  },
] as const;

export function AcidHowItWorks() {
  const reduce = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [panelW, setPanelW] = useState(0);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const update = () => setPanelW(node.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  });

  const x = useTransform(
    scrollYProgress,
    [0, 1],
    [0, panelW === 0 ? 0 : -panelW * (STEPS.length - 1)],
  );

  const progressWidth = useTransform(scrollYProgress, [0, 1], ["8%", "100%"]);

  if (reduce) {
    return (
      <section id="how" className="border-t border-rule px-6 py-16 md:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="acid-label mb-3">How it works</p>
          <h2 className="acid-display-sm text-ink">Four simple steps.</h2>
          <ul className="mt-10 grid gap-6 sm:grid-cols-2">
            {STEPS.map((step) => (
              <li
                key={step.label}
                className="overflow-hidden rounded-[var(--radius-panel)] border border-rule bg-surface-1 shadow-[var(--shadow-float)]"
              >
                <div className="relative aspect-[4/3]">
                  <Image
                    src={step.image}
                    alt={step.alt}
                    fill
                    className="object-cover"
                    sizes="(max-width:768px) 100vw, 50vw"
                  />
                </div>
                <div className="p-6">
                  <p className="font-data text-sm text-accent">{step.label}</p>
                  <h3 className="mt-2 text-xl font-medium tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  return (
    <section id="how" ref={trackRef} className="relative h-[360vh] border-t border-rule">
      <div className="sticky top-0 flex h-svh flex-col overflow-hidden bg-canvas">
        <div className="mx-auto w-full max-w-6xl shrink-0 px-6 pt-20 pb-3 md:pt-24">
          <p className="acid-label mb-3">How it works</p>
          <h2 className="acid-display-sm text-ink">Scroll through the journey.</h2>
          <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-surface-2">
            <motion.div
              className="h-full rounded-full bg-accent"
              style={{ width: progressWidth }}
            />
          </div>
        </div>

        <div ref={viewportRef} className="relative min-h-0 w-full flex-1 overflow-hidden">
          <motion.div
            style={{ x, width: panelW > 0 ? panelW * STEPS.length : undefined }}
            className="absolute inset-y-0 left-0 flex items-center"
          >
            {STEPS.map((step, i) => (
              <article
                key={step.label}
                style={{ width: panelW || undefined }}
                className="flex h-full shrink-0 items-center justify-center px-6 py-4"
              >
                <motion.div
                  className="mx-auto grid h-full max-h-[480px] w-full max-w-5xl overflow-hidden rounded-[var(--radius-panel)] border border-rule bg-surface-1 shadow-[var(--shadow-float)] md:grid-cols-[1.05fr_0.95fr]"
                  initial={{ opacity: 0.85, scale: 0.98 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ amount: 0.6 }}
                  transition={{ duration: 0.35 }}
                >
                  <div className="relative min-h-48 bg-surface-2 md:min-h-0">
                    <Image
                      src={step.image}
                      alt={step.alt}
                      fill
                      className="object-cover"
                      sizes="(max-width:768px) 100vw, 50vw"
                      priority={i === 0}
                    />
                  </div>
                  <div className="flex flex-col justify-center p-7 md:p-10">
                    <span className="font-data text-sm text-accent">{step.label}</span>
                    <h3 className="mt-3 text-3xl font-medium tracking-tight md:text-4xl">
                      {step.title}
                    </h3>
                    <p className="mt-4 max-w-sm text-base leading-relaxed text-ink-muted md:text-lg">
                      {step.body}
                    </p>
                  </div>
                </motion.div>
              </article>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
