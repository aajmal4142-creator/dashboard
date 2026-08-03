export {
  buildTradeoffComparison,
  evaluateOption,
  findParetoFront,
  normalizeWeights,
  rankByWeightedScore,
  resolveOptionCarbon,
} from "./tradeoff";

export type {
  ParetoPoint,
  ParetoResult,
  PurchaseOptionInput,
  ResolvedOption,
  ScoredOption,
  TradeoffComparisonResult,
  TradeoffQuality,
  TradeoffRankResult,
  TradeoffWeights,
} from "./tradeoffTypes";

export {
  computeScenarioTradeoff,
  docToTradeoffScenario,
  getOrgTradeoffScenario,
  listOrgTradeoffScenarios,
  optionDtoToInput,
} from "./tradeoffService";

export type { TradeoffOptionDto, TradeoffScenarioDto } from "./tradeoffService";
