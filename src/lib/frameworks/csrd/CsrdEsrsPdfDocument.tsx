import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { formatPct, formatScore, formatTco2e } from "@/lib/reports/pdfFormat";
import { registerReportPdfFonts } from "@/lib/reports/pdfFonts";
import type { ReportSnapshot } from "@/lib/reports/types";
import type { CsrdCoverageResult } from "./types";

registerReportPdfFonts();

/** PDF always LIGHT — printed document tokens (hex OK in React-PDF). */
const C = {
  canvas: "#FFFFFF",
  ink: "#1A1714",
  muted: "#6B635A",
  rule: "#E0DAD0",
  accent: "#7A2E2E",
  signal: "#0E7C4A",
  amber: "#A16207",
  rust: "#9B2C2C",
} as const;

const styles = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontSize: 10,
    fontFamily: "Inter",
    color: C.ink,
    backgroundColor: C.canvas,
  },
  accentRule: {
    height: 3,
    backgroundColor: C.accent,
    marginBottom: 20,
  },
  masthead: {
    fontSize: 9,
    fontFamily: "Inter",
    fontWeight: 500,
    color: C.accent,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontFamily: "Fraunces",
    fontWeight: 600,
    marginBottom: 6,
  },
  meta: {
    fontSize: 9,
    fontFamily: "JetBrainsMono",
    color: C.muted,
    marginBottom: 3,
  },
  h2: {
    fontSize: 14,
    fontFamily: "Fraunces",
    fontWeight: 600,
    marginBottom: 8,
    marginTop: 14,
  },
  body: {
    fontSize: 10,
    fontFamily: "Inter",
    lineHeight: 1.45,
    marginBottom: 6,
  },
  muted: {
    fontSize: 9,
    fontFamily: "Inter",
    color: C.muted,
    lineHeight: 1.4,
    marginBottom: 4,
  },
  mono: {
    fontFamily: "JetBrainsMono",
    fontSize: 9,
  },
  rule: {
    height: 1,
    backgroundColor: C.rule,
    marginVertical: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: C.rule,
    paddingVertical: 5,
  },
  watermark: {
    position: "absolute",
    top: "42%",
    left: 48,
    right: 48,
    textAlign: "center",
    fontSize: 28,
    fontFamily: "Fraunces",
    color: C.rule,
    opacity: 0.55,
  },
});

function stateColor(state: string): string {
  if (state === "covered" || state === "disclosed") return C.signal;
  if (state === "partial" || state === "incomplete") return C.amber;
  return C.rust;
}

