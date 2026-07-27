"use client";

import {
  FRAMEWORK_DISPLAY,
  mappingsForMetricKey,
  type FrameworkId,
} from "@/lib/frameworks";

/** Quiet chips: “This figure contributes to …” filtered by applicable frameworks. */
export function FrameworkChips({
  metricKey,
  applicable,
}: {
  metricKey: string;
  applicable: FrameworkId[];
}) {
  const allowed = new Set(applicable);
  const rows = mappingsForMetricKey(metricKey).filter((m) => allowed.has(m.framework));
  if (rows.length === 0) return null;

  // Dedupe by framework + disclosure code
  const seen = new Set<string>();
  const chips = rows.filter((r) => {
    const k = `${r.framework}:${r.datapointRef}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return (
    <div className="mt-1">
      <p className="text-[10px] text-ink-muted">This figure contributes to</p>
      <ul className="mt-0.5 flex flex-wrap gap-1">
        {chips.map((c) => (
          <li
            key={`${c.framework}:${c.datapointRef}`}
            className="rounded-[2px] border border-rule bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-muted"
            title={c.label}
          >
            <span className="text-accent-quiet">{FRAMEWORK_DISPLAY[c.framework]}</span>
            <span className="mx-1 text-rule-strong">·</span>
            <span className="font-data">{c.datapointRef}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
