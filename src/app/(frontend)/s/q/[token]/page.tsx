import { EngagementPublicForm } from "./EngagementPublicForm";
import {
  generateQuestionnaireTemplate,
  loadPublicForm,
  type EngagementStatus,
} from "@/lib/suppliers";
import type { SupplierPortalConfigView } from "@/lib/portal";

export const metadata = {
  title: "ESG Questionnaire | ClearESG",
};

type InitialState = {
  token: string;
  orgName: string;
  supplierName: string;
  status: EngagementStatus;
  expired: boolean;
  alreadySubmitted: boolean;
  expiresAt: string | null;
  template: ReturnType<typeof generateQuestionnaireTemplate>;
  responses: Record<string, unknown>;
  completionPercent: number;
  error?: string;
  branding?: {
    primaryColor: string | null;
    logoUrl: string | null;
  };
  portal?: SupplierPortalConfigView;
  portalPaused?: boolean;
};

export default async function EngagementPublicPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let initial: InitialState;

  try {
    const form = await loadPublicForm(token);
    if (!form) {
      initial = {
        token,
        orgName: "",
        supplierName: "",
        status: "draft",
        expired: false,
        alreadySubmitted: false,
        expiresAt: null,
        template: generateQuestionnaireTemplate(),
        responses: {},
        completionPercent: 0,
        error: "This link is not valid.",
      };
    } else {
      initial = {
        token: form.token,
        orgName: form.orgName,
        supplierName: form.supplierName,
        status: form.status,
        expired: form.expired,
        alreadySubmitted: form.alreadySubmitted,
        expiresAt: form.expiresAt,
        template: form.template,
        responses: form.responses,
        completionPercent: form.completionPercent,
        branding: form.branding,
        portal: form.portal,
        portalPaused: form.portalPaused,
      };
    }
  } catch {
    initial = {
      token,
      orgName: "",
      supplierName: "",
      status: "draft",
      expired: false,
      alreadySubmitted: false,
      expiresAt: null,
      template: generateQuestionnaireTemplate(),
      responses: {},
      completionPercent: 0,
      error: "Could not load this questionnaire. Try again later.",
    };
  }

  return <EngagementPublicForm token={token} initial={initial} />;
}
