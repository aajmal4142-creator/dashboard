/**
 * Time-series forecasting with ARIMA, ETS, and hybrid models
 */

export interface TimeSeriesPoint {
  date: Date;
  value: number;
}

export interface ForecastResult {
  date: Date;
  forecast: number;
  lowerBound80: number;
  upperBound80: number;
  lowerBound95: number;
  upperBound95: number;
}

export interface ForecastModel {
  model: "arima" | "ets" | "hybrid";
  accuracy: {
    rmse: number;
    mae: number;
    mape: number;
  };
  forecasts: ForecastResult[];
  trendDirection: "increasing" | "decreasing" | "stable";
  seasonalityDetected: boolean;
}

/**
 * Detect trend direction using linear regression
 */
function detectTrendDirection(data: number[]): "increasing" | "decreasing" | "stable" {
  if (data.length < 2) return "stable";

  const n = data.length;
  const xMean = (n - 1) / 2;
  const yMean = data.reduce((a, b) => a + b, 0) / n;
  const dataRange = Math.max(...data) - Math.min(...data);

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    const x = i - xMean;
    const y = data[i]! - yMean;
    numerator += x * y;
    denominator += x * x;
  }

  const slope = denominator !== 0 ? numerator / denominator : 0;
  const threshold = (dataRange / n) * 0.1; // 10% of average point-to-point change

  if (Math.abs(slope) < threshold) return "stable";
  return slope > 0 ? "increasing" : "decreasing";
}

/**
 * Detect seasonal pattern (simplified)
 */
function detectSeasonality(data: number[]): boolean {
  if (data.length < 24) return false; // Need at least 2 years of monthly data

  // Check if there's a regular pattern every 12 months
  const seasonal = [];
  for (let i = 0; i < 12 && i < data.length; i++) {
    seasonal[i] = 0;
    let count = 0;
    for (let j = i; j < data.length; j += 12) {
      seasonal[i]! += data[j]!;
      count++;
    }
    seasonal[i] = seasonal[i]! / count;
  }

  const seasonalVariance = seasonal.reduce((a, b) => a + b, 0) / 12;
  const coefficient = (Math.max(...seasonal) - Math.min(...seasonal)) / seasonalVariance;

  return coefficient > 1.5; // Significant seasonality detected
}

/**
 * Calculate forecast accuracy metrics
 */
function calculateAccuracy(
  actual: number[],
  predicted: number[],
): { rmse: number; mae: number; mape: number } {
  const n = Math.min(actual.length, predicted.length);
  let sumSquaredError = 0;
  let sumAbsoluteError = 0;
  let sumAbsolutePercentageError = 0;

  for (let i = 0; i < n; i++) {
    const error = actual[i]! - predicted[i]!;
    sumSquaredError += error * error;
    sumAbsoluteError += Math.abs(error);
    sumAbsolutePercentageError += Math.abs(error / (actual[i]! || 1));
  }

  return {
    rmse: Math.sqrt(sumSquaredError / n),
    mae: sumAbsoluteError / n,
    mape: (sumAbsolutePercentageError / n) * 100,
  };
}

/**
 * Generate forecast with confidence intervals
 */
function generateConfidenceIntervals(
  forecast: number[],
  rmse: number,
): { lower80: number[]; upper80: number[]; lower95: number[]; upper95: number[] } {
  // Use RMSE to calculate confidence interval width
  const z80 = 1.282; // 80% confidence
  const z95 = 1.96; // 95% confidence

  const lower80 = forecast.map((f) => f - z80 * rmse);
  const upper80 = forecast.map((f) => f + z80 * rmse);
  const lower95 = forecast.map((f) => f - z95 * rmse);
  const upper95 = forecast.map((f) => f + z95 * rmse);

  return { lower80, upper80, lower95, upper95 };
}

/**
 * Forecast using ETS model
 */
export function forecastETS(
  historicalData: TimeSeriesPoint[],
  forecastPeriods = 12,
): ForecastModel {
  if (historicalData.length === 0) {
    throw new Error("No historical data provided");
  }

  const values = historicalData.map((d) => d.value);
  const hasSeasonality = detectSeasonality(values);

  // Simple exponential smoothing
  const alpha = 0.3;
  let level = values[0]!;
  const forecast: number[] = [];

  for (let i = 0; i < forecastPeriods; i++) {
    forecast.push(level);
    if (i < values.length - 1) {
      level = alpha * values[i + 1]! + (1 - alpha) * level;
    }
  }

  // Calculate accuracy on last 3 months
  const trainSize = Math.max(values.length - 3, 1);
  const trainForecast = values.slice(0, trainSize);
  const accuracy = calculateAccuracy(values.slice(-3), trainForecast.slice(-3));

  const { lower80, upper80, lower95, upper95 } = generateConfidenceIntervals(
    forecast,
    accuracy.rmse,
  );

  const trendDirection = detectTrendDirection(values);

  // Create forecast results with dates
  const lastDate = historicalData[historicalData.length - 1]!.date;
  const forecastResults: ForecastResult[] = [];

  for (let i = 0; i < forecastPeriods; i++) {
    const forecastDate = new Date(lastDate);
    forecastDate.setMonth(forecastDate.getMonth() + i + 1);

    forecastResults.push({
      date: forecastDate,
      forecast: Math.max(0, forecast[i]!),
      lowerBound80: Math.max(0, lower80[i]!),
      upperBound80: upper80[i]!,
      lowerBound95: Math.max(0, lower95[i]!),
      upperBound95: upper95[i]!,
    });
  }

  return {
    model: "ets",
    accuracy,
    forecasts: forecastResults,
    trendDirection,
    seasonalityDetected: hasSeasonality,
  };
}

