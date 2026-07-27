"use client";

import Link from "next/link";
import { useState } from "react";

export function GuideChecklist({
  steps,
  initialDone,
}: {
  steps: ReadonlyArray<{ id: string; label: string; href: string }>;
  initialDone: Record<string, boolean>;
}) {
  const [done, setDone] = useState(initialDone);
  const [error, setError] = useState<string | null>(null);

  async function toggle(id: string) {
    const next = { ...done, [id]: !done[id] };
    setDone(next);
    const res = await fetch("/api/app/guide", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: next }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not save checklist");
      setDone(initialDone);
      return;
    }
    const data = (await res.json().catch(() => ({}))) as {
      done?: Record<string, boolean>;
    };
    if (data.done) setDone(data.done);
    setError(null);
  }

  return (
    <div className="rounded-[6px] border border-rule bg-surface-1 p-4 md:p-5">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
        Checklist
      </p>
      {error ? <p className="mb-3 text-[13px] text-rust">{error}</p> : null}
      <ul>
        {steps.map((s) => (
          <li
            key={s.id}
            className="flex items-center gap-3 border-b border-rule py-3 transition-colors last:border-b-0 hover:bg-surface-2"
          >
            <input
              type="checkbox"
              checked={Boolean(done[s.id])}
              onChange={() => void toggle(s.id)}
              aria-label={s.label}
              className="size-4 accent-[var(--accent)]"
            />
            <Link
              href={s.href}
              className="text-[13px] font-medium text-ink hover:text-accent"
            >
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
