import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/marketing/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard/", "/admin/", "/api/", "/sign-in", "/sign-up", "/s/", "/r/"],
    },
    sitemap: siteUrl("/sitemap.xml"),
  };
}
