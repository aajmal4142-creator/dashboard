import { SharedHtmlReportByToken } from "@/components/reports/SharedHtmlReportByToken";

export async function generateMetadata() {
  return {
    title: "Shared HTML report",
    robots: { index: false, follow: false },
  };
}

export default async function SharedHtmlReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ embed?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const embedded = sp.embed === "1" || sp.embed === "true";

  return <SharedHtmlReportByToken token={token} embedded={embedded} />;
}
