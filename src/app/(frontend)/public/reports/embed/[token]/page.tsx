import { SharedHtmlReportByToken } from "@/components/reports/SharedHtmlReportByToken";

export async function generateMetadata() {
  return {
    title: "Embedded sustainability report",
    robots: { index: false, follow: false },
  };
}

/**
 * GET /public/reports/embed/[token]
 * Public iframe embed — no login; opaque token auth; always embedded chrome.
 */
export default async function PublicEmbedReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <SharedHtmlReportByToken token={token} embedded />;
}
