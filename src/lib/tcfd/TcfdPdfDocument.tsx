import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { registerReportPdfFonts } from "@/lib/reports/pdfFonts";

import type { TcfdDisclosureSnapshot } from "./types";

registerReportPdfFonts();

/** PDF always LIGHT — printed document tokens (hex OK in React-PDF). */
const C = {
  canvas: "#FFFFFF",
  ink: "#1A1714",
  muted: "#6B635A",
  rule: "#E0DAD0",
  accent: "#7A2E2E",
  signal: "#0E7C4A",
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
    fontSize: 28,
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
    fontSize: 16,
    fontFamily: "Fraunces",
    fontWeight: 600,
    marginBottom: 8,
    marginTop: 4,
  },
  body: {
    fontSize: 10,
    fontFamily: "Inter",
    lineHeight: 1.45,
    marginBottom: 8,
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

function formatTco2e(n: number): string {
  return `${n.toFixed(2)} tCO₂e`;
}

export function TcfdPdfDocument({
  snapshot,
  watermarked = false,
}: {
  snapshot: TcfdDisclosureSnapshot;
  watermarked?: boolean;
}) {
  return (
    <Document
      title={`TCFD ${snapshot.reportingYear} — ${snapshot.organisationName}`}
      author="ClearESG"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.accentRule} />
        <Text style={styles.masthead}>ClearESG · TCFD climate disclosure</Text>
        <Text style={styles.title}>TCFD Report</Text>
        <Text style={styles.meta}>{snapshot.organisationName}</Text>
        <Text style={styles.meta}>
          Year {snapshot.reportingYear} · {snapshot.versionLabel}
        </Text>
        <Text style={styles.meta}>
          Prepared {snapshot.publishedAt.slice(0, 10)}
          {snapshot.preparedBy?.name ? ` · ${snapshot.preparedBy.name}` : ""}
        </Text>
        {watermarked ? (
          <Text style={{ ...styles.muted, marginTop: 8, color: C.accent }}>
            Draft / plan watermark — upgrade for unwatermarked export.
          </Text>
        ) : null}
        {snapshot.emissions ? (
          <View style={{ marginTop: 20 }}>
            <Text style={styles.h2}>Emissions summary</Text>
            <Text style={styles.mono}>
              Scope 1 {formatTco2e(snapshot.emissions.scope1)} · Scope 2{" "}
              {formatTco2e(snapshot.emissions.scope2)} · Scope 3{" "}
              {formatTco2e(snapshot.emissions.scope3)}
            </Text>
            <Text style={{ ...styles.mono, marginTop: 4 }}>
              Total {formatTco2e(snapshot.emissions.total)}
              {snapshot.emissions.emissionsStandard
                ? ` · ${snapshot.emissions.emissionsStandard}`
                : ""}
            </Text>
            {snapshot.yoy ? (
              <Text style={{ ...styles.muted, marginTop: 6 }}>
                vs {snapshot.yoy.previousYear}:{" "}
                {snapshot.yoy.previousTotal != null
                  ? formatTco2e(snapshot.yoy.previousTotal)
                  : "—"}
                {snapshot.yoy.changePct != null
                  ? ` (${snapshot.yoy.changePct >= 0 ? "+" : ""}${snapshot.yoy.changePct.toFixed(1)}%)`
                  : ""}
              </Text>
            ) : null}
          </View>
        ) : null}
        <View style={styles.rule} />
        <Text style={styles.muted}>{snapshot.disclaimer}</Text>
        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `ClearESG TCFD · ${snapshot.organisationName} · ${pageNumber}/${totalPages}`
          }
          fixed
        />
      </Page>

      {snapshot.pillars.map((pillar) => (
        <Page key={pillar.pillar} size="A4" style={styles.page}>
          <View style={styles.accentRule} />
          <Text style={styles.masthead}>TCFD · {pillar.title}</Text>
          <Text style={styles.h2}>{pillar.title}</Text>
          {pillar.questions.map((q) => (
            <View key={q.id} style={{ marginBottom: 14 }} wrap={false}>
              <Text style={styles.qLabel}>
                {q.label}
                {q.autoFilled ? " · auto-populated" : ""}
              </Text>
              <Text style={{ ...styles.muted, marginBottom: 4 }}>{q.prompt}</Text>
              <Text style={styles.body}>{q.answer}</Text>
            </View>
          ))}
          <Text
            style={styles.footer}
            render={({ pageNumber, totalPages }) =>
              `ClearESG TCFD · ${snapshot.organisationName} · ${pageNumber}/${totalPages}`
            }
            fixed
          />
        </Page>
      ))}

      {snapshot.scenarios.length > 0 ? (
        <Page size="A4" style={styles.page}>
          <View style={styles.accentRule} />
          <Text style={styles.masthead}>TCFD · Strategy scenarios</Text>
          <Text style={styles.h2}>Linked ClearESG scenarios</Text>
          {snapshot.scenarios.map((s) => (
            <View key={s.id} style={{ marginBottom: 10 }}>
              <Text style={styles.body}>
                {s.name} ({s.type}) — {s.reductionPercent}% {s.baselineYear}→
                {s.targetYear}
                {s.category ? ` · ${s.category}` : ""}
              </Text>
            </View>
          ))}
          <Text
            style={styles.footer}
            render={({ pageNumber, totalPages }) =>
              `ClearESG TCFD · ${snapshot.organisationName} · ${pageNumber}/${totalPages}`
            }
            fixed
          />
        </Page>
      ) : null}
    </Document>
  );
}
