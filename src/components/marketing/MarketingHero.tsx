"use client";

import Link from "next/link";

import { LiveHeroGauge } from "@/components/marketing/LiveHeroGauge";
import { InkReveal, RuleDraw } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { heroStage } from "@/lib/motion";

/**
 * Option A — gauge leads above the fold.
 * Chrome rule → left masthead → right printed dial.
 */
export function MarketingHero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-10 pb-12 md:pt-14 md:pb-16">
      <RuleDraw
        accent
        onMount
        delay={heroStage.chromeRules}
        duration={0.6}
        className="mb-8 md:mb-10"
      />
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(280px,400px)] lg:gap-14">
        <InkReveal onMount delay={heroStage.masthead} layer="structure">
          <p className="label-caps mb-5 text-accent">ClearESG · ESRS disclosure</p>
          <h1 className="display-80 text-ink">
            Enterprise ESG software costs six figures and takes six months.
            <br />
            ClearESG gets you audit-ready this quarter.
          </h1>
          <p className="measure-prose mt-6 text-ink-muted">
            Collect once, derive ESRS views, publish a living report for banks, buyers,
            and auditors.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/sign-up">Start free</Link>
            </Button>
            <Button
              variant="outline"
              asChild
              className="border-accent text-accent hover:bg-accent-quiet hover:border-accent"
            >
              <Link href="/tools/csrd-scope">CSRD scope checker</Link>
            </Button>
          </div>
        </InkReveal>

        <div className="flex justify-center lg:justify-end">
          <LiveHeroGauge />
        </div>
      </div>
    </section>
  );
}
