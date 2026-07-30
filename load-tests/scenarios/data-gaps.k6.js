import http from "k6/http";
import { check, group, sleep } from "k6";
import { BASE_URL, ORG_ID, SCENARIOS, SCENARIO_CONFIG } from "../config.js";
import {
  getAuthHeaders,
  checkResponse,
  validateDataGap,
  generateOrgData,
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
    `Starting Data Gaps Detection test with ${
      scenarioConfig.vus || scenarioConfig.stages[0].target
    } VUs`,
  );

  const gapsConfig = SCENARIO_CONFIG.dataGaps;
  console.log(`Setting up ${gapsConfig.orgCount} organizations for gap detection`);

  const orgs = Array.from({ length: gapsConfig.orgCount }, () => generateOrgData());

  return {
    orgs,
    orgIds: orgs.map((o) => o.orgId),
  };
}

export default function (data) {
  const gapsConfig = SCENARIO_CONFIG.dataGaps;

  testGroup("Data Gap Detection - Assurance & Verification", () => {
    // Test 1: Single organization gap detection
    group("Single organization gap detection", () => {
      const org = data.orgs[Math.floor(Math.random() * data.orgs.length)];
      const startTime = Date.now();

      const response = retryRequest(
        "POST",
        `/api/app/assurance/engagements/${org.orgId}/data-gaps`,
        JSON.stringify({
          orgId: org.orgId,
          framework: "csrd",
        }),
        2,
        {
          headers: getAuthHeaders(),
          params: {
            timeout: `${gapsConfig.timeout}ms`,
            tags: { name: "gaps_single_org" },
          },
        },
      );

      const duration = trackDuration(startTime);

      checkResponse(response, "Single organization gap detection", {
        "status is 200": (r) => r.status === 200,
        "response time < expected": (r) =>
          r.timings.duration < gapsConfig.expectedPerOrg + 100,
        "has gaps": (r) => {
          try {
            const body = r.json();
            return Array.isArray(body.gaps);
          } catch {
            return false;
          }
        },
      });

      console.log(`Gap detection for 1 org took ${duration}ms`);

      if (response.status === 200) {
        try {
          const body = response.json();
          body.gaps?.forEach((gap) => validateDataGap(gap));
        } catch (e) {
          console.log(`Failed to validate gaps: ${e}`);
        }
      }
    });

    sleep(0.1);

    // Test 2: Batch organization gap detection
    group("Batch organization gap detection", () => {
      const batchSize = Math.min(50, Math.floor(data.orgs.length / 10));
      const batch = data.orgs.slice(0, batchSize);
      const startTime = Date.now();

      const response = retryRequest(
        "POST",
        "/api/app/assurance/data-gaps/batch",
        JSON.stringify({
          orgIds: batch.map((o) => o.orgId),
          framework: "csrd",
        }),
        2,
        {
          headers: getAuthHeaders(),
          params: {
            timeout: "30000ms",
            tags: { name: "gaps_batch" },
          },
        },
      );

      const duration = trackDuration(startTime);

      checkResponse(response, "Batch organization gap detection", {
        "status is 200": (r) => r.status === 200,
        "returns results for all orgs": (r) => {
          try {
            const body = r.json();
            return Object.keys(body.gaps || {}).length === batchSize;
          } catch {
            return false;
          }
        },
        "response time is reasonable": (r) =>
          r.timings.duration < batchSize * (gapsConfig.expectedPerOrg + 50),
      });

      console.log(
        `Gap detection for ${batchSize} orgs took ${duration}ms (avg ${(duration / batchSize).toFixed(0)}ms per org)`,
      );
    });

    sleep(0.2);

    // Test 3: Large-scale parallel gap detection (500 orgs)
    group("Large-scale parallel gap detection", () => {
      const startTime = Date.now();

      const response = retryRequest(
        "POST",
        "/api/app/assurance/data-gaps/parallel",
        JSON.stringify({
          orgIds: data.orgIds,
          framework: "csrd",
          concurrency: gapsConfig.concurrency,
        }),
        1,
        {
          headers: getAuthHeaders(),
          params: {
            timeout: "120000ms",
            tags: { name: "gaps_parallel_large" },
          },
        },
      );

      const duration = trackDuration(startTime);

      check(
        { duration, orgCount: data.orgs.length },
        {
          "parallel gap detection succeeds": () => response.status === 200,
          "target performance achieved": (d) =>
            d.duration < d.orgCount * (gapsConfig.expectedPerOrg + 50),
          "completes reasonably": (d) => d.duration < 60000, // 1 min for 500 orgs
        },
      );

      console.log(
        `Parallel gap detection for ${data.orgs.length} orgs took ${duration}ms (avg ${(duration / data.orgs.length).toFixed(0)}ms per org)`,
      );
    });

    sleep(0.3);

    // Test 4: Gap severity classification
    group("Gap severity classification", () => {
      const org = data.orgs[Math.floor(Math.random() * data.orgs.length)];

      const response = retryRequest(
        "POST",
        `/api/app/assurance/engagements/${org.orgId}/classify-gaps`,
        JSON.stringify({
          orgId: org.orgId,
          gaps: [
            {
              id: "gap-1",
              type: "missing_datapoint",
              description: "No emissions data for facility A",
            },
            {
              id: "gap-2",
              type: "insufficient_evidence",
              description: "Supplier sustainability data incomplete",
            },
          ],
        }),
        2,
        {
          headers: getAuthHeaders(),
          params: {
            timeout: "10000ms",
            tags: { name: "gaps_classify" },
          },
        },
      );

      checkResponse(response, "Gap severity classification", {
        "status is 200": (r) => r.status === 200,
        "includes severity": (r) => {
          try {
            const body = r.json();
            return (
              body.classified &&
              body.classified.some((g) => ["low", "medium", "high"].includes(g.severity))
            );
          } catch {
            return false;
          }
        },
      });
    });

    sleep(0.1);

    // Test 5: Gap remediation recommendations
    group("Gap remediation recommendations", () => {
      const org = data.orgs[0];

      const response = retryRequest(
        "POST",
        `/api/app/assurance/engagements/${org.orgId}/remediation-plan`,
        JSON.stringify({
          orgId: org.orgId,
          gaps: [
            {
              id: "gap-1",
              type: "missing_datapoint",
              severity: "high",
            },
            {
              id: "gap-2",
              type: "insufficient_evidence",
              severity: "medium",
            },
          ],
        }),
        2,
        {
          headers: getAuthHeaders(),
          params: {
            timeout: "15000ms",
            tags: { name: "gaps_remediation" },
          },
        },
      );

      checkResponse(response, "Gap remediation recommendations", {
        "status is 200": (r) => r.status === 200,
        "has remediation plan": (r) => {
          try {
            const body = r.json();
            return (
              body.plan &&
              Array.isArray(body.plan.actions) &&
              body.plan.actions.length > 0
            );
          } catch {
            return false;
          }
        },
        "includes timeline": (r) => {
          try {
            const body = r.json();
            return body.plan.timeline !== undefined;
          } catch {
            return false;
          }
        },
      });
    });

    sleep(0.1);

    // Test 6: Engagement progress tracking
    group("Engagement progress tracking", () => {
      const org = data.orgs[Math.floor(Math.random() * data.orgs.length)];

      const response = retryRequest(
        "GET",
        `/api/app/assurance/engagements/${org.orgId}/progress`,
        null,
        2,
        {
          headers: getAuthHeaders(),
          params: {
            timeout: "5000ms",
            tags: { name: "gaps_progress" },
          },
        },
      );

      checkResponse(response, "Engagement progress tracking", {
        "status is 200": (r) => r.status === 200,
        "has progress metrics": (r) => {
          try {
            const body = r.json();
            return body.progress !== undefined && body.completionPercentage !== undefined;
          } catch {
            return false;
          }
        },
      });
    });

    sleep(0.1);

    // Test 7: Gap analytics and reporting
    group("Gap analytics and reporting", () => {
      const response = retryRequest(
        "POST",
        "/api/app/assurance/data-gaps/analytics",
        JSON.stringify({
          orgIds: data.orgIds.slice(0, 100),
          framework: "csrd",
          period: "2024",
        }),
        2,
        {
          headers: getAuthHeaders(),
          params: {
            timeout: "30000ms",
            tags: { name: "gaps_analytics" },
          },
        },
      );

      checkResponse(response, "Gap analytics and reporting", {
        "status is 200": (r) => r.status === 200,
        "has statistics": (r) => {
          try {
            const body = r.json();
            return (
              body.statistics &&
              body.statistics.totalGaps !== undefined &&
              body.statistics.avgSeverity !== undefined
            );
          } catch {
            return false;
          }
        },
        "includes trends": (r) => {
          try {
            const body = r.json();
            return body.trends && Array.isArray(body.trends);
          } catch {
            return false;
          }
        },
      });
    });

    sleep(0.1);

    // Test 8: Gap export and audit trail
    group("Gap export and audit trail", () => {
      const org = data.orgs[0];

      const response = retryRequest(
        "POST",
        `/api/app/assurance/engagements/${org.orgId}/export-gaps`,
        JSON.stringify({
          format: "csv",
          includeRecommendations: true,
        }),
        2,
        {
          headers: getAuthHeaders(),
          params: {
            timeout: "10000ms",
            tags: { name: "gaps_export" },
          },
        },
      );

      checkResponse(response, "Gap export and audit trail", {
        "status is 200": (r) => r.status === 200,
        "export has content": (r) => r.body && r.body.length > 0,
      });
    });

    sleep(0.2);

    // Test 9: Concurrent gap detection (stress test)
    group("Concurrent gap detection stress", () => {
      const startTime = Date.now();
      const concurrentOps = Math.min(20, gapsConfig.concurrency);
      const results = [];

      for (let i = 0; i < concurrentOps; i++) {
        const org = data.orgs[i % data.orgs.length];
        const response = http.post(
          `${BASE_URL}/api/app/assurance/engagements/${org.orgId}/data-gaps`,
          JSON.stringify({ framework: "csrd" }),
          {
            headers: getAuthHeaders(),
            tags: { name: "gaps_concurrent" },
          },
        );
        results.push(response.status);
      }

      const duration = trackDuration(startTime);
      const successCount = results.filter((s) => s === 200).length;

      check(
        { success: successCount, total: concurrentOps },
        {
          "concurrent ops mostly succeed": (r) => r.success / r.total >= 0.9,
          "handles concurrency well": () => duration < 30000,
        },
      );

      console.log(
        `${concurrentOps} concurrent gap detections: ${successCount} successful in ${duration}ms`,
      );
    });
  });

  sleep(1);
}

export function teardown(data) {
  console.log("Data Gaps Detection test completed");
  console.log(`Tested ${data.orgs.length} organizations`);
}
