import type { MetadataRoute } from "next";

import { ANSWERS } from "@/lib/marketing/answers";
import { GLOSSARY } from "@/lib/marketing/glossary";
import { COMPETITORS, CSRD_SECTORS, DEADLINES } from "@/lib/marketing/programmatic";
import { siteUrl } from "@/lib/marketing/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = ["", "/pricing", "/glossary", "/answers", "/tools"];
  const tools = ["/tools/csrd-scope", "/tools/scope-2"];

  return [
    ...staticPaths.map((path) => ({
      url: siteUrl(path || "/"),
      lastModified: new Date("2026-07-01"),
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.8,
    })),
    ...tools.map((path) => ({
      url: siteUrl(path),
      lastModified: new Date("2026-07-01"),
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    ...GLOSSARY.map((t) => ({
      url: siteUrl(`/glossary/${t.slug}`),
      lastModified: new Date(t.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...ANSWERS.map((a) => ({
      url: siteUrl(`/answers/${a.slug}`),
      lastModified: new Date(a.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...CSRD_SECTORS.map((s) => ({
      url: siteUrl(`/csrd/${s.slug}`),
      lastModified: new Date(s.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...COMPETITORS.map((c) => ({
      url: siteUrl(`/compare/${c.slug}`),
      lastModified: new Date(c.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...DEADLINES.map((d) => ({
      url: siteUrl(`/deadlines/${d.slug}`),
      lastModified: new Date(d.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
