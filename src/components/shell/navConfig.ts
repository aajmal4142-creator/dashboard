import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Crosshair,
  Database,
  FileText,
  Gauge,
  GitCompare,
  History,
  Inbox,
  LayoutDashboard,
  Leaf,
  ListChecks,
  Network,
  Settings,
  ShieldCheck,
  Target,
  Truck,
  Users,
  Wallet,
  Workflow,
} from "lucide-react";

import { METRICS_HREF } from "@/lib/metrics";

export type NavItem = {
  href: string;
  /** i18n key under nav.items.* */
  labelKey: string;
  icon: LucideIcon;
  exact?: boolean;
  badgeKey?: "requests" | "questionnaires";
};

export type NavGroup = {
  id: string;
  /** i18n key under nav.groups.* */
  labelKey: string;
  items: NavItem[];
};

export function buildNavGroups(opts: {
  orgType: "company" | "consultancy" | null;
  onboarded: boolean;
}): NavGroup[] {
  const work: NavItem[] = [
    { href: "/", labelKey: "nav.items.runway", icon: Gauge, exact: true },
    { href: "/dashboards", labelKey: "nav.items.dashboards", icon: LayoutDashboard },
    { href: "/alerts", labelKey: "nav.items.alerts", icon: Bell },
    { href: "/automations", labelKey: "nav.items.automations", icon: Workflow },
    { href: METRICS_HREF, labelKey: "nav.items.metrics", icon: ClipboardList },
    { href: "/suppliers", labelKey: "nav.items.suppliers", icon: Truck },
    {
      href: "/suppliers/engagement",
      labelKey: "nav.items.engagement",
      icon: ClipboardList,
    },
    {
      href: "/suppliers/risk-dashboard",
      labelKey: "nav.items.supplierRisk",
      icon: ShieldCheck,
    },
    {
      href: "/suppliers/supply-chain",
      labelKey: "nav.items.supplyChain",
      icon: Network,
    },
    { href: "/scope3/category-1", labelKey: "nav.items.cat1Tiers", icon: Truck },
    { href: "/spend", labelKey: "nav.items.spend", icon: Wallet },
    { href: "/materiality", labelKey: "nav.items.materiality", icon: Target },
    { href: "/analytics", labelKey: "nav.items.analytics", icon: BarChart3 },
    { href: "/analytics/compare", labelKey: "nav.items.compare", icon: GitCompare },
    { href: "/reports", labelKey: "nav.items.reports", icon: FileText },
    {
      href: "/compliance/calendar",
      labelKey: "nav.items.regCalendar",
      icon: ClipboardList,
    },
    { href: "/tcfd", labelKey: "nav.items.tcfd", icon: ClipboardCheck },
    { href: "/issb", labelKey: "nav.items.issb", icon: BookOpen },
    { href: "/compliance/sbti-tracking", labelKey: "nav.items.sbti", icon: Crosshair },
    {
      href: "/compliance/iso-14064",
      labelKey: "nav.items.iso14064",
      icon: ClipboardCheck,
    },
    {
      href: "/compliance/green-taxonomy",
      labelKey: "nav.items.greenTaxonomy",
      icon: Leaf,
    },
    {
      href: "/compliance-templates",
      labelKey: "nav.items.templates",
      icon: ListChecks,
    },
    {
      href: "/integrations/accounting",
      labelKey: "nav.items.accounting",
      icon: Wallet,
    },
    { href: "/integrations/slack", labelKey: "nav.items.slack", icon: Bell },
    { href: "/iot", labelKey: "nav.items.iot", icon: Activity },
    {
      href: "/integrations/iot/gateways",
      labelKey: "nav.items.iotGateways",
      icon: Network,
    },
    { href: "/database", labelKey: "nav.items.database", icon: Database },
  ];

  const collaborate: NavItem[] = [
    {
      href: "/requests",
      labelKey: "nav.items.requests",
      icon: Inbox,
      badgeKey: "requests",
    },
    {
      href: "/questionnaires",
      labelKey: "nav.items.questionnaires",
      icon: ClipboardList,
      badgeKey: "questionnaires",
    },
  ];
  if (opts.orgType === "consultancy") {
    collaborate.push({
      href: "/consultant",
      labelKey: "nav.items.clients",
      icon: Users,
    });
  }

  const assure: NavItem[] = [
    { href: "/guide", labelKey: "nav.items.guide", icon: BookOpen },
    { href: "/assurance", labelKey: "nav.items.assurance", icon: ClipboardCheck },
    {
      href: "/assurance-partners",
      labelKey: "nav.items.partners",
      icon: Building2,
    },
    { href: "/activity", labelKey: "nav.items.activity", icon: History },
    { href: "/audit", labelKey: "nav.items.audit", icon: ShieldCheck },
    { href: "/benchmarks", labelKey: "nav.items.benchmarks", icon: BarChart3 },
  ];

  const account: NavItem[] = [
    { href: "/settings", labelKey: "nav.items.settings", icon: Settings },
    { href: "/billing", labelKey: "nav.items.billing", icon: CreditCard },
  ];
  if (!opts.onboarded) {
    account.push({
      href: "/onboarding",
      labelKey: "nav.items.baseline",
      icon: ListChecks,
    });
  }

  return [
    { id: "work", labelKey: "nav.groups.work", items: work },
    { id: "collaborate", labelKey: "nav.groups.collaborate", items: collaborate },
    { id: "assure", labelKey: "nav.groups.assure", items: assure },
    { id: "account", labelKey: "nav.groups.account", items: account },
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
