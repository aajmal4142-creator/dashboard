"use client";

import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "nextjs-toploader/app";
import { useEffect, useId, useState } from "react";

import { Assemble } from "@/components/motion";
import { StatusLine } from "@/components/shell/PageFrame";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Metric } from "@/components/ui/metric";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMotionSafe } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

type ObligationGift = {
  name: string;
  filingDeadline: string | null;
  reason: string;
  confidence: "derived" | "needs_confirmation";
  daysToFiling: number | null;
};

const QUESTIONS = [
  {
    key: "sector",
    label: "Sector",
    type: "search" as const,
    options: [
      { value: "C25", label: "Manufacturing" },
      { value: "J62", label: "IT / Services" },
      { value: "G46", label: "Wholesale" },
      { value: "H49", label: "Transport" },
      { value: "M70", label: "Consulting" },
    ],
  },
  { key: "headcount", label: "Headcount (FTE)", type: "number" as const },
  {
    key: "country",
    label: "Country",
    type: "search" as const,
    options: [
      { value: "GB", label: "United Kingdom" },
      { value: "IN", label: "India" },
      { value: "IE", label: "Ireland" },
      { value: "DE", label: "Germany" },
      { value: "NL", label: "Netherlands" },
      { value: "US", label: "United States" },
    ],
  },
  {
    key: "revenueBand",
    label: "Revenue band",
    type: "select" as const,
    options: [
      { value: "lt_2m", label: "< €2m" },
      { value: "2_10m", label: "€2–10m" },
      { value: "10_50m", label: "€10–50m" },
      { value: "50_250m", label: "€50–250m" },
      { value: "gt_250m", label: "> €250m" },
    ],
  },
  { key: "sites", label: "Number of sites", type: "number" as const },
  {
    key: "tenure",
    label: "Premises",
    type: "select" as const,
    options: [
      { value: "own", label: "Owned" },
      { value: "lease", label: "Leased" },
      { value: "mix", label: "Mix" },
    ],
  },
];

function estimateScore(
  sector: string,
  headcount: number,
): { score: number; tCO2e: number } {
  const intensity = sector.startsWith("C")
    ? 8
    : sector.startsWith("J") || sector.startsWith("M")
      ? 2
      : 4;
  const tCO2e = Math.max(1, headcount) * intensity;
  const carbonPerEmployee = tCO2e / Math.max(1, headcount);
  const score = Math.max(
    0,
    Math.min(100, Math.round(100 - Math.max(0, carbonPerEmployee - 1) * 12)),
  );
  return { score, tCO2e };
}

