import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { formatPct, formatScore, formatTco2e } from "@/lib/reports/pdfFormat";
import { registerReportPdfFonts } from "@/lib/reports/pdfFonts";

import type { AudiencePackManifest } from "./audiencePack";

registerReportPdfFonts();

/** PDF always LIGHT — printed document tokens (hex OK in React-PDF). */
const C = {
  canvas: "#FFFFFF",
  ink: "#1A1714",
  muted: "#6B635A",
  rule: "#E0DAD0",
  accent: "#7A2E2E",
  signal: "#2F5D50",
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
    marginBottom: 6,
  },
  meta: {
    fontSize: 9,
    fontFamily: "JetBrainsMono",
    color: C.muted,
    marginBottom: 3,
  },
  h2: {
    fontSize: 13,
    fontFamily: "Fraunces",
    fontWeight: 600,
    marginBottom: 8,
    marginTop: 14,
  },
  body: {
    fontSize: 9,
    fontFamily: "Inter",
    lineHeight: 1.45,
    marginBottom: 4,
    color: C.muted,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: C.rule,
    paddingVertical: 5,
  },
  label: {
    fontSize: 9,
    fontFamily: "Inter",
    color: C.ink,
    flex: 1,
  },
  value: {
    fontSize: 9,
    fontFamily: "JetBrainsMono",
    color: C.ink,
    textAlign: "right",
  },
  muted: {
    fontSize: 8,
    fontFamily: "Inter",
    color: C.muted,
    lineHeight: 1.35,
  },
  placeholderBox: {
    borderWidth: 1,
    borderColor: C.rule,
    padding: 8,
    marginBottom: 8,
  },
  placeholderTitle: {
    fontSize: 10,
    fontFamily: "Fraunces",
    fontWeight: 600,
    marginBottom: 4,
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export function AudiencePackPdfDocument({
  manifest,
}: {
  manifest: AudiencePackManifest;
}) {
  const e = manifest.emissions;
  const scores = manifest.scores;

  return (
    <Document
      title={`Board / investor pack — ${manifest.organisationName}`}
      author="ClearESG"
      subject="Audience board pack"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.accentRule} />
        <Text style={styles.masthead}>ClearESG · Board / investor pack</Text>
        <Text style={styles.title}>{manifest.organisationName}</Text>
        <Text style={styles.meta}>
          {manifest.periodLabel} · {manifest.framework} · {manifest.versionLabel}
        </Text>
        <Text style={styles.meta}>Generated {manifest.generatedAt}</Text>
        <Text style={styles.meta}>
          Kind {manifest.kind} · Audience {manifest.audience}
        </Text>

        <Text style={styles.h2}>Executive KPIs</Text>
        {manifest.kpis.map((k) => (
          <Row key={k.key} label={k.label} value={`${k.display} ${k.unit}`.trim()} />
        ))}

        <Text style={styles.h2}>Emissions summary (tCO₂e)</Text>
        <Row label="Scope 1" value={formatTco2e(e.scope1Tco2e)} />
        <Row label="Scope 2 (location)" value={formatTco2e(e.scope2LocationTco2e)} />
        <Row
          label="Scope 2 (market)"
          value={e.scope2MarketTco2e === null ? "—" : formatTco2e(e.scope2MarketTco2e)}
        />
        <Row label="Scope 3" value={formatTco2e(e.scope3Tco2e)} />
        <Row label="Total" value={formatTco2e(e.totalTco2e)} />
        <Row label="Data quality" value={formatPct(e.dataQualityPct)} />

        <Text style={styles.h2}>Scores</Text>
        <Row label="Overall" value={formatScore(scores.overall)} />
        <Row label="E" value={formatScore(scores.e)} />
        <Row label="S" value={formatScore(scores.s)} />
        <Row label="G" value={formatScore(scores.g)} />
        <Row label="Band" value={manifest.band} />

        {manifest.yoy ? (
          <>
            <Text style={styles.h2}>Year-on-year</Text>
            <Row
              label={`Prior (${manifest.yoy.previousPeriodLabel})`}
              value={`${formatTco2e(manifest.yoy.previousTotalTco2e)} tCO₂e`}
            />
            <Row
              label="Change"
              value={
                manifest.yoy.changePct === null
                  ? "—"
                  : `${manifest.yoy.changePct > 0 ? "+" : ""}${manifest.yoy.changePct.toFixed(1)}%`
              }
            />
          </>
        ) : null}

        <Text style={styles.h2}>Highlights</Text>
        {manifest.highlights.map((h, i) => (
          <Text key={`h-${i}`} style={styles.body}>
            · {h}
          </Text>
        ))}

        {manifest.materialityNarrative ? (
          <>
            <Text style={styles.h2}>Materiality</Text>
            <Text style={styles.body}>{manifest.materialityNarrative}</Text>
          </>
        ) : null}

        <Text style={styles.muted}>{manifest.disclaimer}</Text>
        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `ClearESG board pack · ${manifest.organisationName} · ${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>

      <Page size="A4" style={styles.page}>
        <View style={styles.accentRule} />
        <Text style={styles.masthead}>
          ClearESG · Board / investor pack · Narrative placeholders
        </Text>
        <Text style={styles.h2}>Narrative sections (author to complete)</Text>
        <Text style={styles.body}>
          These prompts are empty templates for board or investor narrative. ClearESG does
          not generate AI copy. Paste management text before circulating.
        </Text>
        {manifest.narrativePlaceholders.map((n) => (
          <View key={n.id} style={styles.placeholderBox}>
            <Text style={styles.placeholderTitle}>{n.title}</Text>
            <Text style={styles.muted}>{n.prompt}</Text>
            <Text style={styles.body}> </Text>
            <Text style={styles.muted}>[Narrative body — leave blank or paste]</Text>
          </View>
        ))}
        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `ClearESG board pack · ${manifest.organisationName} · ${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
