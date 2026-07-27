import { describe, expect, it } from "vitest";

import { deriveEnergy } from "./deriveEnergy";

describe("deriveEnergy", () => {
  it("converts diesel and petrol litres to petroleum MWh", () => {
    const out = deriveEnergy({
      electricity_kwh: null,
      electricity_renewable_pct: null,
      diesel_litres: 1000,
      natural_gas_m3: null,
      petrol_litres: 500,
      district_heat_kwh: null,
    });
    const petroleum = out.find((d) => d.key === "derived.energy_petroleum_mwh");
    expect(petroleum?.value).toBeCloseTo(1000 * 0.0101 + 500 * 0.0097, 6);
    expect(petroleum?.quality).toBe("calculated");
  });

  it("splits electricity by renewable share into MWh", () => {
    const out = deriveEnergy({
      electricity_kwh: 100_000,
      electricity_renewable_pct: 40,
      diesel_litres: null,
      natural_gas_m3: null,
      petrol_litres: null,
      district_heat_kwh: null,
    });
    const renew = out.find((d) => d.key === "derived.energy_electricity_renewable_mwh");
    const fossil = out.find((d) => d.key === "derived.energy_electricity_fossil_mwh");
    expect(renew?.value).toBeCloseTo(40, 6);
    expect(fossil?.value).toBeCloseTo(60, 6);
  });

  it("never treats missing electricity share as zero split", () => {
    const out = deriveEnergy({
      electricity_kwh: 50_000,
      electricity_renewable_pct: null,
      diesel_litres: null,
      natural_gas_m3: null,
      petrol_litres: null,
      district_heat_kwh: null,
    });
    const renew = out.find((d) => d.key === "derived.energy_electricity_renewable_mwh");
    const fossil = out.find((d) => d.key === "derived.energy_electricity_fossil_mwh");
    expect(renew?.value).toBeNull();
    expect(fossil?.value).toBeNull();
    expect(renew?.quality).toBe("missing");
  });

  it("converts gas m³ and district heat kWh", () => {
    const out = deriveEnergy({
      electricity_kwh: null,
      electricity_renewable_pct: null,
      diesel_litres: null,
      natural_gas_m3: 1000,
      petrol_litres: null,
      district_heat_kwh: 5000,
    });
    expect(
      out.find((d) => d.key === "derived.energy_natural_gas_mwh")?.value,
    ).toBeCloseTo(11, 6);
    expect(
      out.find((d) => d.key === "derived.energy_district_heat_mwh")?.value,
    ).toBeCloseTo(5, 6);
  });

  it("marks everything missing when no inputs", () => {
    const out = deriveEnergy({
      electricity_kwh: null,
      electricity_renewable_pct: null,
      diesel_litres: null,
      natural_gas_m3: null,
      petrol_litres: null,
      district_heat_kwh: null,
    });
    expect(out.every((d) => d.value === null && d.quality === "missing")).toBe(true);
  });
});
