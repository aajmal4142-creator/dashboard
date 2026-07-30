import http from "k6/http";
import { check, group } from "k6";
import { BASE_URL, ADMIN_TOKEN, ORG_ID } from "../config.js";

// Authentication helpers
export function getAuthHeaders() {
  return {
    Authorization: `Bearer ${ADMIN_TOKEN}`,
    "Content-Type": "application/json",
  };
}

export function getMultipartHeaders() {
  return {
    Authorization: `Bearer ${ADMIN_TOKEN}`,
  };
}

// Request helpers
export function makeRequest(method, path, payload, options = {}) {
  const url = `${BASE_URL}${path}`;
  const params = {
    headers: options.headers || getAuthHeaders(),
    timeout: options.timeout || "10s",
    ...options.params,
  };

  let response;
  switch (method.toUpperCase()) {
    case "GET":
      response = http.get(url, params);
      break;
    case "POST":
      response = http.post(url, payload, params);
      break;
    case "PUT":
      response = http.put(url, payload, params);
      break;
    case "DELETE":
      response = http.del(url, params);
      break;
    case "PATCH":
      response = http.patch(url, payload, params);
      break;
    default:
      throw new Error(`Unsupported HTTP method: ${method}`);
  }

  return response;
}

// Check and assertion helpers
export function checkResponse(response, name, checks = {}) {
  const defaultChecks = {
    "status is 2xx": (r) => r.status >= 200 && r.status < 300,
    "response time < 1s": (r) => r.timings.duration < 1000,
  };

  const allChecks = { ...defaultChecks, ...checks };
  return check(response, allChecks, {
    name,
    url: response.url,
    status: response.status,
  });
}

export function checkStatusCode(response, expectedStatus = 200) {
  return check(response, {
    [`status is ${expectedStatus}`]: (r) => r.status === expectedStatus,
  });
}

export function checkJsonResponse(response) {
  try {
    const json = response.json();
    return check(response, {
      "response is valid JSON": () => true,
      "response has data": () => !!json,
    });
  } catch {
    check(response, {
      "response is valid JSON": () => false,
    });
    return false;
  }
}

