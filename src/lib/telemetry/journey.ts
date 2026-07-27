/**
 * Time-to-first-report telemetry. §13.2 / §13.6 — measure before claiming hours saved.
 */

export type JourneyEvent =
  "signup" | "onboarded" | "first_datapoint" | "first_supplier" | "first_publish";

export type JourneyTelemetry = {
  organisationId: string;
  events: Partial<Record<JourneyEvent, string>>;
};

const memory = new Map<string, JourneyTelemetry>();

export function recordJourneyEvent(
  organisationId: string,
  event: JourneyEvent,
  at: Date = new Date(),
): void {
  const row = memory.get(organisationId) ?? {
    organisationId,
    events: {},
  };
  if (!row.events[event]) {
    row.events[event] = at.toISOString();
    memory.set(organisationId, row);
  }
}

export function getJourneyTelemetry(organisationId: string): JourneyTelemetry | null {
  return memory.get(organisationId) ?? null;
}

/** Hours from onboarded → first_publish, if both exist. */
export function hoursToFirstReport(organisationId: string): number | null {
  const row = memory.get(organisationId);
  if (!row?.events.onboarded || !row.events.first_publish) return null;
  const a = Date.parse(row.events.onboarded);
  const b = Date.parse(row.events.first_publish);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return (b - a) / (1000 * 60 * 60);
}
