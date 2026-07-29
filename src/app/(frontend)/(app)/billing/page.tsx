import { getPayload } from "payload";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentContext } from "@/lib/auth";
import config from "@/payload.config";

export default async function BillingDashboard() {
  const ctx = await getCurrentContext();
  if (!ctx.user || !ctx.activeOrg) {
    redirect("/login");
  }

  const payload = await getPayload({ config });

  // Get subscription
  const subResult = await payload.find({
    collection: "subscriptions",
    where: { organisation: { equals: ctx.activeOrg.id } },
    limit: 1,
  });
  const subscription = subResult.docs?.[0];

  if (!subscription) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Billing</h1>
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 mb-6">No active subscription yet.</p>
            <Link
              href="/billing/plans"
              className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg"
            >
              Choose a Plan
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Get plan details
  const planId =
    typeof subscription.plan === "object" ? subscription.plan.id : subscription.plan;
  const plan = await payload.findByID({
    collection: "plans",
    id: String(planId),
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-slate-900 mb-8">Billing & Usage</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-2">Current Plan</h3>
            <p className="text-2xl font-bold text-blue-600">{plan?.displayName}</p>
            <p className="text-slate-600">${plan?.monthlyPrice}/month</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-2">Billing Cycle</h3>
            <p className="text-2xl font-bold text-slate-900">
              {subscription.billingCycle}
            </p>
            <p className="text-slate-600">
              Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-2">Status</h3>
            <p className="text-2xl font-bold text-green-600 capitalize">
              {subscription.status}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Link
            href="/billing/usage"
            className="bg-white rounded-lg shadow p-4 text-center hover:shadow-lg"
          >
            <p className="text-2xl mb-2">📊</p>
            <p className="font-semibold">Usage Details</p>
          </Link>
          <Link
            href="/billing/invoices"
            className="bg-white rounded-lg shadow p-4 text-center hover:shadow-lg"
          >
            <p className="text-2xl mb-2">📄</p>
            <p className="font-semibold">Invoices</p>
          </Link>
          <Link
            href="/billing/plans"
            className="bg-white rounded-lg shadow p-4 text-center hover:shadow-lg"
          >
            <p className="text-2xl mb-2">⬆️</p>
            <p className="font-semibold">Change Plan</p>
          </Link>
          <Link
            href="/billing/settings"
            className="bg-white rounded-lg shadow p-4 text-center hover:shadow-lg"
          >
            <p className="text-2xl mb-2">⚙️</p>
            <p className="font-semibold">Settings</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
