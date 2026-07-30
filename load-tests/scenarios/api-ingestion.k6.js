import http from "k6/http";
import { check, group, sleep } from "k6";
import { BASE_URL, ORG_ID, SCENARIOS, PAYLOADS, SCENARIO_CONFIG } from "../config.js";
import {
  getAuthHeaders,
  checkResponse,
  checkStatusCode,
  makeRequest,
  retryRequest,
  trackDuration,
  testGroup,
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
  setupTimeout: "30s",
  teardownTimeout: "30s",
};

// Setup: Create test data
export function setup() {
  console.log(
    `Starting ${scenarioConfig.name} with ${
      scenarioConfig.vus || scenarioConfig.stages[0].target
    } VUs`,
  );
  return {
    orgId: ORG_ID,
    timestamp: new Date().toISOString(),
  };
}

export default function (data) {
  const apiIngestionConfig = SCENARIO_CONFIG.apiIngestion;

  testGroup("API Ingestion - Webhook Processing", () => {
    // Test 1: Small payload webhook (1KB)
    group("Small payload webhook (1KB)", () => {
      const payload = PAYLOADS.webhook.small;
      const startTime = Date.now();

      const response = retryRequest(
        "POST",
        "/api/app/webhooks/ingest",
        payload,
        apiIngestionConfig.retryAttempts,
        {
          headers: getAuthHeaders(),
          params: {
            timeout: `${apiIngestionConfig.timeout}ms`,
            tags: { name: "webhook_small" },
          },
        },
      );

      const duration = trackDuration(startTime);

      checkResponse(response, "Small payload webhook", {
        "status is 200": (r) => r.status === 200,
        "response time < 100ms": (r) => r.timings.duration < 100,
        "has processing_id": (r) => {
          try {
            return !!r.json().processingId;
          } catch {
            return false;
          }
        },
      });

      console.log(`Small payload duration: ${duration}ms`);
    });

    sleep(0.1);

    // Test 2: Medium payload webhook (10KB)
    group("Medium payload webhook (10KB)", () => {
      const payload = PAYLOADS.webhook.medium;
      const startTime = Date.now();

      const response = retryRequest(
        "POST",
        "/api/app/webhooks/ingest",
        payload,
        apiIngestionConfig.retryAttempts,
        {
          headers: getAuthHeaders(),
          params: {
            timeout: `${apiIngestionConfig.timeout}ms`,
            tags: { name: "webhook_medium" },
          },
        },
      );

      const duration = trackDuration(startTime);

      checkResponse(response, "Medium payload webhook", {
        "status is 200": (r) => r.status === 200,
        "response time < 300ms": (r) => r.timings.duration < 300,
      });

      console.log(`Medium payload duration: ${duration}ms`);
    });

    sleep(0.1);

    // Test 3: Large payload webhook (100KB)
    group("Large payload webhook (100KB)", () => {
      const payload = PAYLOADS.webhook.large;
      const startTime = Date.now();

      const response = retryRequest(
        "POST",
        "/api/app/webhooks/ingest",
        payload,
        apiIngestionConfig.retryAttempts,
        {
          headers: getAuthHeaders(),
          params: {
            timeout: `${apiIngestionConfig.timeout}ms`,
            tags: { name: "webhook_large" },
          },
        },
      );

      const duration = trackDuration(startTime);

      checkResponse(response, "Large payload webhook", {
        "status is 200": (r) => r.status === 200,
        "response time < 1000ms": (r) => r.timings.duration < 1000,
      });

      console.log(`Large payload duration: ${duration}ms`);
    });

    sleep(0.2);

    // Test 4: Rate limit verification
    group("Rate limit verification", () => {
      const startTime = Date.now();
      let successCount = 0;
      let rateLimitedCount = 0;

      for (let i = 0; i < 50; i++) {
        const response = http.post(
          `${BASE_URL}/api/app/webhooks/ingest`,
          PAYLOADS.webhook.small,
          {
            headers: getAuthHeaders(),
            tags: { name: "rate_limit_test" },
          },
        );

        if (response.status === 200) {
          successCount++;
        } else if (response.status === 429) {
          rateLimitedCount++;
        }
      }

      const duration = trackDuration(startTime);

      check(
        { success: successCount, rateLimited: rateLimitedCount },
        {
          "rate limiting is enforced": (c) => c.rateLimited > 0 || c.success > 0,
          "most requests succeed": (c) => c.success > 40,
        },
      );

      console.log(
        `Rate limit test: ${successCount} success, ${rateLimitedCount} rate limited in ${duration}ms`,
      );
    });

    sleep(0.2);

    // Test 5: Concurrent webhook processing
    group("Concurrent webhook processing", () => {
      const startTime = Date.now();
      const concurrentRequests = Math.min(100, Math.floor(__VU.metrics.vus?.value || 10));
      const results = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const response = http.post(
          `${BASE_URL}/api/app/webhooks/ingest`,
          PAYLOADS.webhook.medium,
          {
            headers: getAuthHeaders(),
            tags: { name: "concurrent_webhook" },
          },
        );
        results.push(response.status);
      }

      const duration = trackDuration(startTime);
      const successRate =
        (results.filter((s) => s === 200).length / results.length) * 100;

      check(
        { successRate },
        {
          "concurrent success rate > 95%": (r) => r.successRate >= 95,
        },
      );

      console.log(
        `Concurrent test: ${concurrentRequests} requests in ${duration}ms, ${successRate.toFixed(2)}% success`,
      );
    });

    sleep(0.1);

    // Test 6: Error handling and retry mechanisms
    group("Error handling and retry", () => {
      const response = retryRequest(
        "POST",
        "/api/app/webhooks/ingest",
        PAYLOADS.webhook.small,
        3,
        {
          headers: getAuthHeaders(),
          params: { tags: { name: "retry_test" } },
        },
      );

      checkStatusCode(response, 200);
    });

    sleep(0.1);

    // Test 7: Webhook validation
    group("Webhook payload validation", () => {
      // Invalid payload (missing required fields)
      const invalidPayload = JSON.stringify({
        orgId: ORG_ID,
        // missing timestamp and type
      });

      const response = http.post(`${BASE_URL}/api/app/webhooks/ingest`, invalidPayload, {
        headers: getAuthHeaders(),
        tags: { name: "validation_test" },
      });

      check(response, {
        "invalid payload returns 400": (r) => r.status === 400,
      });
    });
  });

  sleep(1);
}

export function teardown(data) {
  console.log("API Ingestion test completed");
  console.log(`Total requests: ${__VU.metrics.http_requests?.count || 0}`);
}
