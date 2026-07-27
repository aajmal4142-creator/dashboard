import { ANSWERS } from "@/lib/marketing/answers";
import { GLOSSARY } from "@/lib/marketing/glossary";
import { SITE_NAME, SITE_TAGLINE, siteUrl } from "@/lib/marketing/site";

export function GET() {
  const parts: string[] = [`# ${SITE_NAME} — full corpus`, SITE_TAGLINE, siteUrl(), ""];

  for (const t of GLOSSARY) {
    parts.push(`## ${t.term}`, t.answer, ...t.body, `Updated: ${t.updatedAt}`, "");
  }
  for (const a of ANSWERS) {
    parts.push(`## ${a.question}`, a.answer);
    for (const s of a.sections) {
      parts.push(`### ${s.h2}`, s.body);
    }
    parts.push(`Updated: ${a.updatedAt}`, "");
  }

  return new Response(parts.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
