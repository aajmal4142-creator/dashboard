"use client";

import { useEffect, useMemo, useState } from "react";

import { Gauge } from "@/components/gauge/Gauge";
import { InkReveal } from "@/components/motion";
import { Metric } from "@/components/ui/metric";
import { FACTORS_FIXTURE } from "@/lib/calc/__fixtures__/factors.fixture";
import { computeScope1 } from "@/lib/calc/emissions";
import {
  computeEScore,
  computeGScore,
  computeOverall,
  computeSScore,
} from "@/lib/calc/scores";
import type { DatapointValue } from "@/lib/calc/types";
import { heroStage, usePrefersReducedMotion } from "@/lib/motion";

function demoScore(headcount: number, dieselL: number, renewablePct: number): number {
  const metrics: Record<string, DatapointValue> = {
    diesel_litres: {
      value: dieselL,
      unit: "L",
      quality: "estimated",
    },
  };
  const scope1 = computeScope1(metrics, FACTORS_FIXTURE, "GB", 2024);
  const carbonPerEmployee =
    scope1.measured.quality === "missing"
      ? 0
      : scope1.measured.value / Math.max(1, headcount);

  const e = computeEScore({
    carbonPerEmployeeTco2e: carbonPerEmployee,
    renewablePct,
  });
  const s = computeSScore({
    diversityPct: 40,
    injuryRate: 1.2,
    trainingHoursPerEmployee: 8,
  });
  const g = computeGScore({
    boardIndependencePct: 50,
    policiesTrue: 2,
  });
  return computeOverall(e.score, s.score, g.score);
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="label-caps flex items-baseline justify-between gap-2">
        <span>{label}</span>
        <Metric value={value} unit={unit} size="sm" animate={false} />
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 h-1 w-full cursor-pointer appearance-none rounded-none bg-rule accent-accent"
      />
    </label>
  );
}

/**
 * Marketing hero gauge — printed dial above the fold, then live sliders.
 */
export function LiveHeroGauge() {
  const reduced = usePrefersReducedMotion();
  const [headcount, setHeadcount] = useState(120);
  const [dieselL, setDieselL] = useState(18000);
  const [renewablePct, setRenewablePct] = useState(35);
  const [settled, setSettled] = useState(false);
  const live = reduced || settled;

  const score = useMemo(
    () => demoScore(headcount, dieselL, renewablePct),
    [headcount, dieselL, renewablePct],
  );

  useEffect(() => {
    if (reduced) return;
    const id = window.setTimeout(() => setSettled(true), (heroStage.gauge + 1.6) * 1000);
    return () => window.clearTimeout(id);
  }, [reduced]);

  return (
    <div className="flex w-full max-w-[400px] flex-col items-center">
      <Gauge
        score={score}
        previousScore={null}
        size={360}
        live={live}
        playOnView={false}
        playDelay={heroStage.gauge}
      />
      <InkReveal delay={heroStage.primaryMetric} onMount className="mt-6 w-full">
        <div className="grid w-full gap-4 border-t border-rule pt-5">
          <SliderField
            label="Headcount"
            value={headcount}
            min={10}
            max={500}
            step={5}
            unit="FTE"
            onChange={setHeadcount}
          />
          <SliderField
            label="Diesel"
            value={dieselL}
            min={0}
            max={80000}
            step={500}
            unit="L"
            onChange={setDieselL}
          />
          <SliderField
            label="Renewable"
            value={renewablePct}
            min={0}
            max={100}
            step={1}
            unit="%"
            onChange={setRenewablePct}
          />
        </div>
      </InkReveal>
    </div>
  );
}