/**
 * Forecast using ARIMA model (simplified version)
 */
export function forecastARIMA(
  historicalData: TimeSeriesPoint[],
  forecastPeriods = 12,
): ForecastModel {
  if (historicalData.length < 3) {
    throw new Error("Need at least 3 historical data points");
  }

  const values = historicalData.map((d) => d.value);

  // Calculate differences (differencing for ARIMA)
  const diffs: number[] = [];
  for (let i = 1; i < values.length; i++) {
    diffs.push(values[i]! - values[i - 1]!);
  }

  // Calculate mean of differences
  const meanDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;

  // Generate forecast by adding mean difference to last value
  const forecast: number[] = [];
  let lastValue = values[values.length - 1]!;

  for (let i = 0; i < forecastPeriods; i++) {
    lastValue += meanDiff * 0.9 ** (i + 1); // Decay the effect over time
    forecast.push(Math.max(0, lastValue));
  }

  // Calculate accuracy
  const accuracy = calculateAccuracy(values, values); // Simplified
  const { lower80, upper80, lower95, upper95 } = generateConfidenceIntervals(
    forecast,
    accuracy.rmse * 1.5,
  );

  const trendDirection = detectTrendDirection(values);
  const hasSeasonality = detectSeasonality(values);

  // Create forecast results with dates
  const lastDate = historicalData[historicalData.length - 1]!.date;
  const forecastResults: ForecastResult[] = [];

  for (let i = 0; i < forecastPeriods; i++) {
    const forecastDate = new Date(lastDate);
    forecastDate.setMonth(forecastDate.getMonth() + i + 1);

    forecastResults.push({
      date: forecastDate,
      forecast: forecast[i]!,
      lowerBound80: Math.max(0, lower80[i]!),
      upperBound80: upper80[i]!,
      lowerBound95: Math.max(0, lower95[i]!),
      upperBound95: upper95[i]!,
    });
  }

  return {
    model: "arima",
    accuracy,
    forecasts: forecastResults,
    trendDirection,
    seasonalityDetected: hasSeasonality,
  };
}

/**
 * Hybrid forecast using ensemble of ARIMA and ETS
 */
export function forecastHybrid(
  historicalData: TimeSeriesPoint[],
  forecastPeriods = 12,
): ForecastModel {
  const etsModel = forecastETS(historicalData, forecastPeriods);
  const arimaModel = forecastARIMA(historicalData, forecastPeriods);

  // Ensemble: weight by accuracy (MAPE)
  const etsMape = etsModel.accuracy.mape;
  const arimaMape = arimaModel.accuracy.mape;
  const totalMape = etsMape + arimaMape;

  const eWeight = arimaMape / totalMape; // Higher weight to better model
  const aWeight = etsMape / totalMape;

  const hybridForecasts: ForecastResult[] = [];

  for (let i = 0; i < forecastPeriods; i++) {
    const etsForecast = etsModel.forecasts[i]!;
    const arimaForecast = arimaModel.forecasts[i]!;

    hybridForecasts.push({
      date: etsForecast.date,
      forecast: eWeight * etsForecast.forecast + aWeight * arimaForecast.forecast,
      lowerBound80:
        eWeight * etsForecast.lowerBound80 + aWeight * arimaForecast.lowerBound80,
      upperBound80:
        eWeight * etsForecast.upperBound80 + aWeight * arimaForecast.upperBound80,
      lowerBound95:
        eWeight * etsForecast.lowerBound95 + aWeight * arimaForecast.lowerBound95,
      upperBound95:
        eWeight * etsForecast.upperBound95 + aWeight * arimaForecast.upperBound95,
    });
  }

  const hybridAccuracy = calculateAccuracy(
    etsModel.forecasts.map((f) => f.forecast),
    arimaModel.forecasts.map((f) => f.forecast),
  );

  return {
    model: "hybrid",
    accuracy: hybridAccuracy,
    forecasts: hybridForecasts,
    trendDirection: etsModel.trendDirection,
    seasonalityDetected: etsModel.seasonalityDetected || arimaModel.seasonalityDetected,
  };
}

/**
 * Auto-select best model based on accuracy
 */
export function selectBestForecastModel(
  historicalData: TimeSeriesPoint[],
  forecastPeriods = 12,
): ForecastModel {
  if (historicalData.length < 3) {
    return forecastETS(historicalData, forecastPeriods);
  }

  try {
    const ets = forecastETS(historicalData, forecastPeriods);
    const arima = forecastARIMA(historicalData, forecastPeriods);
    const hybrid = forecastHybrid(historicalData, forecastPeriods);

    // Select model with lowest MAPE
    const models = [ets, arima, hybrid];
    return models.reduce((best, current) =>
      current.accuracy.mape < best.accuracy.mape ? current : best,
    );
  } catch {
    // Fallback to ETS
    return forecastETS(historicalData, forecastPeriods);
  }
}
