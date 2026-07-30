import http from "k6/http";
import { check, group, sleep } from "k6";
import { BASE_URL, ORG_ID, SCENARIOS, SCENARIO_CONFIG } from "../config.js";
import {
  getAuthHeaders,
  checkResponse,
  generateScenario,
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

// Setup
export function setup() {
  console.log(
    `Starting Scenario Modeling test with ${
      scenarioConfig.vus || scenarioConfig.stages[0].target
    } VUs`,
  );

  const modelingConfig = SCENARIO_CONFIG.scenarioModeling;
  console.log(`Generating ${modelingConfig.simulations} simulation scenarios`);

  return {
    scenarios: Array.from({ length: 10 }, (_, i) =>
      generateScenario(modelingConfig.simulations / 10),
    ),
  };
}

export default function (data) {
  const modelingConfig = SCENARIO_CONFIG.scenarioModeling;

  testGroup("Scenario Modeling - Monte Carlo Simulations", () => {
    // Test 1: Single scenario Monte Carlo simulation
    group("Single scenario Monte Carlo simulation", () => {
      const scenario = data.scenarios[0];
      const startTime = Date.now();

      const response = retryRequest(
        "POST",
        "/api/app/scenario-modeling/simulate",
        JSON.stringify({
          orgId: ORG_ID,
          scenario: scenario,
          parallel: false,
        }),
        2,
        {
          headers: getAuthHeaders(),
          params: {
            timeout: `${modelingConfig.timeout}ms`,
            tags: { name: "scenario_monte_carlo_single" },
          },
        },
      );

      const duration = trackDuration(startTime);

      checkResponse(response, "Single Monte Carlo simulation", {
        "status is 200": (r) => r.status === 200,
        "completes within timeout": (r) => r.timings.duration < modelingConfig.timeout,
        "has results": (r) => {
          try {
            const body = r.json();
            return body.results && Array.isArray(body.results);
          } catch {
            return false;
          }
        },
        "has statistics": (r) => {
          try {
            const body = r.json();
            return (
              body.statistics &&
              body.statistics.mean !== undefined &&
              body.statistics.median !== undefined
            );
          } catch {
            return false;
          }
        },
      });

      console.log(
        `Single scenario simulation (${scenario.simulations} simulations) took ${duration}ms`,
      );
    });

    sleep(0.2);

    // Test 2: Concurrent multi-scenario simulations
    group("Concurrent multi-scenario simulations", () => {
      const startTime = Date.now();
      const concurrentScenarios = Math.min(10, modelingConfig.concurrentUsers);
      const results = [];

      for (let i = 0; i < concurrentScenarios; i++) {
        const scenario = data.scenarios[i % data.scenarios.length];

        const response = http.post(
          `${BASE_URL}/api/app/scenario-modeling/simulate`,
          JSON.stringify({
            orgId: ORG_ID,
            scenario: scenario,
            parallel: true,
          }),
          {
            headers: getAuthHeaders(),
            tags: { name: "scenario_concurrent" },
          },
        );

        results.push({
          status: response.status,
          duration: response.timings.duration,
        });
      }

      const duration = trackDuration(startTime);
      const successCount = results.filter((r) => r.status === 200).length;
      const avgDuration =
        results.reduce((sum, r) => sum + r.duration, 0) / results.length;

      check(
        {
          successCount,
          avgDuration,
          expected: modelingConfig.expectedDuration,
        },
        {
          "concurrent simulations all succeed": (r) =>
            r.successCount === concurrentScenarios,
          "average response time within bounds": (r) => r.avgDuration < r.expected + 2000,
          "total duration is reasonable": (r) =>
            r.duration < concurrentScenarios * (r.expected + 1000),
        },
      );

      console.log(
        `${concurrentScenarios} concurrent scenarios took ${duration}ms total, avg ${avgDuration.toFixed(0)}ms per scenario`,
      );
    });

    sleep(0.3);

    // Test 3: Large-scale simulation (1000 simulations)
    group("Large-scale Monte Carlo (1000 simulations)", () => {
      const scenario = generateScenario(modelingConfig.simulations);
      const startTime = Date.now();

      const response = retryRequest(
        "POST",
        "/api/app/scenario-modeling/simulate",
        JSON.stringify({
          orgId: ORG_ID,
          scenario: scenario,
          parallel: true,
          optimize: true,
        }),
        1,
        {
          headers: getAuthHeaders(),
          params: {
            timeout: "20000ms",
            tags: { name: "scenario_large_scale" },
          },
        },
      );

      const duration = trackDuration(startTime);

      check(
        { duration, expected: modelingConfig.expectedDuration },
        {
          "large-scale simulation succeeds": () => response.status === 200,
          "completes within expected time": (d) => d.duration <= d.expected + 3000,
          "response includes convergence metrics": () => {
            try {
              const body = response.json();
              return body.convergence !== undefined;
            } catch {
              return false;
            }
          },
        },
      );

      if (response.status === 200) {
        try {
          const body = response.json();
          check(body, {
            "has distribution data": (b) =>
              b.distribution && Array.isArray(b.distribution),
            "has percentile data": (b) => b.percentiles && b.percentiles.p5 !== undefined,
            "has confidence intervals": (b) =>
              b.confidenceIntervals && b.confidenceIntervals.lower !== undefined,
          });
        } catch (e) {
          console.log(`Failed to parse large-scale results: ${e}`);
        }
      }

      console.log(
        `Large-scale simulation (${scenario.simulations} simulations) took ${duration}ms (target: ${modelingConfig.expectedDuration}ms)`,
      );
    });

    sleep(0.2);

    // Test 4: Sensitivity analysis
    group("Sensitivity analysis", () => {
      const scenario = data.scenarios[0];
      const startTime = Date.now();

      const response = retryRequest(
        "POST",
        "/api/app/scenario-modeling/sensitivity",
        JSON.stringify({
          orgId: ORG_ID,
          scenario: scenario,
          variables: ["baselineEmissions", "reductionTarget", "costMultiplier"],
        }),
        2,
        {
          headers: getAuthHeaders(),
          params: {
            timeout: "15000ms",
            tags: { name: "scenario_sensitivity" },
          },
        },
      );

      const duration = trackDuration(startTime);

      checkResponse(response, "Sensitivity analysis", {
        "status is 200": (r) => r.status === 200,
        "has sensitivity data": (r) => {
          try {
            const body = r.json();
            return body.sensitivity && Object.keys(body.sensitivity).length > 0;
          } catch {
            return false;
          }
        },
        "includes tornado chart data": (r) => {
          try {
            const body = r.json();
            return body.tornado && Array.isArray(body.tornado);
          } catch {
            return false;
          }
        },
      });

      console.log(`Sensitivity analysis took ${duration}ms`);
    });

    sleep(0.2);

    // Test 5: Scenario comparison
    group("Scenario comparison", () => {
      const scenarios = data.scenarios.slice(0, 3);
      const startTime = Date.now();

      const response = retryRequest(
        "POST",
        "/api/app/scenario-modeling/compare",
        JSON.stringify({
          orgId: ORG_ID,
          scenarios: scenarios,
        }),
        2,
        {
          headers: getAuthHeaders(),
          params: {
            timeout: "15000ms",
            tags: { name: "scenario_comparison" },
          },
        },
      );

      const duration = trackDuration(startTime);

      checkResponse(response, "Scenario comparison", {
        "status is 200": (r) => r.status === 200,
        "has comparison results": (r) => {
          try {
            const body = r.json();
            return body.comparison && Array.isArray(body.comparison.scenarios);
          } catch {
            return false;
          }
        },
        "includes performance deltas": (r) => {
          try {
            const body = r.json();
            return body.deltas && body.deltas.length > 0;
          } catch {
            return false;
          }
        },
      });

      console.log(
        `Scenario comparison (${scenarios.length} scenarios) took ${duration}ms`,
      );
    });

    sleep(0.2);

    // Test 6: Real-time simulation updates
    group("Real-time simulation streaming", () => {
      const scenario = data.scenarios[0];
      const startTime = Date.now();

      const response = http.post(
        `${BASE_URL}/api/app/scenario-modeling/stream`,
        JSON.stringify({
          orgId: ORG_ID,
          scenario: scenario,
        }),
        {
          headers: getAuthHeaders(),
          tags: { name: "scenario_stream" },
        },
      );

      const duration = trackDuration(startTime);

      check(response, {
        "streaming initiated": (r) => r.status === 200 || r.status === 201,
        "response includes stream ID": (r) => {
          try {
            const body = r.json();
            return !!body.streamId;
          } catch {
            return false;
          }
        },
      });

      console.log(`Streaming simulation took ${duration}ms to initialize`);
    });

    sleep(0.2);

    // Test 7: Model persistence
    group("Save and retrieve model", () => {
      const scenario = data.scenarios[0];
      let savedModelId;

      // Save model
      const saveResponse = retryRequest(
        "POST",
        "/api/app/scenario-modeling/save",
        JSON.stringify({
          orgId: ORG_ID,
          scenario: scenario,
          name: `Load Test Scenario ${Date.now()}`,
          description: "Generated during load test",
        }),
        2,
        {
          headers: getAuthHeaders(),
          params: { timeout: "10000ms" },
        },
      );

      if (saveResponse.status === 200) {
        try {
          const body = saveResponse.json();
          savedModelId = body.modelId;

          // Retrieve saved model
          const getResponse = http.get(
            `${BASE_URL}/api/app/scenario-modeling/${savedModelId}`,
            {
              headers: getAuthHeaders(),
              tags: { name: "scenario_retrieve" },
            },
          );

          check(getResponse, {
            "model retrieval succeeds": (r) => r.status === 200,
            "retrieved data matches": (r) => {
              try {
                const body = r.json();
                return body.modelId === savedModelId;
              } catch {
                return false;
              }
            },
          });
        } catch (e) {
          console.log(`Failed to parse save response: ${e}`);
        }
      }

      check(saveResponse, {
        "model saved successfully": (r) => r.status === 200,
      });
    });

    sleep(0.1);

    // Test 8: Export scenario results
    group("Export scenario results", () => {
      const scenario = data.scenarios[0];

      const response = retryRequest(
        "POST",
        "/api/app/scenario-modeling/export",
        JSON.stringify({
          orgId: ORG_ID,
          scenario: scenario,
          format: "json",
        }),
        2,
        {
          headers: getAuthHeaders(),
          params: { timeout: "10000ms" },
        },
      );

      checkResponse(response, "Export scenario results", {
        "status is 200": (r) => r.status === 200,
        "has export data": (r) => r.body && r.body.length > 0,
      });
    });
  });

  sleep(1);
}

export function teardown(data) {
  console.log("Scenario Modeling test completed");
}
