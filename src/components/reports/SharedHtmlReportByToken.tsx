import { headers } from "next/headers";
import { getPayload } from "payload";

import { InteractiveHtmlReport } from "@/components/reports/InteractiveHtmlReport";
import { resolveReportShareToken } from "@/lib/reports/htmlReportShare";
import { rateLimit } from "@/lib/rate-limit";
import config from "@/payload.config";

/**
 * Shared public HTML report renderer (S10.1 share + S10.3 embed).
 * Token auth only — no login. Read-only InteractiveHtmlReport.
 */
export async function SharedHtmlReportByToken({
  token,
  embedded,
}: {
  token: string;
  embedded: boolean;
}) {
  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    hdrs.get("x-real-ip") ||
    "unknown";
  const userAgent = hdrs.get("user-agent");

  const limited = await rateLimit(`html-share:${token}:${ip}`, {
    max: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.ok) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-ink">
        <p className="label-caps">Shared report</p>
        <h1 className="font-display mt-4 text-3xl">Too many requests</h1>
        <p className="mt-4 text-ink-muted">Retry after {limited.retryAfterSec}s.</p>
      </main>
    );
  }

  const candidateOrigin = hdrs.get("origin") || hdrs.get("referer");

  const payload = await getPayload({ config });
  const resolved = await resolveReportShareToken(payload, token, {
    ip,
    userAgent,
    embedded,
    candidateOrigin,
  });

  if (!resolved.ok) {
    const title =
      resolved.reason === "expired"
        ? "Link expired"
        : resolved.reason === "revoked"
          ? "Link revoked"
          : resolved.reason === "origin_denied"
            ? "Embedding not allowed"
            : "Link not found";
    const body =
      resolved.reason === "expired"
        ? "Ask the organisation for a new share link."
        : resolved.reason === "revoked"
          ? "This share link is no longer valid."
          : resolved.reason === "origin_denied"
            ? "This domain is not on the allowlist configured for this embed. Ask the organisation to add it in Share report → Embed code."
            : "This share link is invalid or the report is unavailable.";
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-ink">
        <p className="label-caps">Shared report</p>
        <h1 className="font-display mt-4 text-3xl">{title}</h1>
        <p className="mt-4 text-ink-muted">{body}</p>
      </main>
    );
  }

  return (
    <main
      data-theme={resolved.themeMode}
      style={{ colorScheme: resolved.themeMode }}
      className="min-h-full bg-canvas text-ink"
    >
      <InteractiveHtmlReport
        snapshot={resolved.snapshot}
        embedded={embedded}
        generatedAtIso={resolved.generatedAtIso}
      />
    </main>
  );
}
