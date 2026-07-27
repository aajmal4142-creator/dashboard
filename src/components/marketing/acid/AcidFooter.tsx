import Link from "next/link";

import { ClearESGLogo } from "@/components/brand/ClearESGLogo";

const YEAR = new Date().getFullYear();

export function AcidFooter() {
  return (
    <footer className="mt-auto border-t border-rule px-6 py-10 text-sm text-ink-muted">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div>
          <ClearESGLogo height={32} />
          <p className="mt-3 max-w-xs text-xs leading-relaxed">
            Clear sustainability reports for everyday businesses.
          </p>
        </div>
        <div className="flex flex-wrap gap-5">
          <Link href="/pricing" className="acid-link">
            Pricing
          </Link>
          <Link href="/tools" className="acid-link">
            Free tools
          </Link>
          <Link href="/glossary" className="acid-link">
            Glossary
          </Link>
          <Link href="/answers" className="acid-link">
            Help
          </Link>
        </div>
        <p className="text-xs text-ink-muted">© {YEAR} ClearESG</p>
      </div>
    </footer>
  );
}
