"use client";

import Link from "next/link";
import { Menu, PanelLeft, PanelLeftClose, X } from "lucide-react";
import { useId, useState } from "react";
import { usePathname } from "next/navigation";

import { Assemble, RuleDraw } from "@/components/motion";
import { AppNav } from "@/components/shell/AppNav";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { OrgSwitcher } from "@/components/shell/OrgSwitcher";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import type { NavBadges } from "@/components/shell/navConfig";
import { useSidebarChrome } from "@/components/shell/useSidebarChrome";
import type { MembershipRole } from "@/lib/access/membership";
import { cn } from "@/lib/utils";

type ShellOrg = { id: string; name: string };

export type AppShellProps = {
  children: React.ReactNode;
  orgs: ShellOrg[];
  activeOrgId: string | null;
  role: MembershipRole | null;
  orgType: "company" | "consultancy" | null;
  onboarded: boolean;
  badges?: NavBadges;
  activeOrgName?: string | null;
  logoUrl?: string | null;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CE";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function roleLabel(role: MembershipRole | null): string {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Can approve";
  if (role === "contributor") return "Can edit data";
  if (role === "viewer") return "View only";
  return "Member";
}

export function AppShell({
  children,
  orgs,
  activeOrgId,
  role,
  orgType,
  onboarded,
  badges = { requests: 0, questionnaires: 0 },
  activeOrgName,
  logoUrl = null,
}: AppShellProps) {
  const { collapsed, width, dragging, toggle, onDragStart } = useSidebarChrome();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const panelId = useId();
  const pathname = usePathname();
  const focused = pathname.startsWith("/dashboard/onboarding");
  const orgName =
    activeOrgName ?? orgs.find((o) => o.id === activeOrgId)?.name ?? "Organisation";

  function renderSidebar(opts: { railCollapsed: boolean; showCollapseToggle: boolean }) {
    const railCollapsed = opts.railCollapsed;
    return (
      <>
        <div
          className={cn(
            "flex shrink-0 items-center gap-2 border-b border-rule px-3 py-3",
            railCollapsed && "flex-col gap-3",
          )}
        >
          <Link
            href="/dashboard"
            className={cn(
              "label-caps min-w-0 truncate text-ink focus-visible:outline-accent",
              railCollapsed && "text-center text-[10px]",
            )}
            title="ClearESG"
          >
            {railCollapsed ? "CE" : "ClearESG"}
          </Link>
          {opts.showCollapseToggle ? (
            <button
              type="button"
              onClick={toggle}
              className="ml-auto rounded-[4px] p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink focus-visible:outline-accent"
              aria-label={railCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title="Toggle sidebar ([)"
            >
              {railCollapsed ? (
                <PanelLeft className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </button>
          ) : (
            <button
              type="button"
              className="ml-auto rounded-[4px] p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink lg:hidden"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div
          className={cn(
            "shrink-0 border-b border-rule px-3 py-3",
            railCollapsed && "px-2",
          )}
        >
          <div className={cn("flex items-center gap-2", railCollapsed && "flex-col")}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- org-uploaded logo URL
              <img
                src={logoUrl}
                alt=""
                className="size-8 shrink-0 rounded-[var(--radius-chip)] object-contain"
                title={orgName}
              />
            ) : (
              <div
                className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-chip)] bg-accent text-xs font-medium text-on-accent"
                title={orgName}
                aria-hidden
              >
                {initials(orgName)}
              </div>
            )}
            {!railCollapsed ? (
              <div className="min-w-0 flex-1">
                <p className="label-caps text-[10px] text-ink-muted">{roleLabel(role)}</p>
              </div>
            ) : null}
          </div>
          {!railCollapsed ? (
            <div className="mt-3">
              <OrgSwitcher orgs={orgs} activeOrgId={activeOrgId} compact />
            </div>
          ) : (
            <div className="mt-2 flex justify-center">
              <OrgSwitcher orgs={orgs} activeOrgId={activeOrgId} compact iconOnly />
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-4">
          <AppNav
            orgType={orgType}
            onboarded={onboarded}
            role={role}
            collapsed={railCollapsed}
            badges={badges}
            onNavigate={() => setMobileOpen(false)}
          />
        </div>

        <div
          className={cn(
            "mt-auto flex shrink-0 items-center border-t border-rule px-3 py-3",
            railCollapsed ? "justify-center" : "justify-between",
          )}
        >
          {!railCollapsed ? (
            <button
              type="button"
              className="text-[11px] text-ink-muted hover:text-ink focus-visible:outline-accent"
              onClick={() => setPaletteOpen(true)}
            >
              <span className="font-data">⌘K</span> search
            </button>
          ) : (
            <button
              type="button"
              className="rounded-[4px] p-1.5 text-[10px] font-data text-ink-muted hover:bg-surface-2 hover:text-ink"
              aria-label="Open command palette"
              title="⌘K"
              onClick={() => setPaletteOpen(true)}
            >
              ⌘K
            </button>
          )}
          <ThemeToggle />
        </div>
      </>
    );
  }

  if (focused) {
    return (
      <div
        data-app-shell
        className="fixed inset-0 flex min-h-0 flex-col overflow-hidden bg-canvas text-ink"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-rule px-4 py-3">
          <Link href="/dashboard" className="label-caps text-ink">
            ClearESG
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-xs text-ink-muted underline-offset-2 hover:text-ink hover:underline"
            >
              Exit to runway
            </Link>
            <ThemeToggle />
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-canvas">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      data-app-shell
      className="fixed inset-0 flex min-h-0 overflow-hidden bg-canvas text-ink"
    >
      {/* Desktop sidebar — fixed height, nav scrolls inside */}
      <Assemble
        layer="chrome"
        as="aside"
        className="relative z-30 hidden h-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-rule bg-surface-1 lg:flex"
        style={{ width }}
      >
        <RuleDraw accent onMount duration={0.35} className="w-full shrink-0" />
        {renderSidebar({ railCollapsed: collapsed, showCollapseToggle: true })}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          className={cn(
            "absolute top-0 right-0 z-10 h-full w-1.5 cursor-col-resize touch-none",
            "after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-rule",
            "hover:after:bg-rule-strong active:after:bg-accent",
            dragging && "after:bg-accent",
          )}
          onPointerDown={(e) => {
            e.preventDefault();
            onDragStart(e.clientX);
          }}
        />
      </Assemble>

      {/* Main column */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-40 flex shrink-0 items-center justify-between gap-3 border-b border-rule px-4 py-3 lg:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-[4px] border border-rule bg-surface-1 p-2 text-ink focus-visible:outline-accent"
              aria-expanded={mobileOpen}
              aria-controls={panelId}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
            <Link href="/dashboard" className="label-caps text-ink">
              ClearESG
            </Link>
          </div>
          <ThemeToggle />
        </header>

        {mobileOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-ink/25"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            />
            <div
              id={panelId}
              className="absolute inset-y-0 left-0 flex w-[min(100%,280px)] flex-col overflow-hidden border-r border-rule bg-surface-1 shadow-[0_16px_40px_-20px_rgba(26,23,20,0.35)]"
            >
              {renderSidebar({ railCollapsed: false, showCollapseToggle: false })}
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-canvas">
          {children}
        </div>
      </div>

      <CommandPalette
        orgType={orgType}
        onboarded={onboarded}
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
      />
    </div>
  );
}