export function CsrdEsrsPdfDocument({
  snapshot,
  coverage,
  watermarked,
}: {
  snapshot: ReportSnapshot;
  coverage?: CsrdCoverageResult | null;
  watermarked?: boolean;
}) {
  const esrs = snapshot.esrsDisclosures;
  const gaps = snapshot.dataGaps ?? [];

  return (
    <Document
      title={`CSRD ESRS filing — ${snapshot.organisationName} — ${snapshot.periodLabel}`}
      author="ClearESG"
      subject="CSRD / ESRS filing-oriented disclosure pack"
    >
      <Page size="A4" style={styles.page}>
        {watermarked ? <Text style={styles.watermark}>ClearESG draft</Text> : null}
        <View style={styles.accentRule} />
        <Text style={styles.masthead}>CLEAR ESG · CSRD / ESRS FILING PACK</Text>
        <Text style={styles.title}>{snapshot.organisationName}</Text>
        <Text style={styles.meta}>{snapshot.periodLabel}</Text>
        <Text style={styles.meta}>Framework: {snapshot.framework}</Text>
        <Text style={styles.meta}>Generated {new Date().toISOString().slice(0, 10)}</Text>
        <View style={styles.rule} />
        <Text style={styles.muted}>
          Filing-oriented artefact from the published report snapshot. Light theme only.
          Not an assurance opinion and not a complete EFRAG XBRL filing.
        </Text>

        <Text style={styles.h2}>Greenhouse gas inventory</Text>
        <View style={styles.row}>
          <Text>Scope 1</Text>
          <Text style={styles.mono}>{formatTco2e(snapshot.emissions.scope1)} tCO₂e</Text>
        </View>
        <View style={styles.row}>
          <Text>Scope 2 (location)</Text>
          <Text style={styles.mono}>
            {formatTco2e(
              snapshot.emissions.scope2LocationBased ?? snapshot.emissions.scope2,
            )}{" "}
            tCO₂e
          </Text>
        </View>
        <View style={styles.row}>
          <Text>Scope 3</Text>
          <Text style={styles.mono}>{formatTco2e(snapshot.emissions.scope3)} tCO₂e</Text>
        </View>
        <View style={styles.row}>
          <Text>Total</Text>
          <Text style={styles.mono}>{formatTco2e(snapshot.emissions.total)} tCO₂e</Text>
        </View>
        <View style={styles.row}>
          <Text>Data quality</Text>
          <Text style={styles.mono}>{formatPct(snapshot.emissions.dataQualityPct)}</Text>
        </View>
        <View style={styles.row}>
          <Text>Overall score</Text>
          <Text style={styles.mono}>
            {formatScore(snapshot.scores.overall)} ({snapshot.band})
          </Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        {watermarked ? <Text style={styles.watermark}>ClearESG draft</Text> : null}
        <Text style={styles.h2}>ESRS narrative disclosures</Text>
        {esrs ? (
          <>
            <Text style={styles.body}>{esrs.governance}</Text>
            <Text style={styles.body}>{esrs.materiality}</Text>
            <Text style={styles.body}>{esrs.sustainabilityStrategy}</Text>
            <View style={styles.rule} />
            <Text style={styles.h2}>ESRS topics</Text>
            {esrs.topics.map((t) => (
              <View key={t.code} style={{ marginBottom: 8 }} wrap={false}>
                <Text style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 10 }}>
                  {t.code} · {t.label}{" "}
                  <Text
                    style={{
                      color: stateColor(t.status),
                      fontFamily: "JetBrainsMono",
                      fontSize: 8,
                    }}
                  >
                    {t.status}
                  </Text>
                </Text>
                <Text style={styles.muted}>{t.narrative}</Text>
              </View>
            ))}
          </>
        ) : (
          <Text style={styles.muted}>
            No ESRS narrative block on this snapshot. Re-publish the report to embed
            disclosures.
          </Text>
        )}
      </Page>

      {coverage ? (
        <Page size="A4" style={styles.page}>
          {watermarked ? <Text style={styles.watermark}>ClearESG draft</Text> : null}
          <Text style={styles.h2}>ESRS Set 1 coverage checklist</Text>
          <Text style={styles.muted}>
            Core {coverage.core.pctCovered}% ({coverage.core.covered}/
            {coverage.core.total}) · Supporting {coverage.supporting.pctCovered}% (
            {coverage.supporting.covered}/{coverage.supporting.total})
          </Text>
          <View style={styles.rule} />
          {coverage.disclosures.map((d) => (
            <View key={d.code} style={styles.row} wrap={false}>
              <Text style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.mono}>{d.code}</Text> {d.label}
              </Text>
              <Text
                style={{
                  color: stateColor(d.state),
                  fontFamily: "JetBrainsMono",
                  fontSize: 8,
                }}
              >
                {d.state}
              </Text>
            </View>
          ))}
        </Page>
      ) : null}

      <Page size="A4" style={styles.page}>
        {watermarked ? <Text style={styles.watermark}>ClearESG draft</Text> : null}
        <Text style={styles.h2}>Data gaps</Text>
        {gaps.length === 0 ? (
          <Text style={styles.muted}>No data gaps flagged on this snapshot.</Text>
        ) : (
          gaps.map((g) => (
            <View key={g.code} style={{ marginBottom: 6 }} wrap={false}>
              <Text style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 9 }}>
                {g.code} · {g.severity}
              </Text>
              <Text style={styles.muted}>{g.message}</Text>
            </View>
          ))
        )}
        <View style={styles.rule} />
        <Text style={styles.muted}>{snapshot.disclaimer}</Text>
      </Page>
    </Document>
  );
}
