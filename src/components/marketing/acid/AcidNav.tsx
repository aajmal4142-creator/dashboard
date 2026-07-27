"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { ClearESGLogo } from "@/components/brand/ClearESGLogo";
import { MarketingAuthActions } from "@/components/marketing/MarketingAuthActions";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { cn } from "@/lib/utils";

const HOME_SECTIONS = [
  { id: "top", label: "Start" },
  { id: "how", label: "How it works" },
  { id: "stages", label: "What you get" },
  { id: "proof", label: "Who it's for" },
  { id: "gaps", label: "Why ClearESG" },
] as const;

const SITE_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/glossary", label: "Glossary" },
  { href: "/answers", label: "Help" },
  { href: "/tools", label: "Free tools" },
] as const;

export function AcidNav() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [active, setActive] = useState<string>("top");

  useEffect(() => {
    if (!isHome) return;

    const nodes = HOME_SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (n): n is HTMLElement => Boolean(n),
    );
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0];
        if (top?.target.id) setActive(top.target.id);
      },
      { rootMargin: "-18% 0px -55% 0px", threshold: [0.15, 0.4, 0.7] },
    );

    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [isHome]);

  return (
    <header className="sticky top-0 z-40 border-b border-rule/80 bg-canvas/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3.5">
        <ClearESGLogo height={34} />

        <nav className="hidden items-center gap-5 text-sm md:flex">
          {isHome
            ? HOME_SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="acid-link"
                  data-active={active === s.id ? "true" : "false"}
                >
                  {s.label}
                </a>
              ))
            : SITE_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="acid-link"
                  data-active={pathname.startsWith(l.href) ? "true" : "false"}
                >
                  {l.label}
                </Link>
              ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <MarketingAuthActions variant="acid" />
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-t border-rule/60 px-4 py-2 md:hidden">
        {isHome
          ? HOME_SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  active === s.id
                    ? "bg-accent text-primary-foreground"
                    : "bg-surface-2 text-ink-muted",
                )}
              >
                {s.label}
              </a>
            ))
          : SITE_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  pathname.startsWith(l.href)
                    ? "bg-accent text-primary-foreground"
                    : "bg-surface-2 text-ink-muted",
                )}
              >
                {l.label}
              </Link>
            ))}
      </div>
    </header>
  );
}
