import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { formatPct, formatTco2e } from "@/lib/reports/pdfFormat";
import { registerReportPdfFonts } from "@/lib/reports/pdfFonts";

import type { EvidencePackManifest } from "./evidencePack";

registerReportPdfFonts();

/** PDF always LIGHT — printed document tokens (hex OK in React-PDF). */
const C = {
  canvas: "#FFFFFF",
  ink: "#1A1714",
  muted: "#6B635A",
  rule: "#E0DAD0",
  accent: "#7A2E2E",
  signal: "#2F5D50",
  rust: "#8B3A2F",
  amber: "#8A6A2F",
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
  mono: {
    fontFamily: "JetBrainsMono",
    fontSize: 8,
  },
  severityHigh: { color: C.rust },
  severityMed: { color: C.amber },
  severityLow: { color: C.muted },
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

export function EvidencePackPdfDocument({
  manifest,
}: {
  manifest: EvidencePackManifest;
}) {
  const e = manifest.emissions;
  const lock = manifest.lockSummary;
  const gaps = manifest.missingDataRegister;
  const factors = manifest.factors;
  const evidence = manifest.evidenceLinks.slice(0, 40);
  const lineage = manifest.lineagePointers.slice(0, 40);

  return (
    <Document
      title={`Evidence pack — ${manifest.organisationName}`}
      author="ClearESG"
      subject="Assurance evidence pack"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.accentRule} />
        <Text style={styles.masthead}>ClearESG · Assurance evidence pack</Text>
        <Text style={styles.title}>{manifest.organisationName}</Text>
        <Text style={styles.meta}>
          {manifest.periodLabel} · {manifest.framework} · {manifest.versionLabel}
        </Text>
        <Text style={styles.meta}>Generated {manifest.generatedAt}</Text>
        {manifest.assuranceLevel ? (
          <Text style={styles.meta}>
            Pathway level (F18): {manifest.assuranceLevel} ·{" "}
            {manifest.pathwayRequiredEvidenceTypes.length} required evidence types
          </Text>
        ) : null}
        <Text style={styles.body}>{manifest.disclaimer}</Text>

        <Text style={styles.h2}>Emissions totals (tCO₂e)</Text>
        <Row label="Scope 1" value={formatTco2e(e.scope1Tco2e)} />
        <Row
          label="Scope 2 — location-based"
          value={formatTco2e(e.scope2LocationTco2e)}
        />
        <Row
          label="Scope 2 — market-based"
          value={e.scope2MarketTco2e == null ? "—" : formatTco2e(e.scope2MarketTco2e)}
        />
        <Row label="Scope 3" value={formatTco2e(e.scope3Tco2e)} />
        <Row label="Total" value={formatTco2e(e.totalTco2e)} />
        <Row label="Data quality" value={formatPct(e.dataQualityPct)} />

        <Text style={styles.h2}>Approval / lock summary</Text>
        <Row label="Report status" value={lock.reportStatus ?? "—"} />
        <Row
          label="Approval step"
          value={
            lock.approvalStep
              ? `${lock.approvalStep} (${lock.approvalChainStatus ?? "—"})`
              : "—"
          }
        />
        <Row label="Locked at" value={lock.lockedAt ?? "—"} />
        <Row label="Published at" value={lock.publishedAt ?? "—"} />
        <Row
          label="Datapoints locked / total"
          value={`${lock.datapointsLocked} / ${lock.datapointsTotal}`}
        />
        <Row
          label="In progress / rejected"
          value={`${lock.datapointsInProgress} / ${lock.datapointsRejected}`}
        />

        <Text style={styles.h2}>Missing-data register</Text>
        {gaps.length === 0 ? (
          <Text style={styles.muted}>No gaps flagged on this snapshot.</Text>
        ) : (
          gaps.map((g) => (
            <View key={g.code} style={{ marginBottom: 6 }}>
              <Text
                style={[
                  styles.label,
                  g.severity === "high"
                    ? styles.severityHigh
                    : g.severity === "medium"
                      ? styles.severityMed
                      : styles.severityLow,
                ]}
              >
                {g.severity.toUpperCase()} · {g.label}
              </Text>
              <Text style={styles.muted}>{g.message}</Text>
            </View>
          ))
        )}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `ClearESG evidence pack · ${manifest.organisationName} · ${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>Factor versions used</Text>
        {factors.length === 0 ? (
          <Text style={styles.muted}>No factors pinned on this version.</Text>
        ) : (
          factors.map((f) => (
            <View key={f.factorId} style={styles.row}>
              <Text style={styles.label}>
                {f.key} · {f.source} {f.year}
              </Text>
              <Text style={styles.value}>
                {f.value} · {f.factorId.slice(0, 10)}
              </Text>
            </View>
          ))
        )}

        <Text style={styles.h2}>Evidence links</Text>
        {evidence.length === 0 ? (
          <Text style={styles.muted}>No evidence attachments indexed.</Text>
        ) : (
          evidence.map((ev) => (
            <View key={ev.evidenceId} style={{ marginBottom: 6 }}>
              <Text style={styles.label}>
                {ev.filename} · {ev.linkState}
              </Text>
              <Text style={styles.mono}>
                {ev.sha256.slice(0, 16)}… · {ev.pathHint}
                {ev.metricKey ? ` · ${ev.metricKey}` : ""}
              </Text>
            </View>
          ))
        )}
        {manifest.evidenceLinks.length > evidence.length ? (
          <Text style={styles.muted}>
            +{manifest.evidenceLinks.length - evidence.length} more in CSV companion.
          </Text>
        ) : null}

        <Text style={styles.h2}>Lineage pointers</Text>
        {lineage.length === 0 ? (
          <Text style={styles.muted}>No datapoint lineage for this period.</Text>
        ) : (
          lineage.map((p) => (
            <View key={p.datapointId} style={{ marginBottom: 5 }}>
              <Text style={styles.label}>
                {p.metricKey} · {p.quality} · {p.evidenceLink}
              </Text>
              <Text style={styles.mono}>
                dp={p.datapointId} · value=
                {p.value == null ? "∅" : formatTco2e(p.value)} · factor=
                {p.factorId?.slice(0, 10) ?? "—"} · evidence=
                {p.evidenceIds.length}
              </Text>
            </View>
          ))
        )}
        {manifest.lineagePointers.length > lineage.length ? (
          <Text style={styles.muted}>
            +{manifest.lineagePointers.length - lineage.length} more in CSV companion.
          </Text>
        ) : null}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `ClearESG evidence pack · ${manifest.organisationName} · ${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
