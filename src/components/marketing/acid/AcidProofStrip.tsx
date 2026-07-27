"use client";

import Image from "next/image";
import {
  ScrollReveal,
  ScrollStagger,
  ScrollStaggerItem,
} from "@/components/marketing/acid/scroll";

const AUDIENCES = [
  "Factory & plant teams",
  "Finance managers",
  "Consultants",
  "Buyers asking for data",
  "Banks & lenders",
  "Growing SMEs",
] as const;

export function AcidProofStrip() {
  return (
    <section id="proof" className="relative overflow-hidden border-t border-rule">
      <div className="absolute inset-0 opacity-40">
        <Image
          src="/marketing/acid/photo-hills-mist.png"
          alt=""
          fill
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-canvas/88" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-16 md:py-20">
        <ScrollReveal>
          <p className="acid-label mb-3">Who it is for</p>
          <h2 className="acid-display-sm max-w-xl text-ink">
            The report is what matters — a clear story people can trust.
          </h2>
        </ScrollReveal>

        <ScrollStagger className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {AUDIENCES.map((label) => (
            <ScrollStaggerItem key={label}>
              <div className="flex min-h-20 items-center justify-center rounded-[var(--radius-panel)] border border-rule bg-surface-1/95 px-3 text-center text-xs font-medium tracking-tight text-ink-muted backdrop-blur-sm">
                {label}
              </div>
            </ScrollStaggerItem>
          ))}
        </ScrollStagger>
      </div>
    </section>
  );
}
