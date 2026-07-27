import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { CsrdScopeChecker } from "@/app/(frontend)/tools/CsrdScopeChecker";
import { Scope2Calculator } from "@/app/(frontend)/tools/Scope2Calculator";
import { SITE_NAME } from "@/lib/marketing/site";

const TOOLS = {
  "csrd-scope": {
    title: "CSRD scope checker",
    description:
      "Answer whether your company is likely in CSRD scope from employee count, turnover, and EU status. Ungated educational heuristic.",
    Component: CsrdScopeChecker,
  },
  "scope-2": {
    title: "Scope 2 calculator",
    description:
      "Convert electricity kWh to tCO2e using a region grid factor. Ungated; cites the illustrative factor used.",
    Component: Scope2Calculator,
  },
} as const;

type Props = { params: Promise<{ calculator: string }> };

export function generateStaticParams() {
  return Object.keys(TOOLS).map((calculator) => ({ calculator }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { calculator } = await params;
  const tool = TOOLS[calculator as keyof typeof TOOLS];
  if (!tool) return { title: SITE_NAME };
  return {
    title: `${tool.title} — ${SITE_NAME}`,
    description: tool.description,
    alternates: { canonical: `/tools/${calculator}` },
  };
}

export default async function ToolPage({ params }: Props) {
  const { calculator } = await params;
  const tool = TOOLS[calculator as keyof typeof TOOLS];
  if (!tool) notFound();
  const Component = tool.Component;

  return (
    <MarketingLayout>
      <main className="mx-auto max-w-xl flex-1 px-6 py-16">
        <p className="acid-label">Tools</p>
        <h1 className="mt-2 acid-display-sm text-ink">{tool.title}</h1>
        <p className="mt-4 text-ink-muted">{tool.description}</p>
        <div className="mt-8 rounded-[var(--radius-panel)] border border-rule bg-surface-1 p-6 shadow-[var(--shadow-float)]">
          <Component />
        </div>
        <p className="mt-6 text-xs text-ink-muted">
          Not legal or assurance advice. Production ClearESG calculations use the
          versioned factor registry.
        </p>
      </main>
    </MarketingLayout>
  );
}
