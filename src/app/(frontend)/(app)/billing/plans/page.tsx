import { getCurrentContext } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function PlansPage() {
  const ctx = await getCurrentContext();
  if (!ctx.user || !ctx.activeOrg) redirect("/login");

  const plans = [
    { name: "Starter", price: 99, datapoints: "1,000", reports: "5" },
    { name: "Professional", price: 499, datapoints: "10,000", reports: "50" },
    { name: "Enterprise", price: "Custom", datapoints: "Unlimited", reports: "Unlimited" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        <Link href="/billing" className="text-blue-600 hover:underline mb-4 inline-block">← Back</Link>
        <h1 className="text-4xl font-bold mb-8">Choose Your Plan</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div key={plan.name} className="bg-white rounded-lg shadow p-8">
              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              <p className="text-4xl font-bold text-blue-600 mb-4">${plan.price}</p>
              <ul className="space-y-3 mb-6 text-slate-600">
                <li>• {plan.datapoints} datapoints</li>
                <li>• {plan.reports} reports</li>
              </ul>
              <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Select Plan
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
