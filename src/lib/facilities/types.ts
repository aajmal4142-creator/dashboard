/** Facility / meter domain types — no I/O. */

export const FACILITY_TYPES = ["office", "plant", "warehouse", "other"] as const;
export type FacilityType = (typeof FACILITY_TYPES)[number];

export const METER_UTILITIES = ["electricity", "gas", "water", "heat"] as const;
export type MeterUtility = (typeof METER_UTILITIES)[number];

export type FacilityNode = {
  id: string;
  name: string;
  code: string;
  facilityType: FacilityType;
  country: string | null;
  region: string | null;
  address: string | null;
  active: boolean;
  parentId: string | null;
  notes: string | null;
};

export type MeterRow = {
  id: string;
  facilityId: string;
  name: string;
  utility: MeterUtility;
  unit: string;
  externalId: string | null;
  active: boolean;
  notes: string | null;
};

export type FacilityTreeNode = FacilityNode & {
  depth: number;
  children: FacilityTreeNode[];
  meterCount: number;
};

export type FacilityRollup = {
  id: string;
  name: string;
  code: string;
  depth: number;
  /** Self + all descendants. */
  descendantCount: number;
  /** Meters on self + descendants. */
  meterCount: number;
  /** Active meters on self + descendants. */
  activeMeterCount: number;
  /** Meter counts by utility (self + descendants). */
  byUtility: Record<MeterUtility, number>;
};

export function isFacilityType(value: unknown): value is FacilityType {
  return (
    typeof value === "string" && (FACILITY_TYPES as readonly string[]).includes(value)
  );
}

export function isMeterUtility(value: unknown): value is MeterUtility {
  return (
    typeof value === "string" && (METER_UTILITIES as readonly string[]).includes(value)
  );
}

export const FACILITY_TYPE_LABELS: Record<FacilityType, string> = {
  office: "Office",
  plant: "Plant",
  warehouse: "Warehouse",
  other: "Other",
};

export const METER_UTILITY_LABELS: Record<MeterUtility, string> = {
  electricity: "Electricity",
  gas: "Gas",
  water: "Water",
  heat: "Heat",
};
