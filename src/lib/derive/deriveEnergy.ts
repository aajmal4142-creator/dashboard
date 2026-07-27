import { ENERGY_CONTENT, KWH_PER_MWH } from "./constants";
import type { DerivedValue, Quality, RawInputs } from "./types";

function qualityOf(
  inputs: Array<{ key: string; value: number | null; quality?: Quality }>,
): {
  quality: Quality;
  missingInputs: string[];
  present: number[];
} {
  const missingInputs = inputs.filter((i) => i.value === null).map((i) => i.key);
  const present = inputs
    .filter(
      (i): i is { key: string; value: number; quality?: Quality } => i.value !== null,
    )
    .map((i) => i.value);

  if (present.length === 0) {
    return { quality: "missing", missingInputs, present: [] };
  }
  if (missingInputs.length > 0) {
    return { quality: "calculated", missingInputs, present };
  }
  return { quality: "calculated", missingInputs: [], present };
}

/**
 * Pure derivation: raw activity → ESRS-shaped energy outputs.
 * Never maps raw MetricDefinition keys to ESRS. Missing stays missing — never zero.
 */
export function deriveEnergy(inputs: RawInputs): DerivedValue[] {
  const diesel = inputs.diesel_litres;
  const petrol = inputs.petrol_litres;
  const gas = inputs.natural_gas_m3;
  const elec = inputs.electricity_kwh;
  const renewPct = inputs.electricity_renewable_pct;
  const heat = inputs.district_heat_kwh;

  const petroleumQ = qualityOf([
    { key: "diesel_litres", value: diesel },
    { key: "petrol_litres", value: petrol },
  ]);
  let petroleumMwh: number | null = null;
  if (petroleumQ.present.length > 0) {
    petroleumMwh =
      (diesel ?? 0) * ENERGY_CONTENT.diesel_mwh_per_l.value +
      (petrol ?? 0) * ENERGY_CONTENT.petrol_mwh_per_l.value;
  }

  const gasQ = qualityOf([{ key: "natural_gas_m3", value: gas }]);
  const gasMwh = gas === null ? null : gas * ENERGY_CONTENT.natural_gas_mwh_per_m3.value;

  const elecQ = qualityOf([
    { key: "electricity_kwh", value: elec },
    { key: "electricity_renewable_pct", value: renewPct },
  ]);
  let elecRenewableMwh: number | null = null;
  let elecFossilMwh: number | null = null;
  if (elec !== null && renewPct !== null) {
    const elecMwh = elec / KWH_PER_MWH;
    const share = Math.min(100, Math.max(0, renewPct)) / 100;
    elecRenewableMwh = elecMwh * share;
    elecFossilMwh = elecMwh * (1 - share);
  } else if (elec !== null && renewPct === null) {
    // Electricity known but share missing → cannot split; both legs missing quality on split outputs
    elecRenewableMwh = null;
    elecFossilMwh = null;
  }

  const heatQ = qualityOf([{ key: "district_heat_kwh", value: heat }]);
  const heatMwh = heat === null ? null : heat / KWH_PER_MWH;

  const components: Array<{ key: string; value: number | null }> = [
    { key: "derived.energy_petroleum_mwh", value: petroleumMwh },
    { key: "derived.energy_natural_gas_mwh", value: gasMwh },
    { key: "derived.energy_electricity_renewable_mwh", value: elecRenewableMwh },
    { key: "derived.energy_electricity_fossil_mwh", value: elecFossilMwh },
    { key: "derived.energy_district_heat_mwh", value: heatMwh },
  ];
  const totalPresent = components.filter((c) => c.value !== null);
  const totalMissing = components.filter((c) => c.value === null).map((c) => c.key);
  const totalMwh =
    totalPresent.length === 0
      ? null
      : totalPresent.reduce((sum, c) => sum + (c.value as number), 0);

  let renewablePct: number | null = null;
  let renewablePctQuality: Quality = "missing";
  const renewableMissing: string[] = [];
  if (totalMwh !== null && totalMwh > 0 && elecRenewableMwh !== null) {
    renewablePct = (elecRenewableMwh / totalMwh) * 100;
    renewablePctQuality = "calculated";
  } else {
    if (elecRenewableMwh === null)
      renewableMissing.push("derived.energy_electricity_renewable_mwh");
    if (totalMwh === null) renewableMissing.push("derived.energy_total_mwh");
  }

  const results: DerivedValue[] = [
    {
      key: "derived.energy_petroleum_mwh",
      label: "Fuel consumption from petroleum products (derived)",
      value: petroleumMwh,
      unit: "MWh",
      quality: petroleumMwh === null ? "missing" : petroleumQ.quality,
      inputs: ["diesel_litres", "petrol_litres"],
      formula: "diesel_L × 0.0101 + petrol_L × 0.0097",
      missingInputs: petroleumQ.missingInputs,
    },
    {
      key: "derived.energy_natural_gas_mwh",
      label: "Fuel consumption from natural gas (derived)",
      value: gasMwh,
      unit: "MWh",
      quality: gasMwh === null ? "missing" : gasQ.quality,
      inputs: ["natural_gas_m3"],
      formula: "natural_gas_m3 × 0.011",
      missingInputs: gasQ.missingInputs,
    },
    {
      key: "derived.energy_electricity_renewable_mwh",
      label: "Purchased electricity from renewable sources (derived)",
      value: elecRenewableMwh,
      unit: "MWh",
      quality: elecRenewableMwh === null ? "missing" : elecQ.quality,
      inputs: ["electricity_kwh", "electricity_renewable_pct"],
      formula: "(electricity_kWh / 1000) × (renewable_pct / 100)",
      missingInputs:
        elec === null || renewPct === null
          ? [
              ...(elec === null ? ["electricity_kwh"] : []),
              ...(renewPct === null ? ["electricity_renewable_pct"] : []),
            ]
          : [],
    },
    {
      key: "derived.energy_electricity_fossil_mwh",
      label: "Purchased electricity from fossil sources (derived)",
      value: elecFossilMwh,
      unit: "MWh",
      quality: elecFossilMwh === null ? "missing" : elecQ.quality,
      inputs: ["electricity_kwh", "electricity_renewable_pct"],
      formula: "(electricity_kWh / 1000) × (1 − renewable_pct / 100)",
      missingInputs:
        elec === null || renewPct === null
          ? [
              ...(elec === null ? ["electricity_kwh"] : []),
              ...(renewPct === null ? ["electricity_renewable_pct"] : []),
            ]
          : [],
    },
    {
      key: "derived.energy_district_heat_mwh",
      label: "Purchased district heat / cooling (derived)",
      value: heatMwh,
      unit: "MWh",
      quality: heatMwh === null ? "missing" : heatQ.quality,
      inputs: ["district_heat_kwh"],
      formula: "district_heat_kWh / 1000",
      missingInputs: heatQ.missingInputs,
    },
    {
      key: "derived.energy_total_mwh",
      label: "Total energy consumption (derived)",
      value: totalMwh,
      unit: "MWh",
      quality:
        totalMwh === null
          ? "missing"
          : totalMissing.length > 0
            ? "calculated"
            : "calculated",
      inputs: [
        "diesel_litres",
        "petrol_litres",
        "natural_gas_m3",
        "electricity_kwh",
        "electricity_renewable_pct",
        "district_heat_kwh",
      ],
      formula: "Σ derived energy components present",
      missingInputs: totalMissing,
    },
    {
      key: "derived.energy_renewable_pct",
      label: "Percentage of renewable sources in total energy (derived)",
      value: renewablePct,
      unit: "%",
      quality: renewablePctQuality,
      inputs: [
        "electricity_kwh",
        "electricity_renewable_pct",
        "district_heat_kwh",
        "diesel_litres",
        "petrol_litres",
        "natural_gas_m3",
      ],
      formula:
        "100 × derived.energy_electricity_renewable_mwh / derived.energy_total_mwh",
      missingInputs: renewableMissing,
    },
  ];

  return results;
}
