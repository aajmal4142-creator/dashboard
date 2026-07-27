export const SITE_NAME = "ClearESG";
export const SITE_TAGLINE = "Mandatory ESG disclosure, audit-ready this quarter.";

export function siteUrl(path = ""): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://clearesg.com").replace(
    /\/$/,
    "",
  );
  if (!path) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function absoluteUrl(path: string): string {
  return siteUrl(path);
}

export const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: siteUrl(),
  description: SITE_TAGLINE,
  sameAs: [] as string[],
};

export function softwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: SITE_TAGLINE,
    offers: [
      {
        "@type": "Offer",
        price: "0",
        priceCurrency: "EUR",
        name: "Free",
      },
      {
        "@type": "Offer",
        price: "49",
        priceCurrency: "EUR",
        name: "Pro",
      },
      {
        "@type": "Offer",
        price: "199",
        priceCurrency: "EUR",
        name: "Consultant",
      },
    ],
  };
}
