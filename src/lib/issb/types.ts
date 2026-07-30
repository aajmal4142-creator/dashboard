import type {
  TcfdAnswerSource,
  TcfdEmissionsSnapshot,
  TcfdPillar,
} from "@/lib/tcfd/types";

/** ISSB S1 general + S2 climate (extends TCFD). */
export type IssbStandard = "S1" | "S2";

export type IssbAnswer = {
  text: string;
  source: TcfdAnswerSource;
  autoFilled: boolean;
  updatedAt: string;
};

export type IssbAnswersMap = Record<string, IssbAnswer>;

export type IssbQuestion = {
  id: string;
  standard: IssbStandard;
  /** S2 climate questions map onto TCFD pillars. */
  tcfdPillar?: TcfdPillar;
  /** When set, S2 may inherit from linked TCFD answer id. */
  tcfdQuestionId?: string;
  label: string;
  prompt: string;
  autofillKey?: "emissions" | "materiality" | "quality";
  required: boolean;
};

export type IssbDisclosureSnapshot = {
  organisationName: string;
  reportingYear: number;
  status: "draft" | "final";
  versionLabel: string;
  publishedAt: string;
  s1: Array<{
    id: string;
    label: string;
    prompt: string;
    answer: string;
    source: TcfdAnswerSource;
    autoFilled: boolean;
  }>;
  s2: Array<{
    id: string;
    label: string;
    prompt: string;
    answer: string;
    source: TcfdAnswerSource;
    autoFilled: boolean;
    tcfdPillar?: TcfdPillar;
  }>;
  emissions: TcfdEmissionsSnapshot | null;
  linkedTcfdId: string | null;
  materialityNote: string | null;
  disclaimer: string;
  preparedBy?: { id: string; name: string } | null;
};

export const ISSB_DISCLAIMER =
  "ClearESG is not an assurance provider. This ISSB S1/S2 disclosure summarises management-reported answers and calculated emissions estimates. It is not an audit opinion or a determination of IFRS Sustainability Disclosure Standards compliance.";
