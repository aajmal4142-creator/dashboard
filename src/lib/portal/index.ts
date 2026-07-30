export {
  DEFAULT_PORTAL_HEADLINE,
  DEFAULT_PORTAL_WELCOME,
  defaultPortalConfig,
  type PortalPublicChrome,
  type ReceiptFieldRow,
  type SupplierPortalConfigView,
  type SupplierReceiptSnapshot,
} from "@/lib/portal/types";
export { portalFormProgress } from "@/lib/portal/progress";
export {
  getPortalConfigForOrg,
  resolvePortalChrome,
  upsertPortalConfig,
} from "@/lib/portal/resolve";
export { SupplierReceiptPdfDocument } from "@/lib/portal/ReceiptPdfDocument";
