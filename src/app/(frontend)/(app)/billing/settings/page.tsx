import { getCurrentContext } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const ctx = await getCurrentContext();
  if (!ctx.user || !ctx.activeOrg) redirect("/login");

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/billing" className="text-blue-600 hover:underline mb-4 inline-block">← Back</Link>
        <h1 className="text-4xl font-bold mb-8">Billing Settings</h1>
        
        <div className="bg-white rounded-lg shadow p-8 mb-6">
          <h2 className="text-2xl font-bold mb-4">Payment Method</h2>
          <p className="text-slate-600 mb-4">Update your payment information</p>
          <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Update Payment Method
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-2xl font-bold mb-4">Subscription</h2>
          <p className="text-slate-600 mb-4">Manage your subscription</p>
          <button className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
            Cancel Subscription
          </button>
        </div>
      </div>
    </div>
  );
}
