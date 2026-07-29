import { getCurrentContext } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function UsagePage() {
  const ctx = await getCurrentContext();
  if (!ctx.user || !ctx.activeOrg) redirect("/login");

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        <Link href="/billing" className="text-blue-600 hover:underline mb-4 inline-block">← Back</Link>
        <h1 className="text-4xl font-bold mb-8">Usage Details</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-2">Datapoints</h3>
            <p className="text-4xl font-bold text-blue-600">0</p>
            <p className="text-slate-600">This month</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-2">Reports</h3>
            <p className="text-4xl font-bold text-green-600">0</p>
            <p className="text-slate-600">This month</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-2">Storage</h3>
            <p className="text-4xl font-bold text-purple-600">0 GB</p>
            <p className="text-slate-600">Used</p>
          </div>
        </div>
      </div>
    </div>
  );
}
