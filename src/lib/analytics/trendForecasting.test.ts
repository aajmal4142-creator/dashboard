import { describe, it, expect } from "vitest";
import {
  forecastETS,
  forecastARIMA,
  forecastHybrid,
  selectBestForecastModel,
} from "./trendForecasting";

describe("trendForecasting", () => {
  const generateHistoricalData = (trend: "increasing" | "decreasing" | "stable") => {
    const data = [];
    const baseDate = new Date("2023-01-01");

    for (let i = 0; i < 24; i++) {
      const date = new Date(baseDate);
      date.setMonth(date.getMonth() + i);

      let value = 1000;
      if (trend === "increasing") {
        value += i * 10;
      } else if (trend === "decreasing") {
        value -= i * 5;
      } else {
        value += Math.random() * 20 - 10;
      }

      data.push({
        date,
        value: Math.max(100, value),
      });
    }

    return data;
  };

  describe("forecastETS", () => {
    it("generates forecast with confidence intervals", () => {
      const historicalData = generateHistoricalData("increasing");
      const forecast = forecastETS(historicalData, 12);

      expect(forecast.model).toBe("ets");
      expect(forecast.forecasts.length).toBe(12);
      expect(forecast.accuracy).toHaveProperty("rmse");
      expect(forecast.accuracy).toHaveProperty("mae");
      expect(forecast.accuracy).toHaveProperty("mape");

      // Check confidence intervals are valid
      for (const f of forecast.forecasts) {
        expect(f.lowerBound95).toBeLessThanOrEqual(f.forecast);
        expect(f.forecast).toBeLessThanOrEqual(f.upperBound95);
        expect(f.lowerBound80).toBeLessThanOrEqual(f.upperBound80);
      }
    });

    it("detects trend direction", () => {
      const increasing = generateHistoricalData("increasing");
      const decreasing = generateHistoricalData("decreasing");

      const forecastInc = forecastETS(increasing, 12);
      const forecastDec = forecastETS(decreasing, 12);

      expect(forecastInc.trendDirection).toBe("increasing");
      expect(forecastDec.trendDirection).toBe("decreasing");
    });
  });

  describe("forecastARIMA", () => {
    it("generates valid forecast", () => {
      const historicalData = generateHistoricalData("increasing");
      const forecast = forecastARIMA(historicalData, 12);

      expect(forecast.model).toBe("arima");
      expect(forecast.forecasts.length).toBe(12);
      expect(forecast.accuracy).toBeDefined();

      // All forecasts should be positive
      for (const f of forecast.forecasts) {
        expect(f.forecast).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("forecastHybrid", () => {
    it("combines ARIMA and ETS models", () => {
      const historicalData = generateHistoricalData("increasing");
      const forecast = forecastHybrid(historicalData, 12);

      expect(forecast.model).toBe("hybrid");
      expect(forecast.forecasts.length).toBe(12);
      expect(forecast.accuracy).toBeDefined();
    });
  });

  describe("selectBestForecastModel", () => {
    it("auto-selects best model by accuracy", () => {
      const historicalData = generateHistoricalData("stable");
      const model = selectBestForecastModel(historicalData, 12);

      expect(model.model).toMatch(/arima|ets|hybrid/);
      expect(model.forecasts.length).toBe(12);
    });

    it("handles insufficient data gracefully", () => {
      const historicalData = [
        { date: new Date("2024-01-01"), value: 100 },
        { date: new Date("2024-02-01"), value: 110 },
      ];

      // Should fallback to ETS or similar
      const model = selectBestForecastModel(historicalData, 12);
      expect(model).toBeDefined();
      expect(model.forecasts.length).toBeGreaterThan(0);
    });
  });
});
