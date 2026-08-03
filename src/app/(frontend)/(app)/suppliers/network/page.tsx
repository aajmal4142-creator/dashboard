import { redirect } from "next/navigation";

import { PageFrame } from "@/components/shell/PageFrame";
import { getCurrentContext } from "@/lib/auth";
import { createTranslator } from "@/lib/i18n/t";
import { resolveLocale } from "@/lib/i18n/locales";

import { NetworkClient } from "./NetworkClient";

export const metadata = {
  title: "Supplier carbon network | ClearESG",
};

export default async function SupplierNetworkPage() {
  const ctx = await getCurrentContext();
  if (!ctx.activeOrg) redirect("/onboarding");
  if (!ctx.activeOrg.onboardedAt) redirect("/onboarding");

  const canWrite =
    ctx.role === "owner" || ctx.role === "admin" || ctx.role === "contributor";
  const t = createTranslator(resolveLocale(ctx.user?.language));

  return (
    <PageFrame
      eyebrow={t("supplierNetwork.eyebrow")}
      title={t("supplierNetwork.title")}
      help={t("supplierNetwork.help")}
    >
      <NetworkClient
        canWrite={canWrite}
        orgName={ctx.activeOrg.name}
        userEmail={ctx.user?.email ?? ""}
        labels={{
          disclaimer: t("supplierNetwork.disclaimer"),
          inviteTitle: t("supplierNetwork.inviteTitle"),
          inviteHelp: t("supplierNetwork.inviteHelp"),
          fieldEmail: t("supplierNetwork.fieldEmail"),
          fieldDisplayName: t("supplierNetwork.fieldDisplayName"),
          fieldMessage: t("supplierNetwork.fieldMessage"),
          sendInvite: t("supplierNetwork.sendInvite"),
          sending: t("supplierNetwork.sending"),
          invitesTitle: t("supplierNetwork.invitesTitle"),
          sharesTitle: t("supplierNetwork.sharesTitle"),
          sharesEmptyTitle: t("supplierNetwork.sharesEmptyTitle"),
          sharesEmptyHelp: t("supplierNetwork.sharesEmptyHelp"),
          invitesEmptyTitle: t("supplierNetwork.invitesEmptyTitle"),
          invitesEmptyHelp: t("supplierNetwork.invitesEmptyHelp"),
          incomingTitle: t("supplierNetwork.incomingTitle"),
          incomingHelp: t("supplierNetwork.incomingHelp"),
          incomingEmptyTitle: t("supplierNetwork.incomingEmptyTitle"),
          incomingEmptyHelp: t("supplierNetwork.incomingEmptyHelp"),
          accept: t("supplierNetwork.accept"),
          decline: t("supplierNetwork.decline"),
          cancel: t("common.cancel"),
          revoke: t("supplierNetwork.revoke"),
          accepting: t("supplierNetwork.accepting"),
          fieldPeriod: t("supplierNetwork.fieldPeriod"),
          fieldScope1: t("supplierNetwork.fieldScope1"),
          fieldScope2: t("supplierNetwork.fieldScope2"),
          fieldScope3: t("supplierNetwork.fieldScope3"),
          fieldNote: t("supplierNetwork.fieldNote"),
          scopeHint: t("supplierNetwork.scopeHint"),
          refresh: t("supplierNetwork.refresh"),
          retry: t("supplierNetwork.retry"),
          viewOnly: t("supplierNetwork.viewOnly"),
          errorLoad: t("supplierNetwork.errorLoad"),
          statusPending: t("supplierNetwork.statusPending"),
          statusAccepted: t("supplierNetwork.statusAccepted"),
          statusDeclined: t("supplierNetwork.statusDeclined"),
          statusRevoked: t("supplierNetwork.statusRevoked"),
          qualityMeasured: t("supplierNetwork.qualityMeasured"),
          qualityPartial: t("supplierNetwork.qualityPartial"),
          qualityMissing: t("supplierNetwork.qualityMissing"),
          colSupplier: t("supplierNetwork.colSupplier"),
          colPeriod: t("supplierNetwork.colPeriod"),
          colScope1: t("supplierNetwork.colScope1"),
          colScope2: t("supplierNetwork.colScope2"),
          colScope3: t("supplierNetwork.colScope3"),
          colQuality: t("supplierNetwork.colQuality"),
          colStatus: t("supplierNetwork.colStatus"),
          colEmail: t("supplierNetwork.colEmail"),
          colActions: t("supplierNetwork.colActions"),
          inviteOk: t("supplierNetwork.inviteOk"),
          acceptOk: t("supplierNetwork.acceptOk"),
          declineOk: t("supplierNetwork.declineOk"),
          revokeOk: t("supplierNetwork.revokeOk"),
          actionFailed: t("supplierNetwork.actionFailed"),
          fromBuyer: t("supplierNetwork.fromBuyer"),
        }}
      />
    </PageFrame>
  );
}
