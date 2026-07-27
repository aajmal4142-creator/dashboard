"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  buildNavGroups,
  isNavActive,
  type NavBadges,
} from "@/components/shell/navConfig";
import type { MembershipRole } from "@/lib/access/membership";
import { cn } from "@/lib/utils";

export function AppNav({
  orgType,
  onboarded,
  role: _role,
  collapsed,
  badges,
  onNavigate,
}: {
  orgType: "company" | "consultancy" | null;
  onboarded: boolean;
  role: MembershipRole | null;
  collapsed?: boolean;
  badges?: NavBadges;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const groups = buildNavGroups({ orgType, onboarded });

  return (
    <nav className="flex flex-col gap-5" aria-label="Product">
      {groups.map((group) => (
        <div key={group.id}>
          {!collapsed ? (
            <p className="label-caps mb-2 px-2 text-[10px] text-ink-muted">
              {group.label}
            </p>
          ) : (
            <div className="mx-2 mb-2 h-px bg-rule" aria-hidden />
          )}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isNavActive(pathname, item);
              const Icon = item.icon;
              const count = item.badgeKey && badges ? badges[item.badgeKey] : 0;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    aria-label={item.label}
                    onClick={onNavigate}
                    className={cn(
                      "group relative flex cursor-pointer items-center gap-2.5 rounded-[4px] px-2 py-1.5 text-sm transition-colors focus-visible:outline-accent",
                      collapsed && "justify-center px-0",
                      active
                        ? "bg-accent-quiet text-ink"
                        : "text-ink-muted hover:bg-surface-2 hover:text-ink",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    {active ? (
                      <span
                        className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent"
                        aria-hidden
                      />
                    ) : null}
                    <span className="relative shrink-0">
                      <Icon className="size-4" aria-hidden />
                      {collapsed && count > 0 ? (
                        <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-accent" />
                      ) : null}
                    </span>
                    {!collapsed ? (
                      <>
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {count > 0 ? (
                          <span className="font-data rounded-[2px] bg-accent px-1.5 py-0.5 text-[10px] text-canvas">
                            {count > 99 ? "99+" : count}
                          </span>
                        ) : null}
                      </>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
