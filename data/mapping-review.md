# Mapping review — E energy metrics (CSRD Set 1)

Extracted at: 2026-07-16T22:10:04.383Z

Human review only. Every `approved` field is `null`. Do not treat this file as a seed.

Scope: `electricity_kwh`, `diesel_litres`, `natural_gas_m3`, `petrol_litres`, `district_heat_kwh`, `electricity_renewable_pct`.

BRSR / VSME not proposed — source files not in `/docs`.

## `electricity_kwh`

2 candidate(s). All `approved: null`.

### 1. `E1-5_07` (possible)

- **Name (verbatim):** “Consumption of purchased or acquired electricity, heat, steam, and cooling from renewable sources”
- **sourceSheet / sourceRow:** ESRS E1 / 90
- **paragraph:** `37 c ii`
- **relatedAr:** `null`
- **dataType:** `energy`
- **voluntary:** `null`
- **phaseInUnder750Employees:** `null`
- **phaseInAllUndertakings:** `null`
- **conditional:** `null`
- **framework:** `CSRD_SET1`
- **matchBasis:** DR E1-5 §37 c ii name includes the words "purchased or acquired electricity" and dataType is energy; caveat: the same DP also bundles heat, steam, and cooling and is renewable-sources only, so it is not an electricity-kWh total.
- **approved:** `null`

### 2. `E1-5_14` (possible)

- **Name (verbatim):** “Consumption of purchased or acquired electricity, heat, steam, or cooling from fossil sources”
- **sourceSheet / sourceRow:** ESRS E1 / 97
- **paragraph:** `38 e`
- **relatedAr:** `AR 33`
- **dataType:** `energy`
- **voluntary:** `null`
- **phaseInUnder750Employees:** `null`
- **phaseInAllUndertakings:** `null`
- **conditional:** `true`
- **framework:** `CSRD_SET1`
- **matchBasis:** DR E1-5 §38 e name includes "purchased or acquired electricity" with dataType energy; caveat: bundles heat/steam/cooling and covers fossil-sourced purchases only, not total grid kWh.
- **approved:** `null`

## `diesel_litres`

1 candidate(s). All `approved: null`.

### 1. `E1-5_11` (weak)

- **Name (verbatim):** “Fuel consumption from crude oil and petroleum products”
- **sourceSheet / sourceRow:** ESRS E1 / 94
- **paragraph:** `38 b`
- **relatedAr:** `AR 33`
- **dataType:** `energy`
- **voluntary:** `null`
- **phaseInUnder750Employees:** `null`
- **phaseInAllUndertakings:** `null`
- **conditional:** `true`
- **framework:** `CSRD_SET1`
- **matchBasis:** DR E1-5 §38 b names "Fuel consumption from crude oil and petroleum products" — diesel sits in that petroleum-products class — but the DP does not say diesel and dataType is energy, not litres.
- **approved:** `null`

## `natural_gas_m3`

1 candidate(s). All `approved: null`.

### 1. `E1-5_12` (possible)

- **Name (verbatim):** “Fuel consumption from natural gas”
- **sourceSheet / sourceRow:** ESRS E1 / 95
- **paragraph:** `38 c`
- **relatedAr:** `AR 33`
- **dataType:** `energy`
- **voluntary:** `null`
- **phaseInUnder750Employees:** `null`
- **phaseInAllUndertakings:** `null`
- **conditional:** `true`
- **framework:** `CSRD_SET1`
- **matchBasis:** DR E1-5 §38 c name is exactly "Fuel consumption from natural gas" (same fuel named); dataType is energy, not cubic metres, so a unit conversion would still be required.
- **approved:** `null`

## `petrol_litres`

1 candidate(s). All `approved: null`.

### 1. `E1-5_11` (weak)

- **Name (verbatim):** “Fuel consumption from crude oil and petroleum products”
- **sourceSheet / sourceRow:** ESRS E1 / 94
- **paragraph:** `38 b`
- **relatedAr:** `AR 33`
- **dataType:** `energy`
- **voluntary:** `null`
- **phaseInUnder750Employees:** `null`
- **phaseInAllUndertakings:** `null`
- **conditional:** `true`
- **framework:** `CSRD_SET1`
- **matchBasis:** DR E1-5 §38 b names "petroleum products" — petrol is a petroleum product — but the DP does not say petrol and dataType is energy, not litres; same bucket as diesel.
- **approved:** `null`

## `district_heat_kwh`

2 candidate(s). All `approved: null`.

### 1. `E1-5_07` (possible)

- **Name (verbatim):** “Consumption of purchased or acquired electricity, heat, steam, and cooling from renewable sources”
- **sourceSheet / sourceRow:** ESRS E1 / 90
- **paragraph:** `37 c ii`
- **relatedAr:** `null`
- **dataType:** `energy`
- **voluntary:** `null`
- **phaseInUnder750Employees:** `null`
- **phaseInAllUndertakings:** `null`
- **conditional:** `null`
- **framework:** `CSRD_SET1`
- **matchBasis:** DR E1-5 §37 c ii name lists purchased "heat, steam, and cooling" (district heat is purchased heat) with dataType energy; caveat: bundled with electricity and renewable-only.
- **approved:** `null`

### 2. `E1-5_14` (possible)

- **Name (verbatim):** “Consumption of purchased or acquired electricity, heat, steam, or cooling from fossil sources”
- **sourceSheet / sourceRow:** ESRS E1 / 97
- **paragraph:** `38 e`
- **relatedAr:** `AR 33`
- **dataType:** `energy`
- **voluntary:** `null`
- **phaseInUnder750Employees:** `null`
- **phaseInAllUndertakings:** `null`
- **conditional:** `true`
- **framework:** `CSRD_SET1`
- **matchBasis:** DR E1-5 §38 e name lists purchased "heat, steam, or cooling" from fossil sources with dataType energy; caveat: bundled with electricity and fossil-only.
- **approved:** `null`

## `electricity_renewable_pct`

1 candidate(s). All `approved: null`.

### 1. `E1-5_09` (weak)

- **Name (verbatim):** “Percentage of renewable sources in total energy consumption”
- **sourceSheet / sourceRow:** ESRS E1 / 92
- **paragraph:** `AR 34`
- **relatedAr:** `null`
- **dataType:** `percent`
- **voluntary:** `null`
- **phaseInUnder750Employees:** `null`
- **phaseInAllUndertakings:** `null`
- **conditional:** `null`
- **framework:** `CSRD_SET1`
- **matchBasis:** DR E1-5 AR 34 name is "Percentage of renewable sources in total energy consumption" and dataType is percent (matches a % field), but the denominator is total energy, not electricity alone.
- **approved:** `null`

---

## Gaps summary

- `electricity_kwh`: 2 candidate(s), none approved
- `diesel_litres`: 1 candidate(s), none approved
- `natural_gas_m3`: 1 candidate(s), none approved
- `petrol_litres`: 1 candidate(s), none approved
- `district_heat_kwh`: 2 candidate(s), none approved
- `electricity_renewable_pct`: 1 candidate(s), none approved
