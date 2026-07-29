import { getCurrentContext } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function InvoicesPage() {
  const ctx = await getCurrentContext();
  if (!ctx.user || !ctx.activeOrg) redirect("/login");

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        <Link href="/billing" className="text-blue-600 hover:underline mb-4 inline-block">← Back</Link>
        <h1 className="text-4xl font-bold mb-8">Invoices</h1>
        <div className="bg-white rounded-lg shadow p-8 text-center text-slate-600">
          <p>Invoice history and downloads will be displayed here</p>
        </div>
      </div>
    </div>
  );
}
