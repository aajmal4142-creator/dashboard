import { describe, it, expect } from "vitest";
import { Scope3Validator } from "../validation";
import type { ActivityDataField } from "../types";

describe("Scope3Validator", () => {
  const validator = new Scope3Validator();

  const requiredFields: ActivityDataField[] = [
    {
      name: "quantity",
      unit: "tonnes",
      description: "Quantity of material",
      required: true,
    },
    {
      name: "distance",
      unit: "miles",
      description: "Distance travelled",
      required: false,
    },
  ];

  describe("validateActivity", () => {
    it("should validate correct data", async () => {
      const result = await validator.validateActivity(
        { quantity: 100, distance: 50 },
        requiredFields,
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.normalizedData).toEqual({ quantity: 100, distance: 50 });
    });

    it("should reject missing required field", async () => {
      const result = await validator.validateActivity({ distance: 50 }, requiredFields);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should reject non-numeric values", async () => {
      const result = await validator.validateActivity(
        { quantity: "abc", distance: 50 },
        requiredFields,
      );
      expect(result.valid).toBe(false);
    });

    it("should reject negative values", async () => {
      const result = await validator.validateActivity(
        { quantity: -100, distance: 50 },
        requiredFields,
      );
      expect(result.valid).toBe(false);
    });

    it("should normalize string numbers", async () => {
      const result = await validator.validateActivity(
        { quantity: "100.5", distance: "50" },
        requiredFields,
      );
      expect(result.valid).toBe(true);
      expect(result.normalizedData?.quantity).toBe(100.5);
    });

    it("should allow optional fields to be missing", async () => {
      const result = await validator.validateActivity({ quantity: 100 }, requiredFields);
      expect(result.valid).toBe(true);
    });
  });

  describe("detectAnomalies", () => {
    it("should not flag normal values", () => {
      const historical = [100, 101, 99, 102, 100];
      const result = validator.detectAnomalies(100, historical);
      expect(result.isAnomaly).toBe(false);
    });

    it("should flag values >3σ from mean", () => {
      const historical = [100, 101, 99, 102, 100];
      const result = validator.detectAnomalies(200, historical); // Way above mean
      expect(result.isAnomaly).toBe(true);
    });

    it("should handle empty historical data", () => {
      const result = validator.detectAnomalies(100, []);
      expect(result.isAnomaly).toBe(false);
    });

    it("should handle uniform historical data", () => {
      const historical = [100, 100, 100, 100];
      const result = validator.detectAnomalies(100, historical);
      expect(result.isAnomaly).toBe(false);
    });

    it("should calculate z-score for varying data", () => {
      const historical = [90, 95, 100, 105, 110];
      const result = validator.detectAnomalies(105, historical); // Near mean
      expect(result.zscore).toBeDefined();
      expect(result.zscore!).toBeLessThan(1); // Close to mean
    });
  });

  describe("isDuplicate", () => {
    it("should detect exact duplicates", () => {
      const activityData = { quantity: 100, distance: 50 };
      const historical = [{ quantity: 100, distance: 50 }];
      expect(validator.isDuplicate(activityData, historical)).toBe(true);
    });

    it("should not flag different values", () => {
      const activityData = { quantity: 100, distance: 50 };
      const historical = [{ quantity: 101, distance: 50 }];
      expect(validator.isDuplicate(activityData, historical)).toBe(false);
    });

    it("should handle empty historical data", () => {
      const activityData = { quantity: 100, distance: 50 };
      expect(validator.isDuplicate(activityData, [])).toBe(false);
    });
  });

  describe("validateCSVRow", () => {
    it("should validate CSV row correctly", () => {
      const row = { quantity: "100", distance: "50" };
      const result = validator.validateCSVRow(row, requiredFields, 1);
      expect(result.valid).toBe(true);
      expect(result.normalizedData?.quantity).toBe(100);
    });

    it("should report row number in errors", () => {
      const row = { distance: "50" }; // Missing quantity
      const result = validator.validateCSVRow(row, requiredFields, 5);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain("Row 5");
    });

    it("should reject rows with empty required fields", () => {
      const row = { quantity: "", distance: "50" };
      const result = validator.validateCSVRow(row, requiredFields, 1);
      expect(result.valid).toBe(false);
    });

    it("should reject negative values in CSV", () => {
      const row = { quantity: "-100", distance: "50" };
      const result = validator.validateCSVRow(row, requiredFields, 1);
      expect(result.valid).toBe(false);
    });
  });
});
