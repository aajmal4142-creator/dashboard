@echo off
REM Load Testing Suite Runner for Windows
REM Usage: run-tests.bat [scenario] [type]
REM Examples:
REM   run-tests.bat api smoke
REM   run-tests.bat all load
REM   run-tests.bat supplier stress

setlocal enabledelayedexpansion

REM Configuration
set "SCENARIO=%1"
set "TEST_TYPE=%2"

if "%SCENARIO%"=="" set "SCENARIO=api"
if "%TEST_TYPE%"=="" set "TEST_TYPE=load"

if "%SCENARIO%"=="-h" goto :print_usage
if "%SCENARIO%"=="--help" goto :print_usage

echo.
echo ================================
echo Load Testing Suite
echo ================================
echo Scenario: %SCENARIO%
echo Type: %TEST_TYPE%
echo.

REM Check dependencies
echo Checking dependencies...
where k6 >nul 2>nul
if errorlevel 1 (
  echo [ERROR] k6 not found. Install from https://k6.io/
  exit /b 1
)
echo [OK] k6 installed

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found
  exit /b 1
)
echo [OK] Node.js installed

if not exist "node_modules" (
  echo Installing npm dependencies...
  call npm install
)
echo [OK] Dependencies ready
echo.

REM Load environment
if exist ".env" (
  echo Loading environment from .env
  for /f "delims=" %%x in (.env) do (
    if not "%%x"=="" (
      setlocal enabledelayedexpansion
      set "%%x"
    )
  )
) else if exist ".env.example" (
  echo Loading environment from .env.example (copy to .env to customize)
  for /f "delims=" %%x in (.env.example) do (
    if not "%%x"=="" (
      setlocal enabledelayedexpansion
      set "%%x"
    )
  )
)
echo.

REM Check API health
echo Checking API health...
set "BASE_URL=http://localhost:3000"
powershell -Command "(New-Object Net.WebClient).DownloadString('http://localhost:3000/api/health')" >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Cannot reach API at %BASE_URL%
  echo Make sure your API server is running: npm run dev
  exit /b 1
)
echo [OK] API is running
echo.

REM Run scenario
if "%SCENARIO%"=="api" (
  echo ================================
  echo Running API Ingestion Test (%TEST_TYPE%)
  echo ================================
  call k6 run -e TEST_TYPE=%TEST_TYPE% scenarios\api-ingestion.k6.js
  goto :results
)

if "%SCENARIO%"=="supplier" (
  echo ================================
  echo Running Supplier Risk Scoring Test (%TEST_TYPE%)
  echo ================================
  call k6 run -e TEST_TYPE=%TEST_TYPE% scenarios\supplier-risk.k6.js
  goto :results
)

if "%SCENARIO%"=="scenario" (
  echo ================================
  echo Running Scenario Modeling Test (%TEST_TYPE%)
  echo ================================
  call k6 run -e TEST_TYPE=%TEST_TYPE% scenarios\scenario-modeling.k6.js
  goto :results
)

if "%SCENARIO%"=="data-gaps" (
  echo ================================
  echo Running Data Gap Detection Test (%TEST_TYPE%)
  echo ================================
  call k6 run -e TEST_TYPE=%TEST_TYPE% scenarios\data-gaps.k6.js
  goto :results
)

if "%SCENARIO%"=="csv" (
  echo ================================
  echo Running CSV Import Test (%TEST_TYPE%)
  echo ================================
  call k6 run -e TEST_TYPE=%TEST_TYPE% scenarios\csv-import.k6.js
  goto :results
)

if "%SCENARIO%"=="all" (
  echo ================================
  echo Running All Tests (%TEST_TYPE%)
  echo ================================
  for %%s in (api supplier scenario data-gaps csv) do (
    echo.
    call :run_scenario %%s %TEST_TYPE%
    timeout /t 5 /nobreak
  )
  goto :results
)

if "%SCENARIO%"=="stress" (
  echo ================================
  echo Running Stress Test (API Ingestion)
  echo ================================
  call k6 run ^
    --stage 30s:0 ^
    --stage 1m30s:100 ^
    --stage 20s:100 ^
    --stage 10s:0 ^
    scenarios\api-ingestion.k6.js
  goto :results
)

echo [ERROR] Unknown scenario: %SCENARIO%
goto :print_usage

:run_scenario
  set "test_scenario=%1"
  set "test_type=%2"
  echo Running %test_scenario% test...
  if "%test_scenario%"=="api" call k6 run -e TEST_TYPE=%test_type% scenarios\api-ingestion.k6.js
  if "%test_scenario%"=="supplier" call k6 run -e TEST_TYPE=%test_type% scenarios\supplier-risk.k6.js
  if "%test_scenario%"=="scenario" call k6 run -e TEST_TYPE=%test_type% scenarios\scenario-modeling.k6.js
  if "%test_scenario%"=="data-gaps" call k6 run -e TEST_TYPE=%test_type% scenarios\data-gaps.k6.js
  if "%test_scenario%"=="csv" call k6 run -e TEST_TYPE=%test_type% scenarios\csv-import.k6.js
  goto :eof

:results
echo.
echo ================================
echo Test Results Summary
echo ================================
echo.
echo For detailed results, check:
echo   - Console output above
echo   - Grafana dashboard: http://localhost:3000 (if monitoring enabled)
echo   - InfluxDB: http://localhost:8086
echo.
goto :end

:print_usage
echo.
echo Usage: run-tests.bat [scenario] [type]
echo.
echo Scenarios:
echo   api         - API Ingestion ^& Webhook Processing
echo   supplier    - Supplier Risk Scoring
echo   scenario    - Scenario Modeling (Monte Carlo)
echo   data-gaps   - Data Gap Detection
echo   csv         - CSV Import ^& Bulk Operations
echo   all         - Run all scenarios
echo   stress      - Run stress test
echo.
echo Types (for individual scenarios):
echo   smoke       - Quick validation (1 VU, 30s)
echo   load        - Standard load test (100 VUs, 5m)
echo   stress      - Stress test (ramp to 500 VUs)
echo   spike       - Spike test (sudden 1000 VUs)
echo.
echo Examples:
echo   run-tests.bat api smoke
echo   run-tests.bat supplier load
echo   run-tests.bat all stress
echo.

:end
endlocal
