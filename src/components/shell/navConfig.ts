import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  BookOpen,
  Building2,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Database,
  FileText,
  Gauge,
  Inbox,
  ListChecks,
  Settings,
  ShieldCheck,
  Target,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

import { METRICS_HREF, METRICS_LABEL } from "@/lib/metrics";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  badgeKey?: "requests" | "questionnaires";
};

export type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

export function buildNavGroups(opts: {
  orgType: "company" | "consultancy" | null;
  onboarded: boolean;
}): NavGroup[] {
  const work: NavItem[] = [
    { href: "/", label: "Runway", icon: Gauge, exact: true },
    { href: METRICS_HREF, label: METRICS_LABEL, icon: ClipboardList },
    { href: "/suppliers", label: "Suppliers", icon: Truck },
    { href: "/suppliers/risk-dashboard", label: "Supplier risk", icon: ShieldCheck },
    { href: "/spend", label: "Spend", icon: Wallet },
    { href: "/materiality", label: "Materiality", icon: Target },
    { href: "/reports", label: "Reports", icon: FileText },
    { href: "/tcfd", label: "TCFD", icon: ClipboardCheck },
    { href: "/issb", label: "ISSB", icon: BookOpen },
    { href: "/compliance-templates", label: "Templates", icon: ListChecks },
    { href: "/iot", label: "IoT", icon: Activity },
    { href: "/database", label: "Database", icon: Database },
  ];

  const collaborate: NavItem[] = [
    {
      href: "/requests",
      label: "Requests",
      icon: Inbox,
      badgeKey: "requests",
    },
    {
      href: "/questionnaires",
      label: "Questionnaires",
      icon: ClipboardList,
      badgeKey: "questionnaires",
    },
  ];
  if (opts.orgType === "consultancy") {
    collaborate.push({ href: "/consultant", label: "Clients", icon: Users });
  }

  const assure: NavItem[] = [
    { href: "/guide", label: "Guide", icon: BookOpen },
    { href: "/assurance", label: "Assurance", icon: ClipboardCheck },
    {
      href: "/assurance-partners",
      label: "Partners",
      icon: Building2,
    },
    { href: "/audit", label: "Audit", icon: ShieldCheck },
    { href: "/benchmarks", label: "Benchmarks", icon: BarChart3 },
  ];

  const account: NavItem[] = [
    { href: "/settings", label: "Settings", icon: Settings },
    { href: "/billing", label: "Billing", icon: CreditCard },
  ];
  if (!opts.onboarded) {
    account.push({
      href: "/onboarding",
      label: "Baseline",
      icon: ListChecks,
    });
  }

  return [
    { id: "work", label: "Work", items: work },
    { id: "collaborate", label: "Collaborate", items: collaborate },
    { id: "assure", label: "Assure", items: assure },
    { id: "account", label: "Account", items: account },
  ];
}

export function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export type NavBadges = {
  requests: number;
  questionnaires: number;
};
