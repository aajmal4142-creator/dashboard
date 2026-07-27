import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getPayload } from "payload";

import { LivingReportView } from "@/components/reports/LivingReportView";
import type { ReportSnapshot } from "@/lib/reports";
import { rateLimit } from "@/lib/rate-limit";
import config from "@/payload.config";

export default async function LivingReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    hdrs.get("x-real-ip") ||
    "unknown";
  const limited = await rateLimit(`living:${token}:${ip}`, {
    max: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.ok) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-ink">
        <p className="label-caps">Living report</p>
        <h1 className="font-display mt-4 text-3xl">Too many requests</h1>
        <p className="mt-4 text-ink-muted">Retry after {limited.retryAfterSec}s.</p>
      </main>
    );
  }

  const payload = await getPayload({ config });
  const found = await payload.find({
    collection: "reports",
    where: {
      and: [{ shareToken: { equals: token } }, { status: { equals: "published" } }],
    },
    limit: 1,
    overrideAccess: true,
  });
  const report = found.docs[0];
  if (!report) notFound();

  if (report.shareExpiresAt && new Date(String(report.shareExpiresAt)) < new Date()) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-ink">
        <p className="label-caps">Living report</p>
        <h1 className="font-display mt-4 text-3xl">Link expired</h1>
        <p className="mt-4 text-ink-muted">Ask the organisation for a new share link.</p>
      </main>
    );
  }

  await payload.update({
    collection: "reports",
    id: report.id,
    data: { viewCount: (report.viewCount ?? 0) + 1 },
    overrideAccess: true,
  });

  const snapshot = report.snapshot as ReportSnapshot | null;
  if (!snapshot) notFound();

  return <LivingReportView snapshot={snapshot} />;
}
