import Link from "next/link";

import { unsubscribeFromScheduleToken } from "@/lib/reports/reportScheduler";

/**
 * Public unsubscribe landing for scheduled report emails.
 * Signed token in query string; no Clerk session required.
 */
export default async function UnsubscribeReportPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token.trim() : "";

  let result: { ok: true; email: string } | { ok: false; error: string };

  if (!token) {
    result = {
      ok: false,
      error: "Missing unsubscribe token. Use the link from your email.",
    };
  } else {
    try {
      const out = await unsubscribeFromScheduleToken(token);
      result = { ok: true, email: out.email };
    } catch (err) {
      result = {
        ok: false,
        error:
          err instanceof Error ? err.message : "Could not process unsubscribe request",
      };
    }
  }

  return (
    <main className="min-h-screen bg-canvas px-6 py-16 text-ink">
      <div className="mx-auto max-w-lg border-t border-rule-strong pt-8">
        <p className="font-display text-[28px] tracking-tight">ClearESG</p>
        <h1 className="mt-6 font-display text-[22px] text-ink">
          Report delivery unsubscribe
        </h1>
        {result.ok ? (
          <p className="mt-4 text-[14px] leading-relaxed text-ink-muted">
            {result.email} will no longer receive emails for this scheduled delivery.
            Other schedules are unchanged.
          </p>
        ) : (
          <p className="mt-4 text-[14px] leading-relaxed text-rust">{result.error}</p>
        )}
        <p className="mt-8 text-[13px]">
          <Link href="/" className="text-accent underline-offset-2 hover:underline">
            Return to ClearESG
          </Link>
        </p>
      </div>
    </main>
  );
}
