import { AcidFooter } from "@/components/marketing/acid/AcidFooter";
import { AcidNav } from "@/components/marketing/acid/AcidNav";

/** Public marketing chrome — Design A (Acid). */
export function MarketingNav() {
  return <AcidNav />;
}

export function MarketingFooter() {
  return <AcidFooter />;
}

export function JsonLd({
  data,
}: {
  data: Record<string, unknown> | Array<Record<string, unknown>>;
}) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      // JSON-LD is data, not executable JS
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
