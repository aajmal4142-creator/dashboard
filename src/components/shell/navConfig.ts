import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileText,
  Gauge,
  Inbox,
  ListChecks,
  Settings,
  ShieldCheck,
  Target,
  Truck,
  Users,
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
    { href: "/dashboard", label: "Runway", icon: Gauge, exact: true },
    { href: METRICS_HREF, label: METRICS_LABEL, icon: ClipboardList },
    { href: "/dashboard/suppliers", label: "Suppliers", icon: Truck },
    { href: "/dashboard/materiality", label: "Materiality", icon: Target },
    { href: "/dashboard/reports", label: "Reports", icon: FileText },
  ];

  const collaborate: NavItem[] = [
    {
      href: "/dashboard/requests",
      label: "Requests",
      icon: Inbox,
      badgeKey: "requests",
    },
    {
      href: "/dashboard/questionnaires",
      label: "Questionnaires",
      icon: ClipboardList,
      badgeKey: "questionnaires",
    },
  ];
  if (opts.orgType === "consultancy") {
    collaborate.push({ href: "/dashboard/consultant", label: "Clients", icon: Users });
  }

  const assure: NavItem[] = [
    { href: "/dashboard/guide", label: "Guide", icon: BookOpen },
    { href: "/dashboard/assurance", label: "Assurance", icon: ClipboardCheck },
    { href: "/dashboard/audit", label: "Audit", icon: ShieldCheck },
    { href: "/dashboard/benchmarks", label: "Benchmarks", icon: BarChart3 },
  ];

  const account: NavItem[] = [
    { href: "/dashboard/settings", label: "Settings", icon: Settings },
    { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  ];
  if (!opts.onboarded) {
    account.push({
      href: "/dashboard/onboarding",
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