function SearchSelect({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: Option[];
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-controls={listId}
          aria-expanded={open}
          className="flex h-11 w-full items-center justify-between rounded-[4px] border border-rule bg-surface-1 px-3 text-left text-ink hover:border-rule-strong"
        >
          <span className={cn(!selected && "text-ink-muted")}>
            {selected ? selected.label : placeholder}
          </span>
          <span className="font-data text-xs text-ink-muted">Search</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] border-rule bg-surface-1 p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder={`Filter ${placeholder.toLowerCase()}…`} />
          <CommandList id={listId}>
            <CommandEmpty>No match.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={`${o.label} ${o.value}`}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <span className="text-ink">{o.label}</span>
                  <span className="font-data ml-auto text-xs text-ink-muted">
                    {o.value}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function OnboardingWizard() {
  const transition = useMotionSafe();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [gift, setGift] = useState<ObligationGift | null>(null);
  const [voluntary, setVoluntary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({
    sector: "C25",
    headcount: "80",
    country: "GB",
    revenueBand: "10_50m",
    sites: "2",
    tenure: "lease",
  });

  useEffect(() => {
    void Promise.resolve().then(() => {
      try {
        const raw = window.localStorage.getItem("clearesg-onboarding-draft");
        if (raw) {
          const parsed = JSON.parse(raw) as {
            step?: number;
            values?: Record<string, string>;
          };
          if (parsed.values) setValues((v) => ({ ...v, ...parsed.values }));
          if (typeof parsed.step === "number") {
            setStep(Math.min(QUESTIONS.length - 1, Math.max(0, parsed.step)));
          }
        }
      } catch {
        /* ignore */
      }
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated || done) return;
    try {
      window.localStorage.setItem(
        "clearesg-onboarding-draft",
        JSON.stringify({ step, values }),
      );
    } catch {
      /* ignore */
    }
  }, [step, values, hydrated, done]);

  const q = QUESTIONS[step];
  const progress = ((step + (done ? 1 : 0)) / QUESTIONS.length) * 100;
  const estimate = estimateScore(values.sector, Number(values.headcount) || 1);

  async function finish() {
    setError(null);
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      voluntary?: boolean;
      obligation?: ObligationGift | null;
    };
    if (!res.ok) {
      const raw = data.error ?? "Onboarding failed";
      setError(
        raw === "Forbidden"
          ? "You do not have permission to complete onboarding. Ask an owner."
          : raw,
      );
      return;
    }
    try {
      window.localStorage.removeItem("clearesg-onboarding-draft");
    } catch {
      /* ignore */
    }
    setVoluntary(Boolean(data.voluntary));
    setGift(data.obligation ?? null);
    setDone(true);
    router.refresh();
  }

  if (done) {
    const days = gift?.daysToFiling ?? null;
    const deadlineLabel = gift?.filingDeadline
      ? new Date(gift.filingDeadline).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : null;

    return (
      <Assemble
        layer="data"
        className="mx-auto flex max-w-2xl flex-col items-center px-6 py-16"
      >
        <p className="label-caps mb-4">Scope</p>
        {voluntary || !gift?.filingDeadline ? (
          <>
            <h1
              className="text-center text-3xl font-medium tracking-tight text-ink sm:text-4xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              You&apos;re not in mandatory scope yet
            </h1>
            <p className="measure-body mt-6 text-center text-ink-muted">
              {gift?.reason ??
                "Buyers may still ask — you can start voluntarily and be ready when they do."}
            </p>
          </>
        ) : (
          <>
            <h1
              className="text-center text-3xl font-medium tracking-tight text-ink sm:text-4xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              You&apos;re likely in {gift.name}
            </h1>
            {days !== null ? (
              <div className="mt-8">
                <Metric value={days} size="display" decimals={0} inView={false} />
                <p className="label-caps mt-2 text-center">Days to first report</p>
              </div>
            ) : null}
            <p className="mt-4 text-center text-ink-muted">
              Due {deadlineLabel}
              {gift.confidence === "needs_confirmation"
                ? " — confirm this on your Runway"
                : null}
            </p>
            <p className="measure-body mt-6 text-center text-ink-muted">{gift.reason}</p>
          </>
        )}
        <p className="mt-8 text-center text-xs text-ink-muted">
          Estimated score <span className="font-data text-amber">{estimate.score}</span>
          {" · "}
          <span className="font-data text-amber">{estimate.tCO2e}</span> tCO2e — replace
          with measured data on the Runway.
        </p>
        <Button
          type="button"
          className="mt-10"
          onClick={() => {
            router.refresh();
            router.push("/dashboard");
          }}
        >
          Open runway
        </Button>
      </Assemble>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <div className="mb-10 h-0.5 w-full bg-surface-2">
        <div
          className="h-0.5 bg-accent transition-[width]"
          style={{ width: `${progress}%` }}
        />
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={q.key}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={transition}
        >
          <p className="label-caps mb-3">
            Question {step + 1} of {QUESTIONS.length}
          </p>
          <h1 className="font-display text-3xl text-ink">{q.label}</h1>
          <div className="mt-8">
            {q.type === "number" ? (
              <Input
                type="number"
                className="h-11"
                value={values[q.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [q.key]: e.target.value }))}
              />
            ) : q.type === "search" ? (
              <SearchSelect
                options={q.options ?? []}
                value={values[q.key] ?? ""}
                onChange={(next) => setValues((v) => ({ ...v, [q.key]: next }))}
                placeholder={q.label}
              />
            ) : (
              <select
                className="h-11 w-full rounded-[4px] border border-rule bg-surface-1 px-3 text-ink"
                value={values[q.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [q.key]: e.target.value }))}
              >
                {q.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          {error ? <StatusLine tone="error">{error}</StatusLine> : null}
          <div className="mt-10 flex gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={step === 0}
              onClick={() => {
                setError(null);
                setStep((s) => Math.max(0, s - 1));
              }}
            >
              Back
            </Button>
            <Button
              type="button"
              onClick={() => {
                setError(null);
                if (step >= QUESTIONS.length - 1) void finish();
                else setStep((s) => s + 1);
              }}
            >
              {step >= QUESTIONS.length - 1 ? "See baseline" : "Continue"}
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
