# ClearESG Load Testing Suite

Production-grade load testing framework for the ClearESG dashboard using [k6](https://k6.io/).

## Overview

This suite tests five critical systems under various load conditions:

1. **API Ingestion** - Webhook processing and data ingestion
2. **Supplier Risk Scoring** - Risk calculation and batch processing
3. **Scenario Modeling** - Monte Carlo simulations
4. **Data Gap Detection** - Assurance and verification workflows
5. **CSV Import** - Bulk data operations

## Quick Start

### Prerequisites

- k6 >= 0.52.0
- Node.js >= 20.9.0

### Installation

```bash
# Install k6
# macOS
brew install k6

# Windows (using chocolatey)
choco install k6

# Or via npm
npm install -g k6

# Install load test dependencies
cd load-tests
npm install
```

### Running Tests

```bash
# Start dev server
npm run dev

# In another terminal, run tests

# Smoke test (quick validation)
npm run test:smoke

# Individual scenario tests
npm run test:api          # API Ingestion
npm run test:supplier     # Supplier Risk Scoring
npm run test:scenario     # Scenario Modeling
npm run test:data-gaps    # Data Gap Detection
npm run test:csv          # CSV Import

# All tests sequentially
npm run test:all

# Stress test (gradually increase load)
npm run test:stress
```

## Configuration

### Environment Variables

```bash
# API Configuration
BASE_URL=http://localhost:3000
ADMIN_TOKEN=your-test-token
ORG_ID=test-org-123
USER_ID=test-user-456

# Test Type (smoke, load, stress, spike)
TEST_TYPE=load

# Monitoring (optional)
INFLUXDB_ENABLED=false
INFLUXDB_URL=http://localhost:8086
INFLUXDB_DB=k6
SLACK_WEBHOOK=https://hooks.slack.com/...
EMAIL_ALERTS=alerts@example.com
```

### Scenario Configuration

All scenarios are configured in `config.js`:

- **Smoke Test**: 1 VU for 30s - quick validation
- **Load Test**: 100 VUs for 5m - standard performance testing
- **Stress Test**: Gradual ramp to 500 VUs over 2m
- **Spike Test**: Sudden spike to 1000 VUs for 30s

## Test Scenarios

### 1. API Ingestion (api-ingestion.k6.js)

Tests webhook processing with various payload sizes.

**Tests:**

- Small payload (1KB)
- Medium payload (10KB)
- Large payload (100KB)
- Rate limiting verification
- Concurrent webhook processing
- Error handling and retry mechanisms
- Payload validation

**Performance Targets:**

- p95 < 100ms, p99 < 300ms
- Handles 1000 req/min sustained
- 95%+ success rate under load

```bash
k6 run scenarios/api-ingestion.k6.js
k6 run --stage 30s:0 --stage 1m30s:100 --stage 20s:100 --stage 10s:0 scenarios/api-ingestion.k6.js # Stress test
```

### 2. Supplier Risk Scoring (supplier-risk.k6.js)

Tests supplier risk calculation at scale.

**Tests:**

- Single supplier risk calculation
- Batch risk calculation (50-100 suppliers)
- Large-scale recalculation (1000 suppliers)
- Risk score trending
- Emissions data retrieval
- Compliance status checking
- Risk categorization

**Performance Targets:**

- Single supplier < 1000ms
- 1000 suppliers in < 2 minutes (120s)
- Memory usage < 50MB
- 95%+ success rate

```bash
k6 run scenarios/supplier-risk.k6.js
```

### 3. Scenario Modeling (scenario-modeling.k6.js)

Tests Monte Carlo simulations and scenario analysis.

**Tests:**

- Single scenario simulation (100-1000 simulations)
- Concurrent multi-scenario simulations
- Large-scale simulation (1000+ simulations)
- Sensitivity analysis
- Scenario comparison
- Real-time streaming updates
- Model persistence and retrieval
- Export functionality

**Performance Targets:**

- 1000 simulations in < 5 seconds
- p95 < 500ms per request
- Concurrent users: 10
- 95%+ success rate

```bash
k6 run scenarios/scenario-modeling.k6.js
```

### 4. Data Gap Detection (data-gaps.k6.js)

Tests assurance and verification workflows.

**Tests:**

- Single organization gap detection
- Batch organization gap detection (50 orgs)
- Large-scale parallel detection (500 orgs)
- Gap severity classification
- Remediation recommendations
- Engagement progress tracking
- Gap analytics and reporting
- Export and audit trails
- Concurrent stress testing

**Performance Targets:**

- Per-org analysis < 100ms
- 500 orgs in < 100ms each (parallel)
- 95%+ success under concurrent load
- Graceful degradation

```bash
k6 run scenarios/data-gaps.k6.js
```

### 5. CSV Import (csv-import.k6.js)

Tests bulk data operations and import processing.

**Tests:**

- Small CSV (100 rows)
- Medium CSV (1000 rows)
- Large CSV (5000 rows)
- Concurrent imports (5 parallel)
- Progress tracking
- Data validation and error handling
- Data transformations
- Import resumption after failure
- Bulk import stress testing

**Performance Targets:**

- 100 rows < 5s
- 1000 rows < 15s
- 5000 rows < 30s
- 100% validation accuracy
- 95%+ success rate

```bash
k6 run scenarios/csv-import.k6.js
```

## Advanced Usage

### Custom Test Configuration

```bash
# Smoke test with custom VUs
BASE_URL=http://staging.example.com \
ADMIN_TOKEN=staging-token \
TEST_TYPE=smoke \
k6 run scenarios/api-ingestion.k6.js

# Stress test with monitoring
INFLUXDB_ENABLED=true \
SLACK_WEBHOOK=https://hooks.slack.com/... \
k6 run scenarios/supplier-risk.k6.js
```

### Test Results and Reporting

k6 generates detailed metrics:

```
http_req_duration: Response time (p95, p99, avg)
http_req_failed: Failed requests
http_reqs: Total requests
vus: Virtual users
vus_max: Peak VUs
```

### Local Monitoring with InfluxDB and Grafana

```bash
# Start InfluxDB and Grafana
docker-compose up -d

# Run test with monitoring
INFLUXDB_ENABLED=true k6 run scenarios/api-ingestion.k6.js

# View dashboards at http://localhost:3000
```

## Performance Benchmarks

### Expected Results

| Scenario                     | Metric   | Target | Actual |
| ---------------------------- | -------- | ------ | ------ |
| API Ingestion                | p95      | <100ms | TBD    |
| API Ingestion                | p99      | <300ms | TBD    |
| Supplier Risk (1000)         | Duration | <2min  | TBD    |
| Scenario Modeling (1000 sim) | Duration | <5s    | TBD    |
| Data Gaps (500 orgs)         | Per-org  | <100ms | TBD    |
| CSV Import (5000 rows)       | Duration | <30s   | TBD    |

## Troubleshooting

### High Response Times

```bash
# Check API server logs
docker logs your-api-container

# Run smoke test to isolate issue
npm run test:smoke

# Profile specific endpoint
k6 run -e BASE_URL=http://localhost:3000/api/app/specific-endpoint scenarios/api-ingestion.k6.js
```

### Connection Errors

```bash
# Verify API is running
curl http://localhost:3000/api/health

# Check network
ping localhost:3000

# Try different BASE_URL
BASE_URL=http://127.0.0.1:3000 npm run test:smoke
```

### Out of Memory

```bash
# Reduce VU count
k6 run --vus 50 scenarios/supplier-risk.k6.js

# Or reduce test duration
k6 run --duration 1m scenarios/supplier-risk.k6.js
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Load Tests

on: [push]

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run load tests
        run: |
          cd load-tests
          npm install
          npm run test:all
```

### Continuous Monitoring

Set up alerts for:

- p95 response time > 1000ms
- Error rate > 5%
- Failed requests > 100

## Best Practices

1. **Always run smoke tests first**: Validate endpoints work before full load testing
2. **Isolate scenarios**: Test one system at a time to identify bottlenecks
3. **Ramp up gradually**: Start with load test, progress to stress and spike
4. **Monitor infrastructure**: Watch CPU, memory, and database during tests
5. **Record baselines**: Document results to track performance over time
6. **Test in staging first**: Validate on non-production before production testing
7. **Use realistic data**: Generate test data matching production patterns

## Maintenance

### Adding New Test Scenarios

1. Create new file in `scenarios/` directory
2. Import common helpers from `utils/helpers.js`
3. Define test configuration in `config.js`
4. Add npm script to `package.json`
5. Update this README

### Updating Helpers

Common utilities in `utils/helpers.js`:

- `makeRequest()` - HTTP requests with retries
- `checkResponse()` - Response validation
- `generateSupplierId()` - Test data generation
- `validateEmissions()` - Business logic validation

### Version Updates

Keep k6 and dependencies updated:

```bash
npm update
npm audit fix
```

## Support

For issues, check:

1. [k6 Documentation](https://k6.io/docs/)
2. [Project Readme](/README.md)
3. Local logs: `docker logs [container]`

## License

Same as main project

---

**Last Updated**: 2026-07-30
**Framework Version**: 1.0.0
**k6 Version**: >= 0.52.0
