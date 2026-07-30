import http from "k6/http";
import { check, group, sleep } from "k6";
import { BASE_URL, ORG_ID, SCENARIOS, SCENARIO_CONFIG } from "../config.js";
import {
  getAuthHeaders,
  checkResponse,
  generateBatchSuppliers,
  validateSupplierRiskScore,
  validateEmissions,
  trackDuration,
  testGroup,
  retryRequest,
} from "../utils/helpers.js";

// Determine test scenario
const testType = __ENV.TEST_TYPE || "load";
const isSmokeTest = __ENV.SMOKE === "true";
const scenarioConfig = isSmokeTest ? SCENARIOS.smoke : SCENARIOS[testType];

export const options = {
  stages: scenarioConfig.stages || [
    { duration: scenarioConfig.duration, target: scenarioConfig.vus },
  ],
  thresholds: scenarioConfig.thresholds,
  setupTimeout: "60s",
  teardownTimeout: "30s",
};

// Setup: Create suppliers
export function setup() {
  console.log(
    `Starting Supplier Risk Scoring test with ${
      scenarioConfig.vus || scenarioConfig.stages[0].target
    } VUs`,
  );

  const supplierConfig = SCENARIO_CONFIG.supplierRisk;
  console.log(`Setting up ${supplierConfig.supplierCount} suppliers for testing`);

  // Create suppliers
  const suppliers = generateBatchSuppliers(supplierConfig.supplierCount);

  return {
    suppliers,
    supplierIds: suppliers.map((s) => s.id),
  };
}

