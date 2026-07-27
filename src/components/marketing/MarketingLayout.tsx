import type { ReactNode } from "react";

import { AcidFooter } from "@/components/marketing/acid/AcidFooter";
import { AcidNav } from "@/components/marketing/acid/AcidNav";
import { AcidShell } from "@/components/marketing/acid/AcidShell";
import { JsonLd } from "@/components/marketing/chrome";

/** Shared chrome for all public marketing pages — Design A. */
export function MarketingLayout({
  children,
  jsonLd,
}: {
  children: ReactNode;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
}) {
  return (
    <AcidShell>
      {jsonLd ? <JsonLd data={jsonLd} /> : null}
      <AcidNav />
      {children}
      <AcidFooter />
    </AcidShell>
  );
}
