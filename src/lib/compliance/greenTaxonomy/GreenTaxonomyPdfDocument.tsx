import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { registerReportPdfFonts } from "@/lib/reports/pdfFonts";

import type { TaxonomyAlignmentReport } from "./types";

registerReportPdfFonts();

/** PDF always LIGHT — printed document tokens (hex OK in React-PDF). */
const C = {
  canvas: "#FFFFFF",
  ink: "#1A1714",
  muted: "#6B635A",
  rule: "#E0DAD0",
  accent: "#7A2E2E",
  signal: "#0E7C4A",
  amber: "#B45309",
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
    fontSize: 22,
    fontFamily: "Fraunces",
    fontWeight: 600,
    marginBottom: 8,
  },
  meta: {
    fontSize: 10,
    fontFamily: "JetBrainsMono",
    color: C.muted,
    marginBottom: 3,
  },
  overall: {
    fontSize: 14,
    fontFamily: "JetBrainsMono",
    fontWeight: 500,
    marginTop: 12,
    marginBottom: 4,
  },
  rule: {
    height: 1,
    backgroundColor: C.rule,
    marginVertical: 12,
  },
  h2: {
    fontSize: 13,
    fontFamily: "Fraunces",
    fontWeight: 600,
    marginBottom: 8,
    marginTop: 4,
    color: C.accent,
  },
  row: {
    flexDirection: "row",
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: C.rule,
  },
  colLabel: { width: "42%", fontSize: 9 },
  colNum: {
    width: "14%",
    fontSize: 9,
    fontFamily: "JetBrainsMono",
    textAlign: "right",
  },
  gap: {
    fontSize: 9,
    color: C.muted,
    marginBottom: 4,
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 48,
    right: 48,
    fontSize: 8,
    color: C.muted,
    fontFamily: "Inter",
  },
});

export type GreenTaxonomyPdfProps = {
  organisationName: string;
  assessmentId: string;
  status: string;
  report: TaxonomyAlignmentReport;
  generatedAt: string;
};

export function GreenTaxonomyPdfDocument(props: GreenTaxonomyPdfProps) {
  const { organisationName, assessmentId, status, report, generatedAt } = props;
  const overall =
    report.overallAlignmentPercent === null ? "—" : `${report.overallAlignmentPercent}%`;

  return (
    <Document title={`EU Green Taxonomy — ${organisationName}`} author="ClearESG">
      <Page size="A4" style={styles.page}>
        <View style={styles.accentRule} />
        <Text style={styles.masthead}>ClearESG · EU Green Taxonomy</Text>
        <Text style={styles.title}>Taxonomy alignment assessment</Text>
        <Text style={styles.meta}>{organisationName}</Text>
        <Text style={styles.meta}>
          NACE {report.naceCode}
          {report.naceName ? ` — ${report.naceName}` : ""}
        </Text>
        <Text style={styles.meta}>
          Status {status} · Assessment {assessmentId}
        </Text>
        <Text style={styles.meta}>Generated {generatedAt}</Text>

        <Text style={styles.overall}>Overall alignment {overall}</Text>
        <Text style={styles.meta}>
          Applicable objectives {report.applicableCount} · Non-applicable{" "}
          {report.nonApplicableCount} (excluded from overall) · Fully aligned{" "}
          {report.fullyAlignedCount}
        </Text>
        {report.euAveragePercent !== null ? (
          <Text style={styles.meta}>
            EU peer reference (section): {report.euAveragePercent}%
          </Text>
        ) : null}

        <View style={styles.rule} />
        <Text style={styles.h2}>Alignment by objective</Text>
        <View style={styles.row}>
          <Text style={[styles.colLabel, { fontWeight: 600 }]}>Objective</Text>
          <Text style={[styles.colNum, { fontWeight: 600 }]}>Appl.</Text>
          <Text style={[styles.colNum, { fontWeight: 600 }]}>Align %</Text>
          <Text style={[styles.colNum, { fontWeight: 600 }]}>Criteria</Text>
          <Text style={[styles.colNum, { fontWeight: 600 }]}>DNSH</Text>
        </View>
        {report.objectives.map((o) => (
          <View key={o.objective} style={styles.row}>
            <Text style={styles.colLabel}>{o.label}</Text>
            <Text style={styles.colNum}>{o.applicable ? "Yes" : "No"}</Text>
            <Text style={styles.colNum}>
              {o.alignmentPercent === null ? "—" : `${o.alignmentPercent}%`}
            </Text>
            <Text style={styles.colNum}>
              {o.applicable ? `${o.criteriaMet}/${o.criteriaTotal}` : "—"}
            </Text>
            <Text style={styles.colNum}>
              {o.applicable ? `${o.dnshCompliant}/${o.dnshTotal}` : "—"}
            </Text>
          </View>
        ))}

        <View style={styles.rule} />
        <Text style={styles.h2}>Gap analysis</Text>
        {report.gaps.length === 0 ? (
          <Text style={styles.gap}>
            No screening or DNSH gaps on applicable objectives.
          </Text>
        ) : (
          report.gaps.map((g) => (
            <View key={g.objective} style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 10, fontWeight: 600, marginBottom: 2 }}>
                {g.label}
              </Text>
              {g.missingCriteria.length > 0 ? (
                <Text style={styles.gap}>
                  Missing {g.missingCriteria.length} screening criteria:{" "}
                  {g.missingCriteria.join("; ")}
                </Text>
              ) : null}
              {g.missingDnsh.length > 0 ? (
                <Text style={styles.gap}>
                  Missing {g.missingDnsh.length} DNSH criteria: {g.missingDnsh.join("; ")}
                </Text>
              ) : null}
            </View>
          ))
        )}

        <Text style={styles.footer}>
          Regulation (EU) 2020/852 · Non-applicable objectives excluded from overall
          alignment · ClearESG questionnaire screening (not a substitute for legal
          taxonomy disclosure).
        </Text>
      </Page>
    </Document>
  );
}
