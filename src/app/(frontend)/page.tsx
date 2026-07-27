import type { Metadata } from "next";

import { AcidCinematic } from "@/components/marketing/acid/AcidCinematic";
import { AcidFooter } from "@/components/marketing/acid/AcidFooter";
import { AcidGaps } from "@/components/marketing/acid/AcidGaps";
import { AcidHero } from "@/components/marketing/acid/AcidHero";
import { AcidHowItWorks } from "@/components/marketing/acid/AcidHowItWorks";
import { AcidMoment } from "@/components/marketing/acid/AcidMoment";
import { AcidNav } from "@/components/marketing/acid/AcidNav";
import { AcidProofStrip } from "@/components/marketing/acid/AcidProofStrip";
import { AcidShell } from "@/components/marketing/acid/AcidShell";
import { AcidStages } from "@/components/marketing/acid/AcidStages";
import { JsonLd } from "@/components/marketing/chrome";
import {
  organizationJsonLd,
  SITE_NAME,
  softwareApplicationJsonLd,
} from "@/lib/marketing/site";

export const metadata: Metadata = {
  title: `${SITE_NAME} — clear sustainability reports for your business`,
  description:
    "Gather your numbers once. Get a clear report you can share with banks, buyers, and partners — this quarter.",
  alternates: { canonical: "/" },
};

/** Design A — Acid Climate marketing home. */
export default function Home() {
  return (
    <AcidShell>
      <JsonLd data={[organizationJsonLd, softwareApplicationJsonLd()]} />
      <AcidNav />
      <main>
        <AcidHero />
        <AcidHowItWorks />
        <AcidCinematic />
        <AcidStages />
        <AcidMoment />
        <AcidProofStrip />
        <AcidGaps />
      </main>
      <AcidFooter />
    </AcidShell>
  );
}