export default function (data) {
  const supplierConfig = SCENARIO_CONFIG.supplierRisk;

  testGroup("Supplier Risk Scoring", () => {
    // Test 1: Single supplier risk calculation
    group("Single supplier risk calculation", () => {
      const supplier = data.suppliers[Math.floor(Math.random() * data.suppliers.length)];

      const response = retryRequest(
        "POST",
        "/api/app/suppliers/[id]/risk-breakdown",
        JSON.stringify(supplier),
        2,
        {
          headers: getAuthHeaders(),
          params: {
            timeout: "10000ms",
            tags: { name: "supplier_risk_single" },
          },
        },
      );

      checkResponse(response, "Single supplier risk calculation", {
        "status is 200": (r) => r.status === 200,
        "response time < 1000ms": (r) => r.timings.duration < 1000,
        "has risk score": (r) => {
          try {
            const body = r.json();
            return typeof body.riskScore === "number";
          } catch {
            return false;
          }
        },
      });

      // Validate risk score if response is valid
      if (response.status === 200) {
        try {
          const body = response.json();
          validateSupplierRiskScore(body.riskScore);
        } catch (e) {
          console.log(`Failed to parse risk response: ${e}`);
        }
      }
    });

    sleep(0.1);

    // Test 2: Batch supplier risk calculation
    group("Batch supplier risk calculation", () => {
      const batchSize = Math.min(50, supplierConfig.batchSize);
      const batch = data.suppliers.slice(0, batchSize);

      const startTime = Date.now();

      const response = retryRequest(
        "POST",
        "/api/app/suppliers/bulk-risk-calculation",
        JSON.stringify({
          orgId: ORG_ID,
          suppliers: batch,
          recalculate: true,
        }),
        2,
        {
          headers: getAuthHeaders(),
          params: {
            timeout: "30000ms",
            tags: { name: "supplier_risk_batch" },
          },
        },
      );

      const duration = trackDuration(startTime);

      checkResponse(response, "Batch supplier risk calculation", {
        "status is 200": (r) => r.status === 200,
        "completes within target": (r) => r.timings.duration < 60000,
        "has results": (r) => {
          try {
            const body = r.json();
            return Array.isArray(body.results) && body.results.length > 0;
          } catch {
            return false;
          }
        },
      });

      console.log(`Batch risk calculation for ${batchSize} suppliers took ${duration}ms`);
    });

    sleep(0.2);

    // Test 3: Large-scale risk recalculation (1000 suppliers)
    group("Large-scale risk recalculation", () => {
      const startTime = Date.now();

      const response = retryRequest(
        "POST",
        "/api/app/suppliers/recalculate-risks",
        JSON.stringify({
          orgId: ORG_ID,
          count: supplierConfig.supplierCount,
          batchSize: supplierConfig.batchSize,
        }),
        1,
        {
          headers: getAuthHeaders(),
          params: {
            timeout: `${supplierConfig.timeout}ms`,
            tags: { name: "supplier_risk_large_scale" },
          },
        },
      );

      const duration = trackDuration(startTime);

      check(
        { duration, expected: supplierConfig.expectedDuration },
        {
          "large-scale recalculation succeeds": (d) => response.status === 200,
          "completes within expected time": (d) => d.duration <= d.expected + 30000,
          "performance is within bounds": (d) => d.duration < supplierConfig.timeout,
        },
      );

      console.log(
        `Large-scale recalculation for ${supplierConfig.supplierCount} suppliers took ${duration}ms (target: ${supplierConfig.expectedDuration}ms)`,
      );
    });

    sleep(0.3);

    // Test 4: Risk score trending
    group("Risk score trending over time", () => {
      const supplier = data.suppliers[0];
      const startTime = Date.now();

      const response = retryRequest(
        "GET",
        `/api/app/suppliers/${supplier.id}/risk-trend`,
        null,
        2,
        {
          headers: getAuthHeaders(),
          params: {
            timeout: "5000ms",
            tags: { name: "supplier_risk_trend" },
          },
        },
      );

      checkResponse(response, "Risk score trending", {
        "status is 200": (r) => r.status === 200,
        "response contains trend data": (r) => {
          try {
            const body = r.json();
            return Array.isArray(body.trend) && body.trend.length > 0;
          } catch {
            return false;
          }
        },
      });
    });

    sleep(0.1);

    // Test 5: Emissions data retrieval and calculation
    group("Emissions data retrieval", () => {
      const supplier = data.suppliers[Math.floor(Math.random() * data.suppliers.length)];

      const response = retryRequest(
        "GET",
        `/api/app/suppliers/${supplier.id}/emissions`,
        null,
        2,
        {
          headers: getAuthHeaders(),
          params: {
            timeout: "5000ms",
            tags: { name: "supplier_emissions" },
          },
        },
      );

      checkResponse(response, "Emissions data retrieval", {
        "status is 200": (r) => r.status === 200,
        "has emissions data": (r) => {
          try {
            const body = r.json();
            return (
              body.scope1 !== undefined &&
              body.scope2 !== undefined &&
              body.scope3 !== undefined
            );
          } catch {
            return false;
          }
        },
      });

      if (response.status === 200) {
        try {
          const body = response.json();
          validateEmissions(body);
        } catch (e) {
          console.log(`Failed to validate emissions: ${e}`);
        }
      }
    });

    sleep(0.1);

    // Test 6: Compliance status check
    group("Compliance status check", () => {
      const supplier = data.suppliers[Math.floor(Math.random() * data.suppliers.length)];

      const response = retryRequest(
        "GET",
        `/api/app/suppliers/${supplier.id}/compliance-dashboard`,
        null,
        2,
        {
          headers: getAuthHeaders(),
          params: {
            timeout: "5000ms",
            tags: { name: "supplier_compliance" },
          },
        },
      );

      checkResponse(response, "Compliance status check", {
        "status is 200": (r) => r.status === 200,
        "has compliance status": (r) => {
          try {
            const body = r.json();
            return (
              body.status &&
              ["compliant", "non_compliant", "pending"].includes(body.status)
            );
          } catch {
            return false;
          }
        },
      });
    });

    sleep(0.2);

    // Test 7: Risk categorization
    group("Risk categorization", () => {
      const response = retryRequest(
        "POST",
        "/api/app/suppliers/categorize",
        JSON.stringify({
          orgId: ORG_ID,
          suppliers: data.suppliers.slice(0, 100),
        }),
        2,
        {
          headers: getAuthHeaders(),
          params: {
            timeout: "15000ms",
            tags: { name: "supplier_categorization" },
          },
        },
      );

      checkResponse(response, "Risk categorization", {
        "status is 200": (r) => r.status === 200,
        "returns categories": (r) => {
          try {
            const body = r.json();
            return body.high && body.medium && body.low && body.high.count !== undefined;
          } catch {
            return false;
          }
        },
      });
    });

    sleep(0.1);

    // Test 8: Performance monitoring
    group("Performance monitoring", () => {
      const startTime = Date.now();

      const response = http.get(`${BASE_URL}/api/health`, {
        tags: { name: "health_check" },
      });

      const duration = trackDuration(startTime);

      check(response, {
        "health check passes": (r) => r.status === 200,
        "health check is fast": (r) => r.timings.duration < 100,
      });

      console.log(`Health check took ${duration}ms`);
    });
  });

  sleep(1);
}

export function teardown(data) {
  console.log("Supplier Risk Scoring test completed");
}
