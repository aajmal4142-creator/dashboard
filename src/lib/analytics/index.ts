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
  COMPARE_TYPES,
  COMPARE_PRESETS,
  accumulateByKey,
  calculateChange,
  compareGrouped,
  compareMultiPeriod,
  compareTwoTotals,
  comparisonToCsv,
  dimensionFromNote,
  isCompareType,
  resolvePresetYears,
  sumMap,
} from "./compare";

export type {
  ChangeStats,
  ComparePreset,
  CompareRow,
  CompareType,
  ComparisonResult,
  GroupedComparison,
  MultiPeriodComparison,
  PeriodSlice,
  YoYComparison,
} from "./compare";

export {
  HOTSPOT_DIMENSIONS,
  HOTSPOT_SORT_MODES,
  CATEGORY_LABELS,
  accumulateHotspotDimension,
  categoryFromCalcRole,
  dimensionKeyFor,
  dimensionLabelFor,
  hotspotsToCsv,
  isHotspotDimension,
  isHotspotSortMode,
  isUsableActivityValue,
  rankHotspots,
} from "./hotspots";

export type {
  HotspotActivityRow,
  HotspotDimension,
  HotspotPeriodMeta,
  HotspotQuality,
  HotspotResult,
  HotspotRow,
  HotspotSortMode,
} from "./hotspots";

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

export {
  buildMacc,
  buildMaccCurvePoints,
  calculateLeverCost,
  calculateLeverRoi,
  isAbatementLeverCategory,
  sortLeversByCostPerTco2e,
} from "./macc";

export type {
  AbatementLeverCategory,
  AbatementLeverInput,
  LeverCostResult,
  LeverRoiResult,
  MaccBuildResult,
  MaccCurvePoint,
  MaccQuality,
} from "./maccTypes";

export {
  computeOrgMacc,
  docToAbatementLever,
  getOrgAbatementLever,
  leverDtoToInput,
  listOrgAbatementLevers,
} from "./maccService";

export type { AbatementLeverDto } from "./maccService";

export {
  calculateChildProgress,
  isAllocationMode,
  isCascadeStatus,
  resolveChildBaselineTco2e,
  resolveChildTargetTco2e,
  rollupChildProgress,
  validateAllocationShares,
  ALLOCATION_MODES,
  CASCADE_STATUSES,
} from "./targetCascade";

export type {
  AllocationMode,
  CascadeAllocationInput,
  CascadeProgressRollup,
  CascadeStatus,
  ChildProgressInput,
  ChildProgressRow,
  ProgressQuality,
  ShareValidationError,
  ShareValidationOpts,
  ShareValidationResult,
} from "./targetCascade";

export {
  buildCascadeProgress,
  createCascadedTarget,
  deleteCascadedTarget,
  docToCascadedTarget,
  getOrgCascadedTarget,
  listOrgCascadedTargets,
  parseCascadeWriteBody,
  updateCascadedTarget,
} from "./targetCascadeService";

export type {
  CascadeAllocationDto,
  CascadedTargetDto,
  CascadedTargetWriteInput,
} from "./targetCascadeService";
