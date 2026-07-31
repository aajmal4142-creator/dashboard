import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  BookOpen,
  Building2,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Crosshair,
  Database,
  FileText,
  Gauge,
  Inbox,
  Leaf,
  ListChecks,
  Network,
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
    { href: "/suppliers/engagement", label: "Engagement", icon: ClipboardList },
    { href: "/suppliers/risk-dashboard", label: "Supplier risk", icon: ShieldCheck },
    { href: "/suppliers/supply-chain", label: "Supply chain", icon: Network },
    { href: "/scope3/category-1", label: "Cat 1 tiers", icon: Truck },
    { href: "/spend", label: "Spend", icon: Wallet },
    { href: "/materiality", label: "Materiality", icon: Target },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/reports", label: "Reports", icon: FileText },
    { href: "/compliance/calendar", label: "Reg calendar", icon: ClipboardList },
    { href: "/tcfd", label: "TCFD", icon: ClipboardCheck },
    { href: "/issb", label: "ISSB", icon: BookOpen },
    { href: "/compliance/sbti-tracking", label: "SBTi", icon: Crosshair },
    { href: "/compliance/iso-14064", label: "ISO 14064", icon: ClipboardCheck },
    {
      href: "/compliance/green-taxonomy",
      label: "Green Taxonomy",
      icon: Leaf,
    },
    { href: "/compliance-templates", label: "Templates", icon: ListChecks },
    { href: "/integrations/accounting", label: "Accounting", icon: Wallet },
    { href: "/iot", label: "IoT", icon: Activity },
    { href: "/integrations/iot/gateways", label: "IoT gateways", icon: Network },
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
