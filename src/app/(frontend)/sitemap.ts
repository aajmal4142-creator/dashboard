import type { MetadataRoute } from "next";

/** App-only — no marketing URLs to index. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [];
}
