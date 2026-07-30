import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { registerReportPdfFonts } from "@/lib/reports/pdfFonts";

import { INDUSTRY_LABELS, type ComplianceAssessmentSnapshot } from "./types";

registerReportPdfFonts();

/** PDF always LIGHT — printed document tokens (hex OK in React-PDF). */
const C = {
  canvas: "#FFFFFF",
  ink: "#1A1714",
  muted: "#6B635A",
  rule: "#E0DAD0",
  accent: "#7A2E2E",
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
    marginBottom: 24,
  },
  masthead: {
    fontSize: 9,
    fontFamily: "Inter",
    fontWeight: 500,
    color: C.accent,
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontFamily: "Fraunces",
    fontWeight: 600,
    marginBottom: 8,
  },
  meta: {
    fontSize: 10,
    fontFamily: "JetBrainsMono",
    color: C.muted,
    marginBottom: 4,
  },
  h2: {
    fontSize: 14,
    fontFamily: "Fraunces",
    fontWeight: 600,
    marginBottom: 8,
    marginTop: 4,
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
  },
  mono: {
    fontFamily: "JetBrainsMono",
    fontSize: 10,
  },
  rule: {
    height: 1,
    backgroundColor: C.rule,
    marginVertical: 12,
  },
  qLabel: {
    fontSize: 9,
    fontFamily: "Inter",
    fontWeight: 500,
    color: C.accent,
    marginBottom: 2,
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 48,
    right: 48,
    fontSize: 8,
    fontFamily: "Inter",
    color: C.muted,
  },
});

function formatValue(
  value: string | number | boolean | null,
  unit: string | null,
): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    const n = Number.isInteger(value)
      ? String(value)
      : value
          .toFixed(4)
          .replace(/(\.\d*?[1-9])0+$/, "$1")
          .replace(/\.0+$/, "");
    return unit ? `${n} ${unit}` : n;
  }
  return unit ? `${String(value)} ${unit}` : String(value);
}

export function ComplianceAssessmentPdfDocument({
  snapshot,
  watermarked = false,
}: {
  snapshot: ComplianceAssessmentSnapshot;
  watermarked?: boolean;
}) {
  const industryLabel = snapshot.industry ? INDUSTRY_LABELS[snapshot.industry] : null;

  return (
    <Document
      title={`${snapshot.title} — ${snapshot.organisationName}`}
      author="ClearESG"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.accentRule} />
        <Text style={styles.masthead}>ClearESG · Custom compliance assessment</Text>
        <Text style={styles.title}>{snapshot.title}</Text>
        <Text style={styles.meta}>{snapshot.organisationName}</Text>
        <Text style={styles.meta}>
          Year {snapshot.reportingYear} · {snapshot.status}
          {industryLabel ? ` · ${industryLabel}` : ""}
        </Text>
        <Text style={styles.meta}>Template {snapshot.templateName}</Text>
        <Text style={styles.meta}>
          Prepared {snapshot.publishedAt.slice(0, 10)}
          {snapshot.preparedBy?.name ? ` · ${snapshot.preparedBy.name}` : ""}
        </Text>
        {watermarked ? (
          <Text style={{ ...styles.muted, marginTop: 8, color: C.accent }}>
            Draft / plan watermark — upgrade for unwatermarked export.
          </Text>
        ) : null}

        {snapshot.sections.map((section) => (
          <View key={section.sectionKey} style={{ marginTop: 16 }}>
            <View style={styles.rule} />
            <Text style={styles.h2}>{section.title}</Text>
            {section.questions.map((q) => (
              <View key={q.questionId} style={{ marginBottom: 10 }}>
                <Text style={styles.qLabel}>
                  {q.label}
                  {q.required ? " · required" : ""}
                </Text>
                <Text style={styles.muted}>{q.prompt}</Text>
                <Text style={{ ...styles.body, marginTop: 4 }}>
                  {formatValue(q.value, q.unit)}
                </Text>
              </View>
            ))}
            {section.calculations.map((c) => (
              <View key={c.calcId} style={{ marginBottom: 8 }}>
                <Text style={styles.qLabel}>{c.label} · calculated</Text>
                <Text style={styles.mono}>
                  {c.quality === "calculated"
                    ? formatValue(c.value, c.unit)
                    : "Missing inputs"}
                </Text>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.rule} />
        <Text style={styles.muted}>{snapshot.disclaimer}</Text>
        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `ClearESG compliance assessment · ${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
