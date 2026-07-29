import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getPayload } from "payload";

import { RiskBreakdownClient } from "./RiskBreakdownClient";
import { getCurrentContext } from "@/lib/auth";
import { calculateRiskScore } from "@/lib/suppliers";
import config from "@/payload.config";

export const metadata = {
  title: "Risk Breakdown | ClearESG",
};

export default async function RiskBreakdownPage({ params }: { params: { id: string } }) {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");

  const payload = await getPayload({ config });
  const supplier = await payload.findByID({
    collection: "suppliers",
    id: params.id,
    overrideAccess: true,
  });

  if (!supplier || supplier.organisation !== ctx.activeOrg.id) {
    notFound();
  }

  const breakdown = await calculateRiskScore(params.id);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/suppliers/risk-dashboard"
          className="text-blue-600 hover:text-blue-800 text-sm mb-4 inline-block"
        >
          ← Back to Risk Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">{supplier.name}</h1>
        <p className="text-gray-500 mt-1">Risk Score Breakdown</p>
      </div>

      <RiskBreakdownClient
        supplier={{
          id: String(supplier.id),
          name: supplier.name,
          category: supplier.category,
          annualSpend: supplier.annualSpend ?? null,
          contactEmail: supplier.contactEmail,
        }}
        breakdown={breakdown}
      />
    </div>
  );
}
