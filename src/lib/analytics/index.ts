// Analytics & Insights Library
// Exports all analytics services for use in API routes and components

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
  runMonteCarloSimulation,
  performSensitivityAnalysis,
  calculatePaybackSchedule,
} from "./scenarioCalculator";

export type {
  Lever,
  ScenarioVariable,
  ScenarioResults,
  MonteCarloSimulation,
  SensitivityResult,
} from "./scenarioCalculator";

export {
  checkSBTiAlignment,
  generateOptimizedPathway,
  generateMilestonePathway,
  comparePathways,
} from "./pathwayPlanner";

export type {
  PathwayStage,
  DecarbonizationPathway,
  MilestonePathway,
  PathwayComparison,
} from "./pathwayPlanner";

export {
  forecastETS,
  forecastARIMA,
  forecastHybrid,
  selectBestForecastModel,
} from "./trendForecasting";

export type { TimeSeriesPoint, ForecastResult, ForecastModel } from "./trendForecasting";

export {
  calculateEmissionsPerRevenue,
  calculateEmissionsPerEmployee,
  calculateEmissionsPerUnit,
  calculateYoYChange,
  buildIntensityTrends,
  analyzeDecoupling,
  calculateIntensityMetrics,
  generateIntensityReport,
} from "./consumptionIntensity";

export type {
  IntensityMetric,
  IntensityTrend,
  DecouplingAnalysis,
  IntensityMetrics,
  IntensityReport,
} from "./consumptionIntensity";
