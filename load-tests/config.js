export const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
export const ADMIN_TOKEN = __ENV.ADMIN_TOKEN || "test-token";
export const ORG_ID = __ENV.ORG_ID || "test-org-123";
export const USER_ID = __ENV.USER_ID || "test-user-456";

// Scenario configuration
export const SCENARIOS = {
  smoke: {
    name: "Smoke Test",
    vus: 1,
    duration: "30s",
    thresholds: {
      http_req_duration: ["p(95)<500", "p(99)<1000"],
      http_req_failed: ["rate<0.1"],
    },
  },
  load: {
    name: "Load Test",
    vus: 100,
    duration: "5m",
    thresholds: {
      http_req_duration: ["p(95)<1000", "p(99)<2000"],
      http_req_failed: ["rate<0.05"],
    },
  },
  stress: {
    name: "Stress Test",
    stages: [
      { duration: "30s", target: 0 },
      { duration: "1m30s", target: 500 },
      { duration: "20s", target: 500 },
      { duration: "10s", target: 0 },
    ],
    thresholds: {
      http_req_duration: ["p(95)<2000", "p(99)<5000"],
      http_req_failed: ["rate<0.1"],
    },
  },
  spike: {
    name: "Spike Test",
    stages: [
      { duration: "1m", target: 10 },
      { duration: "5s", target: 1000 },
      { duration: "30s", target: 1000 },
      { duration: "5s", target: 10 },
      { duration: "1m", target: 0 },
    ],
    thresholds: {
      http_req_duration: ["p(95)<3000"],
      http_req_failed: ["rate<0.15"],
    },
  },
};

// API rate limiting
export const RATE_LIMITS = {
  webhookPerOrg: 1000, // req/hr
  apiPerUser: 10000, // req/day
  csvImportRows: 5000,
  riskCalcBatchSize: 100,
  scenarioSimulations: 1000,
};

// Performance targets
export const TARGETS = {
  apiWebhook: {
    p95: 100, // ms
    p99: 300, // ms
  },
  supplierRisk: {
    duration: 120000, // 2 min for 1000 suppliers
    memory: 50, // MB
  },
  scenarioModeling: {
    duration: 5000, // 5s for 1000 simulations
    p95: 500, // ms per request
  },
  dataGaps: {
    perOrg: 100, // ms per org
    concurrent: 500,
  },
  csvImport: {
    duration: 30000, // 30s for 5000 rows
    validationAccuracy: 1.0, // 100%
  },
};

// Payload configurations for different test scenarios
export const PAYLOADS = {
  webhook: {
    small: JSON.stringify({
      orgId: ORG_ID,
      timestamp: new Date().toISOString(),
      type: "emission_data",
      data: {
        source: "scope1",
        value: 1500,
        unit: "tCO2e",
      },
    }),
    medium: JSON.stringify({
      orgId: ORG_ID,
      timestamp: new Date().toISOString(),
      type: "supplier_emissions",
      data: {
        supplierId: `sup-${Math.random()}`,
        scope1: 2500,
        scope2: 5000,
        scope3: 15000,
        categories: [3, 4, 5],
        sources: ["manufacturing", "transportation"],
        confidence: 0.85,
      },
    }),
    large: JSON.stringify({
      orgId: ORG_ID,
      timestamp: new Date().toISOString(),
      type: "detailed_emissions_report",
      data: {
        reportId: `rep-${Math.random()}`,
        period: "2024-Q1",
        facilities: Array.from({ length: 50 }, (_, i) => ({
          id: `fac-${i}`,
          scope1: Math.random() * 5000,
          scope2: Math.random() * 8000,
          activities: Array.from({ length: 20 }, (_, j) => ({
            id: `act-${j}`,
            source: ["electricity", "gas", "transportation"][j % 3],
            value: Math.random() * 1000,
          })),
        })),
      },
    }),
  },
  supplier: {
    batch: Array.from({ length: 100 }, (_, i) => ({
      id: `sup-${i}`,
      name: `Supplier ${i}`,
      industry: ["Manufacturing", "Transportation", "Energy"][i % 3],
      scope1: Math.random() * 10000,
      scope2: Math.random() * 20000,
      scope3: Math.random() * 50000,
      riskFactors: [Math.random(), Math.random(), Math.random()],
    })),
  },
};

// Monitoring configuration
export const MONITORING = {
  influxdb: {
    enabled: __ENV.INFLUXDB_ENABLED === "true",
    url: __ENV.INFLUXDB_URL || "http://localhost:8086",
    database: __ENV.INFLUXDB_DB || "k6",
    username: __ENV.INFLUXDB_USER,
    password: __ENV.INFLUXDB_PASS,
  },
  alerts: {
    slackWebhook: __ENV.SLACK_WEBHOOK,
    emailAlerts: __ENV.EMAIL_ALERTS,
  },
};

// Test scenarios configuration
export const SCENARIO_CONFIG = {
  apiIngestion: {
    concurrentWebhooks: 1000,
    payloadSizes: ["small", "medium", "large"],
    retryAttempts: 3,
    retryBackoff: 1000, // ms
    timeout: 10000, // ms
  },
  supplierRisk: {
    supplierCount: 1000,
    batchSize: 100,
    timeout: 180000, // 3 min
    expectedDuration: 120000, // 2 min
  },
  scenarioModeling: {
    simulations: 1000,
    concurrentUsers: 10,
    timeout: 10000,
    expectedDuration: 5000,
  },
  dataGaps: {
    orgCount: 500,
    concurrency: 50,
    timeout: 5000,
    expectedPerOrg: 100,
  },
  csvImport: {
    rowCount: 5000,
    batchSize: 100,
    validationEnabled: true,
    timeout: 60000,
    expectedDuration: 30000,
  },
};

export default {
  BASE_URL,
  ADMIN_TOKEN,
  ORG_ID,
  USER_ID,
  SCENARIOS,
  RATE_LIMITS,
  TARGETS,
  PAYLOADS,
  MONITORING,
  SCENARIO_CONFIG,
};