// Data generation helpers
export function generateSupplierId() {
  return `sup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateDatapointId() {
  return `dp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateOrgId() {
  return `org-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateBatchSuppliers(count) {
  const industries = [
    "Manufacturing",
    "Transportation",
    "Energy",
    "Construction",
    "Technology",
  ];
  const countries = ["US", "UK", "DE", "FR", "JP", "CN", "IN"];

  return Array.from({ length: count }, (_, i) => ({
    id: generateSupplierId(),
    name: `Supplier ${i} - ${Date.now()}`,
    industry: industries[i % industries.length],
    country: countries[i % countries.length],
    emissionsScope1: Math.random() * 10000,
    emissionsScope2: Math.random() * 20000,
    emissionsScope3: Math.random() * 50000,
    riskScore: Math.random() * 100,
    complianceStatus: ["compliant", "non_compliant", "pending"][i % 3],
    certifications: ["ISO14001", "B-Corp", "Carbon-Trust"][i % 3],
  }));
}

export function generateScenario(simulationCount) {
  return {
    scenarioId: `scn-${Date.now()}`,
    type: "monte_carlo",
    parameters: {
      baselineEmissions: Math.random() * 100000,
      reductionTarget: Math.random() * 50,
      timeframe: [2025, 2030, 2035][Math.floor(Math.random() * 3)],
      confidence: 0.95,
    },
    simulations: simulationCount,
    constraints: {
      maxCost: Math.random() * 1000000,
      minROI: Math.random() * 5,
      availableTime: [6, 12, 24, 36][Math.floor(Math.random() * 4)],
    },
  };
}

export function generateCSVData(rowCount) {
  const headers = [
    "supplier_id",
    "emissions_scope1",
    "emissions_scope2",
    "emissions_scope3",
    "year",
  ];
  const rows = [headers];

  for (let i = 0; i < rowCount; i++) {
    rows.push([
      generateSupplierId(),
      Math.floor(Math.random() * 10000),
      Math.floor(Math.random() * 20000),
      Math.floor(Math.random() * 50000),
      2024,
    ]);
  }

  return rows.map((row) => row.join(",")).join("\n");
}

export function generateOrgData() {
  return {
    orgId: generateOrgId(),
    name: `Test Org ${Date.now()}`,
    industry: "Manufacturing",
    country: "US",
    employees: Math.floor(Math.random() * 10000),
    annualRevenue: Math.random() * 1000000000,
    sustainability: {
      scienceBasedTargets: Math.random() > 0.5,
      netZeroCommitment: Math.random() > 0.5,
      circularEconomyProgram: Math.random() > 0.5,
    },
  };
}

// Validation helpers
export function validateSupplierRiskScore(score) {
  return check(score, {
    "risk score is between 0-100": (s) => s >= 0 && s <= 100,
    "risk score is a number": (s) => typeof s === "number",
  });
}

export function validateEmissions(emissions) {
  return check(emissions, {
    "scope1 is present": (e) => e.scope1 !== undefined,
    "scope2 is present": (e) => e.scope2 !== undefined,
    "scope3 is present": (e) => e.scope3 !== undefined,
    "all scopes are numbers": (e) =>
      typeof e.scope1 === "number" &&
      typeof e.scope2 === "number" &&
      typeof e.scope3 === "number",
    "all scopes are non-negative": (e) => e.scope1 >= 0 && e.scope2 >= 0 && e.scope3 >= 0,
  });
}

export function validateDataGap(gap) {
  return check(gap, {
    "gap has id": (g) => !!g.id,
    "gap has type": (g) => !!g.type,
    "gap has severity": (g) => ["low", "medium", "high"].includes(g.severity),
    "gap has description": (g) => !!g.description,
  });
}

// Error handling and retry logic
export function retryRequest(method, path, payload, maxRetries = 3, options = {}) {
  let lastResponse;
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      lastResponse = makeRequest(method, path, payload, options);

      if (lastResponse.status >= 200 && lastResponse.status < 300) {
        return lastResponse;
      }

      if (lastResponse.status >= 500 || lastResponse.status === 429) {
        const backoff = Math.pow(2, attempt) * 1000;
        __VU.metrics.custom.retries.add(1);
        console.log(
          `Retry attempt ${attempt + 1}/${maxRetries} for ${path}, backing off ${backoff}ms`,
        );
      } else {
        break;
      }
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const backoff = Math.pow(2, attempt) * 1000;
        console.log(`Request failed: ${error}, retrying after ${backoff}ms`);
      }
    }
  }

  return lastResponse || { status: 0, body: null };
}

// Rate limiting simulation
export function simulateRateLimit(requestCount, limitPerHour = 1000) {
  const requestsPerSecond = limitPerHour / 3600;
  const expectedDurationSeconds = requestCount / requestsPerSecond;
  return expectedDurationSeconds;
}

// Metric helpers
export function recordMetric(name, value, tags = {}) {
  if (!__VU.metrics.custom) {
    __VU.metrics.custom = {};
  }
  __VU.metrics.custom[name] = value;
}

export function trackDuration(startTime) {
  return Date.now() - startTime;
}

export function calculatePercentile(values, percentile) {
  const sorted = values.sort((a, b) => a - b);
  const index = Math.ceil((sorted.length * percentile) / 100) - 1;
  return sorted[Math.max(0, index)];
}

// Grouping and organization
export function testGroup(name, fn) {
  group(name, fn);
}

// CSV parsing (for validation)
export function parseCSV(csvContent) {
  const lines = csvContent.split("\n").filter((line) => line.trim());
  const headers = lines[0].split(",");
  const rows = lines.slice(1).map((line) => {
    const values = line.split(",");
    return headers.reduce((obj, header, index) => {
      obj[header] = values[index];
      return obj;
    }, {});
  });
  return { headers, rows };
}

export default {
  getAuthHeaders,
  getMultipartHeaders,
  makeRequest,
  checkResponse,
  checkStatusCode,
  checkJsonResponse,
  generateSupplierId,
  generateDatapointId,
  generateOrgId,
  generateBatchSuppliers,
  generateScenario,
  generateCSVData,
  generateOrgData,
  validateSupplierRiskScore,
  validateEmissions,
  validateDataGap,
  retryRequest,
  simulateRateLimit,
  recordMetric,
  trackDuration,
  calculatePercentile,
  testGroup,
  parseCSV,
};
