export type {
  TcfdAnswer,
  TcfdAnswersMap,
  TcfdAnswerSource,
  TcfdDisclosureSnapshot,
  TcfdEmissionsSnapshot,
  TcfdPillar,
  TcfdQuestion,
  TcfdScenarioSummary,
} from "./types";
export { TCFD_DISCLAIMER, TCFD_PILLAR_TITLES } from "./types";
export { TCFD_QUESTIONS, questionById, questionsByPillar } from "./questions";
export { applyTcfdAutofill, loadOrgScenarios, loadTcfdEmissions } from "./autofill";
export {
  buildTcfdSnapshot,
  diffTcfdAnswers,
  resolveScenarioSummaries,
  parseAnswers,
  parseEmissions,
} from "./snapshot";
export { compareTcfdYears, yoyFromPrior, type TcfdYearCompare } from "./compare";
export { TcfdPdfDocument } from "./TcfdPdfDocument";
