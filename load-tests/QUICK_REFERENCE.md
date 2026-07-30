# Load Testing - Quick Reference

## 30-Second Setup

```bash
cd load-tests
npm install
npm run test:smoke
```

## Commands

| Command                  | Purpose            | Duration |
| ------------------------ | ------------------ | -------- |
| `npm run test:smoke`     | Quick validation   | 2 min    |
| `npm run test:api`       | API ingestion      | 8 min    |
| `npm run test:supplier`  | Supplier risk      | 8 min    |
| `npm run test:scenario`  | Scenario modeling  | 8 min    |
| `npm run test:data-gaps` | Data gap detection | 8 min    |
| `npm run test:csv`       | CSV import         | 8 min    |
| `npm run test:all`       | All tests          | 45 min   |
| `npm run test:stress`    | Stress test        | 5 min    |

## Environment Setup

```bash
# Copy template
cp .env.example .env

# Edit with your values
BASE_URL=http://localhost:3000
ADMIN_TOKEN=your-token
ORG_ID=test-org
USER_ID=test-user
```

## Run with Custom Settings

```bash
# Custom URL
BASE_URL=http://staging.example.com npm run test:api

# Smoke test
SMOKE=true npm run test:api

# With monitoring
INFLUXDB_ENABLED=true npm run test:all
```

## Monitoring (Optional)

```bash
# Start stack
docker-compose up -d

# Access dashboards
# Grafana: http://localhost:3000 (admin/admin)
# InfluxDB: http://localhost:8086

# Stop stack
docker-compose down
```

## Performance Targets

| System               | Metric   | Target |
| -------------------- | -------- | ------ |
| API Ingestion        | p95      | <100ms |
| API Ingestion        | p99      | <300ms |
| Supplier Risk (1k)   | Duration | <2 min |
| Scenario (1k sim)    | Duration | <5s    |
| Data Gaps (500 orgs) | Per-org  | <100ms |
| CSV Import (5k rows) | Duration | <30s   |

## File Structure

```
load-tests/
├── config.js              # Test configuration
├── utils/helpers.js       # Shared utilities
├── scenarios/
│   ├── api-ingestion.k6.js
│   ├── supplier-risk.k6.js
│   ├── scenario-modeling.k6.js
│   ├── data-gaps.k6.js
│   └── csv-import.k6.js
├── package.json
├── README.md
└── docker-compose.yml
```

## Test Scenarios Explained

### API Ingestion

- Tests webhook processing
- Multiple payload sizes (1KB, 10KB, 100KB)
- Rate limiting verification
- 100 concurrent VUs

### Supplier Risk

- Tests risk calculation
- Single to 1000 suppliers
- Batch processing
- Compliance checking

### Scenario Modeling

- Tests Monte Carlo simulations
- 1000+ simulations
- 10 concurrent users
- Sensitivity analysis

### Data Gaps

- Tests assurance workflows
- 500 organizations in parallel
- Gap detection & classification
- Remediation planning

### CSV Import

- Tests bulk data operations
- 100 to 5000 rows
- 5 concurrent imports
- Data validation & transformation

## Interpreting Results

### Good Signs ✅

- Green checkmarks on all checks
- p95 < thresholds
- Success rate > 95%
- No critical errors

### Warning Signs ⚠️

- Red X's on checks
- p95 > thresholds
- Success rate < 90%
- Timeouts or connection errors

### Critical Issues ❌

- Crashes or panics
- Success rate < 50%
- p99 > 5000ms
- Memory exhaustion

## Debugging

```bash
# Verbose output
k6 run -v scenarios/api-ingestion.k6.js

# Custom metrics
k6 run --summary-export=results.json scenarios/api-ingestion.k6.js

# Check API health
curl http://localhost:3000/api/health

# View logs
docker logs your-app-container
```

## Common Issues

| Issue                 | Solution                               |
| --------------------- | -------------------------------------- |
| Connection refused    | Check BASE_URL, ensure API is running  |
| 401 Unauthorized      | Verify ADMIN_TOKEN                     |
| Timeouts              | API too slow, check server performance |
| 429 Too Many Requests | Rate limiting kicking in, reduce VUs   |
| Memory issues         | Reduce payload sizes or VU count       |

## Integration

### GitHub Actions

```yaml
- run: cd load-tests && npm install && npm run test:smoke
```

### GitHub Workflow

```bash
# On push to main
k6 run scenarios/api-ingestion.k6.js
```

### Local Pre-commit

```bash
./load-tests/run-smoke-tests.sh
```

## Performance Tips

1. Run smoke test first
2. Test one scenario at a time
3. Use staging environment
4. Monitor infrastructure
5. Compare with baselines

## More Info

See **README.md** for:

- Detailed documentation
- Troubleshooting guide
- Best practices
- CI/CD examples

---

**Quick Reference v1.0**
Last updated: 2026-07-30
