import http from "k6/http";
import { check, group, sleep } from "k6";
import FormData from "k6/http/form_data";
import { BASE_URL, ORG_ID, SCENARIOS, SCENARIO_CONFIG } from "../config.js";
import {
  getAuthHeaders,
  getMultipartHeaders,
  checkResponse,
  generateCSVData,
  parseCSV,
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
  setupTimeout: "30s",
  teardownTimeout: "30s",
};

// Setup: Generate CSV data
export function setup() {
  console.log(
    `Starting CSV Import test with ${
      scenarioConfig.vus || scenarioConfig.stages[0].target
    } VUs`,
  );

  const csvConfig = SCENARIO_CONFIG.csvImport;
  console.log(`Generating ${csvConfig.rowCount} rows of CSV data`);

  const csvData = generateCSVData(csvConfig.rowCount);

  return {
    csvData,
    rowCount: csvConfig.rowCount,
  };
}

export default function (data) {
  const csvConfig = SCENARIO_CONFIG.csvImport;

  testGroup("CSV Import - Bulk Data Operations", () => {
    // Test 1: Single CSV file import (small batch)
    group("Small CSV import (100 rows)", () => {
      const smallCSV = generateCSVData(100);
      const startTime = Date.now();

      const formData = new FormData();
      formData.append("file", http.file(smallCSV, "small.csv", "text/csv"));
      formData.append("orgId", ORG_ID);
      formData.append("type", "suppliers");

      const response = retryRequest("POST", "/api/app/data/import", formData, 2, {
        headers: getMultipartHeaders(),
        params: {
          timeout: "30000ms",
          tags: { name: "csv_small" },
        },
      });

      const duration = trackDuration(startTime);

      checkResponse(response, "Small CSV import", {
        "status is 200": (r) => r.status === 200,
        "completes quickly": (r) => r.timings.duration < 5000,
        "has import ID": (r) => {
          try {
            const body = r.json();
            return !!body.importId;
          } catch {
            return false;
          }
        },
      });

      console.log(`Small CSV import (100 rows) took ${duration}ms`);
    });

    sleep(0.1);

    // Test 2: Medium CSV import (1000 rows)
    group("Medium CSV import (1000 rows)", () => {
      const mediumCSV = generateCSVData(1000);
      const startTime = Date.now();

      const formData = new FormData();
      formData.append("file", http.file(mediumCSV, "medium.csv", "text/csv"));
      formData.append("orgId", ORG_ID);
      formData.append("type", "suppliers");
      formData.append("validate", "true");

      const response = retryRequest("POST", "/api/app/data/import", formData, 2, {
        headers: getMultipartHeaders(),
        params: {
          timeout: "60000ms",
          tags: { name: "csv_medium" },
        },
      });

      const duration = trackDuration(startTime);

      checkResponse(response, "Medium CSV import", {
        "status is 200": (r) => r.status === 200,
        "completes within target": (r) => r.timings.duration < csvConfig.duration / 2,
        "has row count": (r) => {
          try {
            const body = r.json();
            return body.processedRows !== undefined;
          } catch {
            return false;
          }
        },
      });

      if (response.status === 200) {
        try {
          const body = response.json();
          check(body, {
            "all rows processed": (b) => b.processedRows === 1000,
            "no validation errors": (b) => b.errors?.length === 0,
          });
        } catch (e) {
          console.log(`Failed to parse import response: ${e}`);
        }
      }

      console.log(`Medium CSV import (1000 rows) took ${duration}ms`);
    });

    sleep(0.2);

    // Test 3: Large CSV import (5000 rows) - Performance target test
    group("Large CSV import (5000 rows)", () => {
      const largeCSV = data.csvData;
      const startTime = Date.now();

      const formData = new FormData();
      formData.append("file", http.file(largeCSV, "large.csv", "text/csv"));
      formData.append("orgId", ORG_ID);
      formData.append("type", "suppliers");
      formData.append("validate", "true");
      formData.append("detectDuplicates", "true");

      const response = retryRequest("POST", "/api/app/data/import", formData, 1, {
        headers: getMultipartHeaders(),
        params: {
          timeout: "120000ms",
          tags: { name: "csv_large" },
        },
      });

      const duration = trackDuration(startTime);

      check(
        { duration, expected: csvConfig.duration },
        {
          "large CSV import succeeds": () => response.status === 200,
          "completes within target time": (d) => d.duration <= d.expected + 5000,
          "performance meets requirements": (d) =>
            d.duration < csvConfig.duration + 10000,
        },
      );

      if (response.status === 200) {
        try {
          const body = response.json();
          check(body, {
            "correct row count": (b) => b.processedRows === data.rowCount,
            "validation accuracy": (b) => b.validationResults.accuracy === 1.0,
            "no critical errors": (b) =>
              !body.errors?.some((e) => e.severity === "critical"),
          });
        } catch (e) {
          console.log(`Failed to parse large import response: ${e}`);
        }
      }

      console.log(
        `Large CSV import (${data.rowCount} rows) took ${duration}ms (target: ${csvConfig.duration}ms)`,
      );
    });

    sleep(0.3);

    // Test 4: Concurrent CSV imports
    group("Concurrent CSV imports", () => {
      const startTime = Date.now();
      const concurrentCount = 5;
      const results = [];

      for (let i = 0; i < concurrentCount; i++) {
        const csv = generateCSVData(500);
        const formData = new FormData();
        formData.append("file", http.file(csv, `import-${i}.csv`, "text/csv"));
        formData.append("orgId", ORG_ID);
        formData.append("type", "suppliers");

        const response = http.post(`${BASE_URL}/api/app/data/import`, formData, {
          headers: getMultipartHeaders(),
          tags: { name: "csv_concurrent" },
        });

        results.push(response.status);
      }

      const duration = trackDuration(startTime);
      const successCount = results.filter((s) => s === 200).length;

      check(
        { success: successCount, total: concurrentCount },
        {
          "concurrent imports mostly succeed": (r) => r.success / r.total >= 0.8,
          "reasonable total duration": () => duration < 60000,
        },
      );

      console.log(
        `${concurrentCount} concurrent imports: ${successCount} successful in ${duration}ms`,
      );
    });

    sleep(0.2);

    // Test 5: Import progress tracking
    group("Import progress tracking", () => {
      const csv = generateCSVData(1000);
      const formData = new FormData();
      formData.append("file", http.file(csv, "progress-test.csv", "text/csv"));
      formData.append("orgId", ORG_ID);
      formData.append("type", "suppliers");

      const response = http.post(`${BASE_URL}/api/app/data/import`, formData, {
        headers: getMultipartHeaders(),
        tags: { name: "csv_progress" },
      });

      if (response.status === 200) {
        try {
          const body = response.json();
          const importId = body.importId;

          // Poll for progress
          sleep(0.5);

          const progressResponse = http.get(
            `${BASE_URL}/api/app/data/import/${importId}/progress`,
            {
              headers: getAuthHeaders(),
              tags: { name: "csv_progress_poll" },
            },
          );

          check(progressResponse, {
            "progress endpoint works": (r) => r.status === 200,
            "has progress data": (r) => {
              try {
                const p = r.json();
                return (
                  p.processed !== undefined &&
                  p.total !== undefined &&
                  p.percentage !== undefined
                );
              } catch {
                return false;
              }
            },
          });
        } catch (e) {
          console.log(`Failed to track import progress: ${e}`);
        }
      }
    });

    sleep(0.1);

    // Test 6: Data validation and error handling
    group("Data validation during import", () => {
      // CSV with invalid data
      const invalidCSV = `supplier_id,emissions_scope1,emissions_scope2,emissions_scope3,year
sup-1,INVALID,100,200,2024
sup-2,1000,INVALID,300,2024
sup-3,2000,3000,INVALID,2024
sup-4,2500,4000,5000,INVALID_YEAR`;

      const formData = new FormData();
      formData.append("file", http.file(invalidCSV, "invalid.csv", "text/csv"));
      formData.append("orgId", ORG_ID);
      formData.append("type", "suppliers");
      formData.append("validate", "true");
      formData.append("strictValidation", "false");

      const response = http.post(`${BASE_URL}/api/app/data/import`, formData, {
        headers: getMultipartHeaders(),
        tags: { name: "csv_validation" },
      });

      check(response, {
        "validation handles errors gracefully": (r) =>
          r.status === 200 || r.status === 400,
        "returns error details": (r) => {
          try {
            const body = r.json();
            return body.errors && Array.isArray(body.errors);
          } catch {
            return false;
          }
        },
      });
    });

    sleep(0.1);

    // Test 7: Import with transformations
    group("Import with data transformations", () => {
      const csv = generateCSVData(500);

      const formData = new FormData();
      formData.append("file", http.file(csv, "transform.csv", "text/csv"));
      formData.append("orgId", ORG_ID);
      formData.append("type", "suppliers");
      formData.append(
        "transformations",
        JSON.stringify([
          {
            field: "emissions_scope1",
            transform: "multiply",
            value: 1.05,
          },
        ]),
      );

      const response = retryRequest("POST", "/api/app/data/import", formData, 2, {
        headers: getMultipartHeaders(),
        params: { timeout: "30000ms" },
      });

      checkResponse(response, "Import with transformations", {
        "status is 200": (r) => r.status === 200,
        "transformations applied": (r) => {
          try {
            const body = r.json();
            return body.transformationsApplied === true;
          } catch {
            return false;
          }
        },
      });
    });

    sleep(0.1);

    // Test 8: Import retry and resumption
    group("Import resumption after failure", () => {
      const csv = generateCSVData(2000);

      const formData = new FormData();
      formData.append("file", http.file(csv, "resumable.csv", "text/csv"));
      formData.append("orgId", ORG_ID);
      formData.append("type", "suppliers");
      formData.append("resumable", "true");

      const response = http.post(`${BASE_URL}/api/app/data/import`, formData, {
        headers: getMultipartHeaders(),
        tags: { name: "csv_resumable" },
      });

      if (response.status === 200) {
        try {
          const body = response.json();
          const importId = body.importId;

          check(body, {
            "resumable import created": (b) => !!b.resumeToken,
            "can be resumed": (b) => b.resumable === true,
          });

          // Simulate resumption
          sleep(0.2);

          const resumeResponse = http.post(
            `${BASE_URL}/api/app/data/import/${importId}/resume`,
            JSON.stringify({
              resumeToken: body.resumeToken,
            }),
            {
              headers: getAuthHeaders(),
              tags: { name: "csv_resume" },
            },
          );

          check(resumeResponse, {
            "resume operation works": (r) => r.status === 200 || r.status === 202,
          });
        } catch (e) {
          console.log(`Failed to test import resumption: ${e}`);
        }
      }
    });

    sleep(0.1);

    // Test 9: Bulk import performance under load
    group("Bulk import stress test", () => {
      const startTime = Date.now();
      const batchCount = 3;
      const successCount = { value: 0 };

      for (let batch = 0; batch < batchCount; batch++) {
        const csv = generateCSVData(1000);
        const formData = new FormData();
        formData.append("file", http.file(csv, `batch-${batch}.csv`, "text/csv"));
        formData.append("orgId", ORG_ID);
        formData.append("type", "suppliers");

        const response = http.post(`${BASE_URL}/api/app/data/import`, formData, {
          headers: getMultipartHeaders(),
          tags: { name: "csv_stress" },
        });

        if (response.status === 200) {
          successCount.value++;
        }
      }

      const duration = trackDuration(startTime);

      check(
        { success: successCount.value, total: batchCount },
        {
          "bulk imports succeed": (r) => r.success >= Math.ceil(r.total * 0.8),
          "reasonable throughput": () => duration < 120000,
        },
      );

      console.log(
        `Bulk import stress: ${successCount.value}/${batchCount} succeeded in ${duration}ms`,
      );
    });
  });

  sleep(1);
}

export function teardown(data) {
  console.log("CSV Import test completed");
  console.log(`Total data processed: ${data.rowCount} rows`);
}
