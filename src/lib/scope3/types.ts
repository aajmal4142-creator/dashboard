export type Scope3Category =
  "supplier" | "investment" | "waste" | "business_travel" | "employee_commute";

export interface EmissionsFactor {
  value: number; // tonnes CO2e per unit
  unit: string; // kg, miles, kWh, etc
  source: string; // DEFRA, CDP, IPCC, GHGProtocol
  year: number;
  confidence?: "high" | "medium" | "low";
  standard?: string;
  factorId?: string;
  key?: string;
}

export interface ActivityDataField {
  name: string;
  unit: string;
  description: string;
  required: boolean;
}

export interface Scope3Source {
  id: string;
  type: Scope3Category;
  name: string;
  description?: string;
  emissionsFactor: EmissionsFactor;
  activityDataFields: ActivityDataField[];
  organisationId: string;
  createdAt: Date;
}

export interface Scope3Activity {
  id: string;
  sourceId: string;
  periodId: string;
  activityData: Record<string, number>;
  calculatedEmissions: number;
  status: "draft" | "validated" | "approved";
  evidenceIds?: string[];
  organisationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface UncertaintyRange {
  low: number;
  best: number;
  high: number;
}
