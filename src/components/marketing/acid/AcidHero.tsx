"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";

export function AcidHero() {
  const reduce = useReducedMotion();

  return (
    <section id="top" className="relative overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src="/marketing/acid/photo-hero-office.png"
          alt="Professionals reviewing sustainability reports in a modern office"
          fill
          priority
          className="object-cover object-[center_30%]"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-canvas via-canvas/92 to-canvas/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/20 to-canvas/55" />
      </div>

      <div className="relative mx-auto flex min-h-[82svh] max-w-6xl flex-col justify-end px-6 pb-16 pt-24 md:pb-20 md:pt-28">
        <motion.p
          className="acid-label mb-5"
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          Sustainability reporting · made simple
        </motion.p>

        <motion.h1
          className="acid-display max-w-2xl text-ink"
          initial={reduce ? false : { opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.06 }}
        >
          ClearESG
        </motion.h1>

        <motion.p
          className="mt-5 max-w-md text-lg text-ink-muted md:text-xl"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.14 }}
        >
          Gather your numbers once. Get a clear report you can share with banks, buyers,
          and partners — this quarter, not next year.
        </motion.p>

        <motion.div
          className="mt-9 flex flex-wrap gap-3"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.22 }}
        >
          <Button asChild size="lg" className="rounded-full px-7">
            <Link href="/sign-up">Start free</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-full px-7">
            <Link href="#how">See how it works</Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
