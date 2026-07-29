import { describe, it, expect } from "vitest";
import {
  assessDataQuality,
  getDataQualityRating,
  type DataQualityInput,
} from "../dataQualityAssessor";

describe("Data Quality Assessor", () => {
  describe("assessDataQuality", () => {
    it("should return high score for excellent data", () => {
      const input: DataQualityInput = {
        totalDataPoints: 1000,
        estimatedDataPoints: 10,
        primaryDataPercentage: 95,
        dataSourcesDocumented: 20,
        totalDataSources: 20,
        dataAgeInMonths: 1,
        inconsistenciesFound: 0,
        recordsVerified: 990,
        totalRecords: 1000,
        methodologyDocumented: true,
        qualityReviewCompleted: true,
      };

      const result = assessDataQuality(input);
      expect(result.overallScore).toBeGreaterThanOrEqual(85);
      expect(result.completeness).toBeGreaterThanOrEqual(90);
      expect(result.accuracy).toBe(99);
      expect(result.consistency).toBe(100);
      expect(result.recency).toBe(100);
    });

    it("should return lower score for poor data quality", () => {
      const input: DataQualityInput = {
        totalDataPoints: 1000,
        estimatedDataPoints: 500,
        primaryDataPercentage: 40,
        dataSourcesDocumented: 10,
        totalDataSources: 25,
        dataAgeInMonths: 24,
        inconsistenciesFound: 150,
        recordsVerified: 500,
        totalRecords: 1000,
        methodologyDocumented: false,
        qualityReviewCompleted: false,
      };

      const result = assessDataQuality(input);
      expect(result.overallScore).toBeLessThan(60);
      expect(result.accuracy).toBeLessThan(60);
    });

    it("should penalize old data appropriately", () => {
      const recentData: DataQualityInput = {
        totalDataPoints: 100,
        estimatedDataPoints: 5,
        primaryDataPercentage: 80,
        dataSourcesDocumented: 10,
        totalDataSources: 10,
        dataAgeInMonths: 2,
        inconsistenciesFound: 0,
        recordsVerified: 95,
        totalRecords: 100,
        methodologyDocumented: true,
        qualityReviewCompleted: true,
      };

      const oldData: DataQualityInput = {
        ...recentData,
        dataAgeInMonths: 18,
      };

      const recentResult = assessDataQuality(recentData);
      const oldResult = assessDataQuality(oldData);

      expect(recentResult.recency).toBeGreaterThan(oldResult.recency);
    });

    it("should include detailed breakdown", () => {
      const input: DataQualityInput = {
        totalDataPoints: 100,
        estimatedDataPoints: 10,
        primaryDataPercentage: 80,
        dataSourcesDocumented: 8,
        totalDataSources: 10,
        dataAgeInMonths: 3,
        inconsistenciesFound: 2,
        recordsVerified: 90,
        totalRecords: 100,
        methodologyDocumented: true,
        qualityReviewCompleted: true,
      };

      const result = assessDataQuality(input);
      expect(result.breakdown.completeness.details).toContain("sources");
      expect(result.breakdown.accuracy.details).toContain("verified");
      expect(result.breakdown.consistency.details).toContain("inconsistencies");
      expect(result.breakdown.recency.details).toContain("months");
    });
  });

  describe("getDataQualityRating", () => {
    it("should return correct ratings", () => {
      expect(getDataQualityRating(95)).toBe("Excellent");
      expect(getDataQualityRating(85)).toBe("Good");
      expect(getDataQualityRating(75)).toBe("Acceptable");
      expect(getDataQualityRating(65)).toBe("Fair");
      expect(getDataQualityRating(45)).toBe("Poor");
    });
  });
});
