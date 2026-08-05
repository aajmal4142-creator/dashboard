import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getPayload } from "payload";

import { ENGAGEMENT_CAMPAIGNS_SLUG } from "@/collections/EngagementCampaigns";
import { docToCampaign } from "@/lib/engagement";
import { rateLimit } from "@/lib/rate-limit";
import config from "@/payload.config";

import { EngagementSurveyForm } from "./EngagementSurveyForm";

export const metadata = {
  title: "Commute survey | ClearESG",
};

export default async function EngagementSurveyPage({
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
  const limited = await rateLimit(`e-page:${token}:${ip}`, {
    max: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.ok) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-ink">
        <p className="label-caps text-ink-muted">Commute survey</p>
        <h1 className="font-display mt-3 text-2xl">Too many requests</h1>
        <p className="mt-3 text-sm text-ink-muted">
          Retry after {limited.retryAfterSec}s.
        </p>
      </main>
    );
  }

  const payload = await getPayload({ config });
  const found = await payload.find({
    collection: ENGAGEMENT_CAMPAIGNS_SLUG,
    where: { publicToken: { equals: token } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  });
  const doc = found.docs[0];
  if (!doc) notFound();

  const campaign = docToCampaign(doc as unknown as Record<string, unknown>);
  const org = doc.organisation;
  const orgName =
    typeof org === "object" && org !== null && "name" in org
      ? String((org as { name: unknown }).name)
      : "This organisation";

  if (campaign.surveyMode !== "commute") {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-ink">
        <p className="label-caps text-ink-muted">Commute survey</p>
        <h1 className="font-display mt-3 text-2xl">Survey not available</h1>
        <p className="mt-3 text-sm text-ink-muted">
          This campaign is not collecting public survey responses.
        </p>
      </main>
    );
  }

  if (campaign.status !== "active") {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-ink">
        <p className="label-caps text-ink-muted">Commute survey</p>
        <h1 className="font-display mt-3 text-2xl">Campaign not active</h1>
        <p className="mt-3 text-sm text-ink-muted">
          This campaign is currently {campaign.status}. Check back once it is active.
        </p>
      </main>
    );
  }

  return (
    <EngagementSurveyForm
      token={token}
      orgName={orgName}
      campaignTitle={campaign.title}
      campaignDescription={campaign.description}
    />
  );
}
