import Link from "next/link";

import { InkReveal } from "@/components/motion";

export function RunwayFooter() {
  return (
    <InkReveal delay={0.24} className="pt-6">
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <Link href="/dashboard/reports" className="editorial-link">
          Reports
        </Link>
        <Link href="/dashboard/guide" className="editorial-link">
          Guided mode
        </Link>
        <Link href="/dashboard/audit" className="editorial-link">
          Change log
        </Link>
      </div>
    </InkReveal>
  );
}
