export {
  calculatePeerBenchmarks,
  getAnonymizedPeers,
  getBenchmarkStatus,
  getBenchmarkInsights,
} from "./benchmarking";

export type { PeerBenchmark, BenchmarkComparison } from "./benchmarking";

export {
  calculateLeverImpact,
  calculateScenarioImpact,
  calculateScopeReductionImpact,
  runMonteCarloSimulation,
  performSensitivityAnalysis,
  calculatePaybackSchedule,
  compareScenarioTrajectories,
} from "./scenarioCalculator";

export type {
  Lever,
  ScenarioVariable,
  ScenarioResults,
  MonteCarloSimulation,
  SensitivityResult,
  ScopeBaseline,
  ScopeEmissions,
  ScenarioScope,
  ScenarioCategory,
  TrajectoryPoint,
  ReductionScenarioInput,
  ScenarioCompareRow,
} from "./scenarioCalculator";

export { resolveOrgBaselineByScope } from "./resolveOrgBaseline";

export {
  checkSBTiAlignment,
  generateOptimizedPathway,
  generateMilestonePathway,
  comparePathways,
  calculatePathway,
  calculateRequiredAnnualReduction,
  calculateFeasibility,
  distributeReductionsAcrossYears,
  buildMilestonesFromDistribution,
  buildTimeline,
  compareActualToPathway,
  expectedEmissionsAtYear,
  validatePathwayTargets,
  parseMilestoneStatus,
  parsePathwayScope,
  DEFAULT_INTERVENTION_TEMPLATES,
} from "./pathwayPlanner";

export type {
  PathwayStage,
  DecarbonizationPathway,
  MilestonePathway,
  PathwayComparison,
  PathwayMilestone,
  PathwayPlanInput,
  PathwayPlanResult,
  PathwayTimelinePoint,
  FeasibilityResult,
  FeasibilityLevel,
  InterventionTemplate,
  MilestoneStatus,
  PathwayScope,
  ActualProgressComparison,
  ActualProgressInput,
} from "./pathwayPlanner";

export {
  forecastETS,
  forecastARIMA,
  forecastHybrid,
  selectBestForecastModel,
} from "./trendForecasting";

export type { TimeSeriesPoint, ForecastResult, ForecastModel } from "./trendForecasting";

export {
  calculateEmissionsForecast,
  formatProjectionSummary,
  linearRegression,
  projectYear,
  resolveForecastConfidence,
  validateAssumptions,
  ASSUMPTION_BOUNDS,
  DEFAULT_SCENARIO_GROWTH,
} from "./forecast";

export type {
  EmissionsPeriod,
  ForecastAssumptions,
  ForecastConfidence,
  ForecastInput,
  ForecastIntervention,
  ForecastPoint,
  ForecastResultSet,
  ForecastScenarioType,
  ScenarioForecast,
  ScenarioGrowthDefaults,
} from "./forecast";

export { loadEmissionsByPeriod } from "./loadEmissionsByPeriod";

export {
  calculateEmissionsIntensity,
  calculateEmissionsPerRevenue,
  calculateEmissionsPerEmployee,
  calculateEmissionsPerUnit,
  calculateEmissionsPerSquareMeter,
  buildOutputIntensityUnit,
  calculateYoYChange,
  compareIntensityToMedian,
  resolveIntensityForType,
  buildIntensityTrends,
  analyzeDecoupling,
  calculateIntensityMetrics,
  generateIntensityReport,
  intensityBenchmarkMetricKey,
  DEFAULT_INTENSITY_UNITS,
  INTENSITY_TYPES,
} from "./consumptionIntensity";

export type {
  IntensityMetric,
  IntensityTrend,
  DecouplingAnalysis,
  IntensityMetrics,
  IntensityReport,
  IntensityType,
  IntensityConfidence,
  IntensityPeerStatus,
  EmissionsIntensityResult,
  IntensityDenominators,
  CalculateEmissionsIntensityOptions,
} from "./consumptionIntensity";
