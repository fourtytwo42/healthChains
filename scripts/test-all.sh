#!/bin/bash

# Comprehensive Test Runner Script
# Runs all test suites: smart contracts, backend, frontend unit, and E2E tests

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track test results
FAILED=0
PASSED=0

# Function to print section header
print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

# Function to run a test suite
run_test() {
    local name=$1
    local command=$2
    local dir=$3

    print_header "Running: $name"
    
    if [ -n "$dir" ]; then
        cd "$dir" || exit 1
    fi

    if eval "$command"; then
        echo -e "${GREEN}✓ $name passed${NC}"
        ((PASSED++))
    else
        echo -e "${RED}✗ $name failed${NC}"
        ((FAILED++))
        if [ -n "$dir" ]; then
            cd - > /dev/null || exit 1
        fi
        return 1
    fi

    if [ -n "$dir" ]; then
        cd - > /dev/null || exit 1
    fi
}

# Start
echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║     Comprehensive Test Suite - HealthChains              ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if we're in the project root
if [ ! -f "package.json" ] || [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo -e "${RED}Error: Must run from project root directory${NC}"
    exit 1
fi

# 1. Smart Contract Tests
run_test "Smart Contract Tests" "npm run test:contract" "backend"

# 2. Backend Tests (starts/stops Hardhat node automatically)
run_test "Backend Tests" "npm run test:backend" "backend"

# 4. Frontend Unit Tests
run_test "Frontend Unit Tests" "npm test -- --coverage=false" "frontend"

# 5. Frontend E2E Tests (optional - can be skipped if Playwright not set up)
if command -v playwright &> /dev/null; then
    run_test "Frontend E2E Tests" "npm run test:e2e" "frontend" || {
        echo -e "${YELLOW}⚠ E2E tests skipped or failed (Playwright may need setup)${NC}"
    }
else
    echo -e "${YELLOW}⚠ Playwright not found - skipping E2E tests${NC}"
    echo "   Install with: cd frontend && npx playwright install"
fi

# Summary
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Passed: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Failed: $FAILED${NC}"
    echo ""
    echo -e "${RED}Some tests failed. Please review the output above.${NC}"
    exit 1
else
    echo -e "${GREEN}Failed: $FAILED${NC}"
    echo ""
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
fi

