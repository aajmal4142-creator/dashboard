import type { OrgBranding } from "@/lib/branding";

export type SupplierPortalConfigView = {
  enabled: boolean;
  headline: string;
  welcomeMessage: string | null;
  showPoweredBy: boolean;
};

export type PortalPublicChrome = {
  orgName: string;
  branding: Pick<OrgBranding, "primaryColor" | "logoUrl">;
  portal: SupplierPortalConfigView;
};

export const DEFAULT_PORTAL_HEADLINE = "Quick data return";

export const DEFAULT_PORTAL_WELCOME =
  "Plain figures only. Your draft stays on this device until you submit.";

export function defaultPortalConfig(): SupplierPortalConfigView {
  return {
    enabled: true,
    headline: DEFAULT_PORTAL_HEADLINE,
    welcomeMessage: null,
    showPoweredBy: true,
  };
}

export type ReceiptFieldRow = {
  label: string;
  unit: string;
  value: number | null;
};

export type SupplierReceiptSnapshot = {
  orgName: string;
  supplierName: string;
  submittedAt: string;
  isResubmit: boolean;
  accentColor: string | null;
  fields: ReceiptFieldRow[];
  isMetered: boolean;
};
