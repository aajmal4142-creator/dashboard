import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { registerReportPdfFonts } from "@/lib/reports/pdfFonts";

import type { IssbDisclosureSnapshot } from "./types";

registerReportPdfFonts();

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
  mono: { fontFamily: "JetBrainsMono", fontSize: 10 },
  rule: { height: 1, backgroundColor: C.rule, marginVertical: 12 },
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

export function IssbPdfDocument({
  snapshot,
  watermarked = false,
}: {
  snapshot: IssbDisclosureSnapshot;
  watermarked?: boolean;
}) {
  return (
    <Document
      title={`ISSB ${snapshot.reportingYear} — ${snapshot.organisationName}`}
      author="ClearESG"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.accentRule} />
        <Text style={styles.masthead}>ClearESG · ISSB S1 / S2 disclosure</Text>
        <Text style={styles.title}>ISSB Report</Text>
        <Text style={styles.meta}>{snapshot.organisationName}</Text>
        <Text style={styles.meta}>
          Year {snapshot.reportingYear} · {snapshot.versionLabel}
        </Text>
        <Text style={styles.meta}>
          Prepared {snapshot.publishedAt.slice(0, 10)}
          {snapshot.preparedBy?.name ? ` · ${snapshot.preparedBy.name}` : ""}
        </Text>
        {snapshot.linkedTcfdId ? (
          <Text style={{ ...styles.muted, marginTop: 8 }}>
            S2 climate linked to TCFD disclosure {snapshot.linkedTcfdId}
          </Text>
        ) : null}
        {watermarked ? (
          <Text style={{ ...styles.muted, marginTop: 8, color: C.accent }}>
            Draft / plan watermark — upgrade for unwatermarked export.
          </Text>
        ) : null}
        {snapshot.emissions ? (
          <View style={{ marginTop: 20 }}>
            <Text style={styles.h2}>Climate metrics (S2)</Text>
            <Text style={styles.mono}>
              Scope 1 {snapshot.emissions.scope1.toFixed(2)} · Scope 2{" "}
              {snapshot.emissions.scope2.toFixed(2)} · Scope 3{" "}
              {snapshot.emissions.scope3.toFixed(2)} tCO₂e
            </Text>
            <Text style={{ ...styles.mono, marginTop: 4 }}>
              Total {snapshot.emissions.total.toFixed(2)} tCO₂e
            </Text>
          </View>
        ) : null}
        <View style={styles.rule} />
        <Text style={styles.muted}>{snapshot.disclaimer}</Text>
        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `ClearESG ISSB · ${snapshot.organisationName} · ${pageNumber}/${totalPages}`
          }
          fixed
        />
      </Page>

      <Page size="A4" style={styles.page}>
        <View style={styles.accentRule} />
        <Text style={styles.masthead}>ISSB · S1 General</Text>
        <Text style={styles.h2}>S1 — General sustainability disclosures</Text>
        {snapshot.s1.map((q) => (
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
            `ClearESG ISSB · ${snapshot.organisationName} · ${pageNumber}/${totalPages}`
          }
          fixed
        />
      </Page>

      <Page size="A4" style={styles.page}>
        <View style={styles.accentRule} />
        <Text style={styles.masthead}>ISSB · S2 Climate</Text>
        <Text style={styles.h2}>S2 — Climate (extends TCFD)</Text>
        {snapshot.s2.map((q) => (
          <View key={q.id} style={{ marginBottom: 14 }} wrap={false}>
            <Text style={styles.qLabel}>
              {q.label}
              {q.tcfdPillar ? ` · TCFD ${q.tcfdPillar}` : ""}
              {q.autoFilled ? " · inherited/auto" : ""}
            </Text>
            <Text style={{ ...styles.muted, marginBottom: 4 }}>{q.prompt}</Text>
            <Text style={styles.body}>{q.answer}</Text>
          </View>
        ))}
        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `ClearESG ISSB · ${snapshot.organisationName} · ${pageNumber}/${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
