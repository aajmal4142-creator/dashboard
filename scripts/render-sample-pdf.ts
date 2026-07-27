/**
 * Smoke-render the redesigned PDF to disk for visual QA.
 * Usage: pnpm exec tsx scripts/render-sample-pdf.ts
 */
import { writeFileSync } from "node:fs";
import path from "node:path";

import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";

import { ReportPdfDocument } from "../src/lib/reports/ReportPdfDocument";
import type { ReportSnapshot } from "../src/lib/reports/types";
import { REPORT_DISCLAIMER } from "../src/lib/reports/types";

const snapshot: ReportSnapshot = {
  organisationName: "My organisation",
  periodLabel: "FY2026",
  framework: "CSRD_SIMPLIFIED",
  version: 1,
  publishedAt: new Date().toISOString(),
  scores: { overall: 45, e: 100, s: 35, g: 0 },
  emissions: {
    scope1: 0.09799994000000001,
    scope2: 0,
    scope3: 0.0054,
    total: 0.10339994000000001,
    dataQualityPct: 83,
  },
  band: "moderate",
  breakdown: [
    {
      component: "energy",
      contribution: 12.4,
      explanation: "Energy and fuel activity lifts the Environment pillar.",
    },
  ],
  factorsUsed: [
    {
      factorId: "1",
      key: "diesel",
      source: "DEFRA",
      year: 2024,
      value: 2.51233,
    },
    {
      factorId: "2",
      key: "natural_gas",
      source: "DEFRA",
      year: 2024,
      value: 2.04572,
    },
  ],
  materiality: {
    narrative:
      "My organisation double materiality assessment. Material topics centre on climate.",
    points: [
      { esrsTopic: "E1", impactScore: 5, financialScore: 5, material: true },
      { esrsTopic: "E2", impactScore: 1, financialScore: 1, material: false },
      { esrsTopic: "S1", impactScore: 2, financialScore: 1, material: false },
      { esrsTopic: "G1", impactScore: 1, financialScore: 2, material: false },
    ],
  },
  evidenceIndex: [],
  disclaimer: REPORT_DISCLAIMER,
};

const out = path.join(process.cwd(), "clearesg-sample-report.pdf");
const buffer = await renderToBuffer(
  React.createElement(ReportPdfDocument, { snapshot, watermarked: true }),
);
writeFileSync(out, buffer);
console.log(`Wrote ${out} (${buffer.byteLength} bytes)`);
