#!/bin/bash

# Load Testing Suite Runner
# Usage: ./run-tests.sh [scenario] [type]
# Examples:
#   ./run-tests.sh api smoke
#   ./run-tests.sh all load
#   ./run-tests.sh supplier stress

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCENARIO="${1:-api}"
TEST_TYPE="${2:-load}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Functions
print_header() {
  echo -e "${BLUE}================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}================================${NC}"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

check_dependencies() {
  print_header "Checking Dependencies"

  # Check k6
  if ! command -v k6 &> /dev/null; then
    print_error "k6 not found. Install from https://k6.io/"
    exit 1
  fi
  print_success "k6 installed ($(k6 version))"

  # Check Node.js
  if ! command -v node &> /dev/null; then
    print_error "Node.js not found"
    exit 1
  fi
  print_success "Node.js installed ($(node --version))"

  # Check npm dependencies
  if [ ! -d "node_modules" ]; then
    print_warning "Installing npm dependencies..."
    npm install
  fi
  print_success "Dependencies ready"
  echo ""
}

check_api() {
  print_header "Checking API Health"

  BASE_URL="${BASE_URL:-http://localhost:3000}"
  if curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
    print_success "API is running at $BASE_URL"
  else
    print_error "Cannot reach API at $BASE_URL"
    print_warning "Make sure your API server is running: npm run dev"
    exit 1
  fi
  echo ""
}

load_env() {
  if [ -f .env ]; then
    export $(cat .env | xargs)
    print_success "Loaded environment from .env"
  elif [ -f .env.example ]; then
    print_warning "Using .env.example (copy to .env and customize if needed)"
    export $(cat .env.example | xargs)
  fi
  echo ""
}

run_scenario() {
  local scenario=$1
  local test_type=$2

  case $scenario in
    api)
      print_header "Running API Ingestion Test ($test_type)"
      k6 run -e TEST_TYPE=$test_type scenarios/api-ingestion.k6.js
      ;;
    supplier)
      print_header "Running Supplier Risk Scoring Test ($test_type)"
      k6 run -e TEST_TYPE=$test_type scenarios/supplier-risk.k6.js
      ;;
    scenario)
      print_header "Running Scenario Modeling Test ($test_type)"
      k6 run -e TEST_TYPE=$test_type scenarios/scenario-modeling.k6.js
      ;;
    data-gaps)
      print_header "Running Data Gap Detection Test ($test_type)"
      k6 run -e TEST_TYPE=$test_type scenarios/data-gaps.k6.js
      ;;
    csv)
      print_header "Running CSV Import Test ($test_type)"
      k6 run -e TEST_TYPE=$test_type scenarios/csv-import.k6.js
      ;;
    all)
      print_header "Running All Tests ($test_type)"
      for test_scenario in api supplier scenario data-gaps csv; do
        echo ""
        run_scenario $test_scenario $test_type
        sleep 5
      done
      return
      ;;
    stress)
      print_header "Running Stress Test (API Ingestion)"
      k6 run \
        --stage 30s:0 \
        --stage 1m30s:100 \
        --stage 20s:100 \
        --stage 10s:0 \
        scenarios/api-ingestion.k6.js
      ;;
    *)
      print_error "Unknown scenario: $scenario"
      print_usage
      exit 1
      ;;
  esac
}

print_usage() {
  echo ""
  echo "Usage: $0 [scenario] [type]"
  echo ""
  echo "Scenarios:"
  echo "  api         - API Ingestion & Webhook Processing"
  echo "  supplier    - Supplier Risk Scoring"
  echo "  scenario    - Scenario Modeling (Monte Carlo)"
  echo "  data-gaps   - Data Gap Detection"
  echo "  csv         - CSV Import & Bulk Operations"
  echo "  all         - Run all scenarios"
  echo "  stress      - Run stress test"
  echo ""
  echo "Types (for individual scenarios):"
  echo "  smoke       - Quick validation (1 VU, 30s)"
  echo "  load        - Standard load test (100 VUs, 5m)"
  echo "  stress      - Stress test (ramp to 500 VUs)"
  echo "  spike       - Spike test (sudden 1000 VUs)"
  echo ""
  echo "Examples:"
  echo "  $0 api smoke"
  echo "  $0 supplier load"
  echo "  $0 all stress"
  echo "  $0 stress"
  echo ""
}

print_results() {
  echo ""
  echo -e "${GREEN}================================${NC}"
  echo -e "${GREEN}Test Results Summary${NC}"
  echo -e "${GREEN}================================${NC}"
  echo ""
  echo "For detailed results, check:"
  echo "  - Console output above"
  echo "  - Grafana dashboard: http://localhost:3000 (if monitoring enabled)"
  echo "  - InfluxDB: http://localhost:8086"
  echo ""
}

# Main execution
main() {
  if [ "$1" == "-h" ] || [ "$1" == "--help" ]; then
    print_usage
    exit 0
  fi

  check_dependencies
  load_env
  check_api

  run_scenario $SCENARIO $TEST_TYPE

  print_results
}

# Run main
main "$@"
