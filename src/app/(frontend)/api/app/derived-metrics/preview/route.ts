import { getPayload } from "payload";
import { NextResponse } from "next/server";

import { getCurrentContext, isNextRedirectError } from "@/lib/auth";
import {
  buildAllowedFormulaKeys,
  evaluateFormula,
  findMetricDefinitionKeys,
  formulaKeys,
  parsePreviewBody,
} from "@/lib/derive";
import config from "@/payload.config";

/** POST /api/app/derived-metrics/preview — evaluate formula with sample or period data. */
export async function POST(req: Request) {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const payload = await getPayload({ config });
    const rawKeys = await findMetricDefinitionKeys(payload);
    const { allowed } = buildAllowedFormulaKeys(rawKeys);

    const parsed = parsePreviewBody(body, allowed);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const keys = formulaKeys(parsed.data.formula);
    const values: Record<string, number | null> = {};

    for (const k of keys) {
      values[k] = null;
    }

    if (parsed.data.sampleValues) {
      for (const [k, v] of Object.entries(parsed.data.sampleValues)) {
        values[k] = v;
      }
    }

    let periodLabel: string | null = null;

    if (parsed.data.periodId) {
      let period: { id: string; label?: string | null; organisation?: unknown };
      try {
        period = await payload.findByID({
          collection: "reporting-periods",
          id: parsed.data.periodId,
          depth: 0,
          overrideAccess: true,
        });
      } catch {
        return NextResponse.json({ error: "Period not found." }, { status: 404 });
      }

      const org =
        period.organisation == null
          ? null
          : typeof period.organisation === "string"
            ? period.organisation
            : (period.organisation as { id: string }).id;

      if (org !== ctx.activeOrg.id) {
        return NextResponse.json({ error: "Period not found." }, { status: 404 });
      }

      periodLabel =
        typeof period.label === "string" && period.label
          ? period.label
          : parsed.data.periodId;

      if (keys.length > 0) {
        const dps = await payload.find({
          collection: "datapoints",
          where: {
            and: [
              { organisation: { equals: ctx.activeOrg.id } },
              { period: { equals: parsed.data.periodId } },
              { metricKey: { in: keys } },
            ],
          },
          limit: 500,
          depth: 0,
          overrideAccess: true,
        });

        for (const dp of dps.docs) {
          const metricKey = dp.metricKey;
          if (typeof metricKey !== "string") continue;
          if (typeof dp.value === "number" && Number.isFinite(dp.value)) {
            values[metricKey] = dp.value;
          }
        }
      }
    }

    const result = evaluateFormula(parsed.data.formula, values, allowed);

    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        error: result.error,
        keys: result.keys,
        missingKeys: result.missingKeys ?? [],
        values,
        periodLabel,
      });
    }

    return NextResponse.json({
      ok: true,
      value: result.value,
      keys: result.keys,
      values,
      periodLabel,
      expression: parsed.data.formula,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error previewing derived metric:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
