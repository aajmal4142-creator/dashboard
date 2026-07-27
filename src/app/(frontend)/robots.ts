import type { MetadataRoute } from "next";

function siteUrl(path = "/"): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://clearesg.com").replace(
    /\/$/,
    "",
  );
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** App-only — no public marketing index. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
    sitemap: siteUrl("/sitemap.xml"),
  };
}
