import {
  Circle,
  Document,
  G,
  Line,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";

import { registerReportPdfFonts } from "./pdfFonts";
import {
  bandLabel,
  formatPct,
  formatPublishedAt,
  formatScore,
  formatTco2e,
  reportFrameworkLabel,
  topicLabel,
} from "./pdfFormat";
import type { ReportSnapshot } from "./types";

registerReportPdfFonts();

/** PDF always LIGHT — printed document tokens (hex OK in React-PDF). */
const C = {
  canvas: "#FFFFFF",
  surface1: "#FFFFFF",
  surface2: "#F4F4F4",
  ink: "#1A1714",
  muted: "#6B635A",
  rule: "#E0DAD0",
  ruleStrong: "#C4BBAE",
  accent: "#7A2E2E",
  signal: "#0E7C4A",
  amber: "#B87309",
  rust: "#B03A2E",
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
  coverPage: {
    paddingTop: 44,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontFamily: "Inter",
    color: C.ink,
    backgroundColor: C.canvas,
  },
  accentRule: {
    height: 3,
    backgroundColor: C.accent,
    marginBottom: 28,
  },
  masthead: {
    fontSize: 9,
    fontFamily: "Inter",
    fontWeight: 500,
    color: C.accent,
    marginBottom: 20,
  },
  coverTitle: {
    fontSize: 42,
    fontFamily: "Fraunces",
    fontWeight: 600,
    color: C.ink,
    lineHeight: 1.05,
    marginBottom: 10,
  },
  coverOrg: {
    fontSize: 16,
    fontFamily: "Inter",
    fontWeight: 500,
    color: C.ink,
    marginBottom: 6,
  },
  coverMeta: {
    fontSize: 10,
    fontFamily: "JetBrainsMono",
    color: C.muted,
    marginBottom: 4,
  },
  sectionEyebrow: {
    fontSize: 8,
    fontFamily: "Inter",
    fontWeight: 500,
    color: C.accent,
    marginBottom: 6,
  },
  h2: {
    fontSize: 18,
    fontFamily: "Fraunces",
    fontWeight: 600,
    color: C.ink,
    marginBottom: 10,
  },
  body: {
    fontSize: 10,
    fontFamily: "Inter",
    color: C.ink,
    lineHeight: 1.45,
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
    color: C.ink,
  },
  monoSm: {
    fontFamily: "JetBrainsMono",
    fontSize: 8,
    color: C.muted,
  },
  rule: {
    height: 1,
    backgroundColor: C.rule,
    marginVertical: 14,
  },
  scoreBig: {
    fontFamily: "JetBrainsMono",
    fontWeight: 500,
    fontSize: 48,
    textAlign: "center",
    color: C.ink,
    marginTop: 2,
  },
  scoreLabel: {
    fontSize: 9,
    fontFamily: "Inter",
    fontWeight: 500,
    color: C.muted,
    textAlign: "center",
  },
  bandChip: {
    marginTop: 10,
    alignSelf: "center",
    borderWidth: 1,
    borderColor: C.ruleStrong,
    backgroundColor: C.surface1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  bandChipText: {
    fontSize: 8,
    fontFamily: "Inter",
    fontWeight: 500,
    color: C.ink,
  },
  cardRow: {
    flexDirection: "row",
    marginTop: 8,
  },
  card: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.rule,
    backgroundColor: C.surface1,
    padding: 12,
    marginRight: 8,
  },
  cardLast: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.rule,
    backgroundColor: C.surface1,
    padding: 12,
    marginRight: 0,
  },
  cardLabel: {
    fontSize: 8,
    fontFamily: "Inter",
    fontWeight: 500,
    color: C.muted,
    marginBottom: 6,
  },
  cardValue: {
    fontFamily: "JetBrainsMono",
    fontWeight: 500,
    fontSize: 22,
    color: C.ink,
  },
  cardHint: {
    marginTop: 4,
    fontSize: 8,
    fontFamily: "Inter",
    color: C.muted,
  },
  table: {
    borderWidth: 1,
    borderColor: C.rule,
    backgroundColor: C.surface1,
    marginTop: 6,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: C.surface2,
    borderBottomWidth: 1,
    borderBottomColor: C.rule,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: C.rule,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  tableRowLast: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  colLabel: { flex: 1.4, fontSize: 9, fontFamily: "Inter", color: C.ink },
  colValue: {
    flex: 1,
    fontSize: 9,
    fontFamily: "JetBrainsMono",
    color: C.ink,
    textAlign: "right",
  },
  colHeader: {
    flex: 1,
    fontSize: 8,
    fontFamily: "Inter",
    fontWeight: 500,
    color: C.muted,
  },
  colHeaderValue: {
    flex: 1,
    fontSize: 8,
    fontFamily: "Inter",
    fontWeight: 500,
    color: C.muted,
    textAlign: "right",
  },
  footer: {
    position: "absolute",
    left: 48,
    right: 48,
    bottom: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: C.rule,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    fontFamily: "Inter",
    color: C.muted,
  },
  footerMono: {
    fontSize: 7,
    fontFamily: "JetBrainsMono",
    color: C.muted,
  },
  watermark: {
    position: "absolute",
    top: 320,
    left: 40,
    right: 40,
    fontSize: 14,
    fontFamily: "Inter",
    color: C.ruleStrong,
    opacity: 0.35,
    textAlign: "center",
    transform: "rotate(-24deg)",
  },
  disclaimerBox: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: C.rule,
    backgroundColor: C.surface2,
    padding: 12,
  },
  stackBar: {
    height: 14,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: C.rule,
    marginTop: 8,
  },
});

function PageFooter({ org, version }: { org: string; version: number }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>
        ClearESG · {org} · v{version}
      </Text>
      <Text
        style={styles.footerMono}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

function PdfGauge({ score, size = 220 }: { score: number; size?: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const startAngle = -210;
  const sweep = 240;
  const cx = size / 2;
  const cy = size / 2 + size * 0.06;
  const r = size * 0.38;
  const progress = clamped / 100;
  const band = clamped >= 70 ? C.signal : clamped >= 45 ? C.amber : C.rust;

  function polar(angleDeg: number, radius: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: Math.round((cx + radius * Math.cos(rad)) * 100) / 100,
      y: Math.round((cy + radius * Math.sin(rad)) * 100) / 100,
    };
  }

  const start = polar(startAngle, r);
  const end = polar(startAngle + sweep, r);
  const mid = polar(startAngle + sweep * progress, r);
  const large = sweep * progress > 180 ? 1 : 0;
  const fillPath = `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${mid.x} ${mid.y}`;
  const trackPath = `M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${end.x} ${end.y}`;
  const needleAngle = startAngle + 90 + sweep * progress;
  const tip = polar(needleAngle - 90, r - 14);
  const ticks = [0, 20, 40, 60, 80, 100];

  return (
    <View style={{ alignItems: "center", marginTop: 28, marginBottom: 8 }}>
      <Svg width={size} height={size * 0.72} viewBox={`0 0 ${size} ${size * 0.72}`}>
        <Circle
          cx={cx}
          cy={cy}
          r={r + 24}
          fill={C.surface2}
          stroke={C.rule}
          strokeWidth={1}
        />
        <Path d={trackPath} stroke={C.ruleStrong} strokeWidth={1.25} fill="none" />
        <Path d={fillPath} stroke={band} strokeWidth={4} fill="none" />
        {ticks.map((v) => {
          const a = startAngle + sweep * (v / 100);
          const outer = polar(a, r - 3);
          const inner = polar(a, r - 12);
          return (
            <G key={v}>
              <Line
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke={C.ink}
                strokeWidth={v % 40 === 0 ? 1.35 : 1}
              />
            </G>
          );
        })}
        <Line x1={cx} y1={cy} x2={tip.x} y2={tip.y} stroke={C.accent} strokeWidth={2} />
        <Circle
          cx={cx}
          cy={cy}
          r={7}
          fill={C.surface1}
          stroke={C.ruleStrong}
          strokeWidth={1}
        />
        <Circle cx={cx} cy={cy} r={3} fill={C.accent} />
      </Svg>
      <Text style={styles.scoreBig}>{formatScore(clamped)}</Text>
      <Text style={styles.scoreLabel}>Overall score</Text>
    </View>
  );
}

function EmissionsStack({
  scope1,
  scope2,
  scope3,
}: {
  scope1: number;
  scope2: number;
  scope3: number;
}) {
  const total = scope1 + scope2 + scope3;
  if (total <= 0) {
    return (
      <Text style={styles.muted}>
        No emissions calculated yet. Enter activity data to populate Scope 1–3.
      </Text>
    );
  }
  const p1 = (scope1 / total) * 100;
  const p2 = (scope2 / total) * 100;
  const p3 = (scope3 / total) * 100;
  return (
    <View>
      <View style={styles.stackBar}>
        {p1 > 0 ? (
          <View style={{ width: `${p1}%`, backgroundColor: C.rust, height: "100%" }} />
        ) : null}
        {p2 > 0 ? (
          <View style={{ width: `${p2}%`, backgroundColor: C.amber, height: "100%" }} />
        ) : null}
        {p3 > 0 ? (
          <View style={{ width: `${p3}%`, backgroundColor: "#2F5D8C", height: "100%" }} />
        ) : null}
      </View>
      <View
        style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}
      >
        <Text style={styles.monoSm}>Scope 1 {formatTco2e(scope1)}</Text>
        <Text style={styles.monoSm}>Scope 2 {formatTco2e(scope2)}</Text>
        <Text style={styles.monoSm}>Scope 3 {formatTco2e(scope3)}</Text>
      </View>
    </View>
  );
}

export function ReportPdfDocument({
  snapshot,
  watermarked = false,
}: {
  snapshot: ReportSnapshot;
  watermarked?: boolean;
}) {
  const framework = reportFrameworkLabel(snapshot.framework);
  const material = snapshot.materiality.points.filter((p) => p.material);
  const below = snapshot.materiality.points.filter((p) => !p.material);
  const published = formatPublishedAt(snapshot.publishedAt);
  const topBreakdown = snapshot.breakdown.slice(0, 5);

  return (
    <Document
      title={`${snapshot.organisationName} — ClearESG Report v${snapshot.version}`}
      author="ClearESG"
      subject={`${framework} sustainability report`}
      creator="ClearESG"
    >
      {/* —— Cover —— */}
      <Page size="A4" style={styles.coverPage}>
        {watermarked ? <Text style={styles.watermark}>ClearESG</Text> : null}
        <View style={styles.accentRule} />
        <Text style={styles.masthead}>CLEARESG REPORT</Text>
        <Text style={styles.coverTitle}>Sustainability{"\n"}performance</Text>
        <Text style={styles.coverOrg}>{snapshot.organisationName}</Text>
        <Text style={styles.coverMeta}>
          {snapshot.periodLabel} · {framework} · Version {snapshot.version}
        </Text>
        <Text style={styles.coverMeta}>Published {published}</Text>

        <PdfGauge score={snapshot.scores.overall} />
        <View style={styles.bandChip}>
          <Text style={styles.bandChipText}>{bandLabel(snapshot.band)} readiness</Text>
        </View>

        <View style={{ marginTop: 36 }}>
          <Text style={styles.muted}>
            Prepared for banks, buyers, and auditors. Figures are reproducible from pinned
            emission factors and management-reported activity data.
          </Text>
        </View>
        <PageFooter org={snapshot.organisationName} version={snapshot.version} />
      </Page>

      {/* —— Performance —— */}
      <Page size="A4" style={styles.page}>
        {watermarked ? <Text style={styles.watermark}>ClearESG</Text> : null}
        <Text style={styles.sectionEyebrow}>01 — Performance</Text>
        <Text style={styles.h2}>Scores and emissions</Text>
        <Text style={styles.body}>
          Overall score {formatScore(snapshot.scores.overall)} of 100 (
          {bandLabel(snapshot.band)}). Environment, Social, and Governance pillars are
          scored separately from the same period datapoints.
        </Text>

        <View style={styles.cardRow}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Environment</Text>
            <Text style={styles.cardValue}>{formatScore(snapshot.scores.e)}</Text>
            <Text style={styles.cardHint}>E pillar</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Social</Text>
            <Text style={styles.cardValue}>{formatScore(snapshot.scores.s)}</Text>
            <Text style={styles.cardHint}>S pillar</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Governance</Text>
            <Text style={styles.cardValue}>{formatScore(snapshot.scores.g)}</Text>
            <Text style={styles.cardHint}>G pillar</Text>
          </View>
          <View style={styles.cardLast}>
            <Text style={styles.cardLabel}>Data quality</Text>
            <Text style={styles.cardValue}>
              {formatPct(snapshot.emissions.dataQualityPct)}
            </Text>
            <Text style={styles.cardHint}>Measured / calculated share</Text>
          </View>
        </View>

        <View style={styles.rule} />
        <Text style={styles.sectionEyebrow}>Greenhouse gas inventory</Text>
        <Text style={styles.h2}>Emissions (tCO2e)</Text>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.colHeader, { flex: 1.4 }]}>Scope</Text>
            <Text style={styles.colHeaderValue}>tCO2e</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.colLabel}>Scope 1 — direct</Text>
            <Text style={styles.colValue}>{formatTco2e(snapshot.emissions.scope1)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.colLabel}>Scope 2 — purchased energy</Text>
            <Text style={styles.colValue}>{formatTco2e(snapshot.emissions.scope2)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.colLabel}>Scope 3 — value chain</Text>
            <Text style={styles.colValue}>{formatTco2e(snapshot.emissions.scope3)}</Text>
          </View>
          {typeof snapshot.emissions.scope3PrimarySharePct === "number" &&
          (snapshot.emissions.scope3PrimaryTco2e ?? 0) +
            (snapshot.emissions.scope3EstimateTco2e ?? 0) >
            0 ? (
            <View style={styles.tableRow}>
              <Text style={[styles.colLabel, styles.muted]}>
                of which supplier-verified / spend estimate
              </Text>
              <Text style={[styles.colValue, styles.muted]}>
                {snapshot.emissions.scope3PrimarySharePct}% /{" "}
                {(100 - snapshot.emissions.scope3PrimarySharePct).toFixed(1)}%
              </Text>
            </View>
          ) : null}
          <View style={styles.tableRowLast}>
            <Text style={[styles.colLabel, { fontWeight: 500 }]}>Total</Text>
            <Text style={[styles.colValue, { fontWeight: 500 }]}>
              {formatTco2e(snapshot.emissions.total)}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 14 }}>
          <EmissionsStack
            scope1={snapshot.emissions.scope1}
            scope2={snapshot.emissions.scope2}
            scope3={snapshot.emissions.scope3}
          />
        </View>

        {topBreakdown.length > 0 ? (
          <View style={{ marginTop: 18 }}>
            <Text style={styles.sectionEyebrow}>Score drivers</Text>
            {topBreakdown.map((b) => (
              <View
                key={b.component}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginTop: 4,
                }}
              >
                <Text style={{ flex: 1, fontSize: 9, color: C.ink }}>
                  {b.explanation}
                </Text>
                <Text style={styles.monoSm}>
                  {b.contribution > 0 ? "+" : ""}
                  {b.contribution.toFixed(1)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <PageFooter org={snapshot.organisationName} version={snapshot.version} />
      </Page>

      {/* —— Materiality & factors —— */}
      <Page size="A4" style={styles.page}>
        {watermarked ? <Text style={styles.watermark}>ClearESG</Text> : null}
        <Text style={styles.sectionEyebrow}>02 — Materiality</Text>
        <Text style={styles.h2}>Double materiality</Text>
        <Text style={styles.body}>
          {snapshot.materiality.narrative ??
            "No materiality assessment finalised for this period."}
        </Text>

        <View style={{ marginTop: 14 }}>
          <Text style={styles.cardLabel}>Material topics ({material.length})</Text>
          {material.length === 0 ? (
            <Text style={styles.muted}>None above threshold.</Text>
          ) : (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.colHeader, { flex: 0.5 }]}>Code</Text>
                <Text style={[styles.colHeader, { flex: 1.6 }]}>Topic</Text>
                <Text style={styles.colHeaderValue}>Impact</Text>
                <Text style={styles.colHeaderValue}>Financial</Text>
              </View>
              {material.map((p, i) => (
                <View
                  key={p.esrsTopic}
                  style={
                    i === material.length - 1 ? styles.tableRowLast : styles.tableRow
                  }
                >
                  <Text style={[styles.mono, { flex: 0.5, fontSize: 9 }]}>
                    {p.esrsTopic}
                  </Text>
                  <Text style={[styles.colLabel, { flex: 1.6 }]}>
                    {topicLabel(p.esrsTopic)}
                  </Text>
                  <Text style={styles.colValue}>{p.impactScore}</Text>
                  <Text style={styles.colValue}>{p.financialScore}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {below.length > 0 ? (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.muted}>
              Below threshold: {below.map((p) => p.esrsTopic).join(", ")}
            </Text>
          </View>
        ) : null}

        <View style={styles.rule} />
        <Text style={styles.sectionEyebrow}>03 — Factor registry</Text>
        <Text style={styles.h2}>Emission factors used</Text>
        <Text style={styles.muted}>
          Pinned versions so this published report stays reproducible.
        </Text>

        {snapshot.factorsUsed.length === 0 ? (
          <Text style={[styles.muted, { marginTop: 8 }]}>
            No factors pinned (missing activity data for emissions).
          </Text>
        ) : (
          <View style={[styles.table, { marginTop: 10 }]}>
            <View style={styles.tableHeader}>
              <Text style={[styles.colHeader, { flex: 1.4 }]}>Factor</Text>
              <Text style={[styles.colHeader, { flex: 1 }]}>Source</Text>
              <Text style={styles.colHeaderValue}>Year</Text>
              <Text style={styles.colHeaderValue}>Value</Text>
            </View>
            {snapshot.factorsUsed.map((f, i) => (
              <View
                key={f.factorId}
                style={
                  i === snapshot.factorsUsed.length - 1
                    ? styles.tableRowLast
                    : styles.tableRow
                }
              >
                <Text style={[styles.mono, { flex: 1.4, fontSize: 8 }]}>{f.key}</Text>
                <Text style={[styles.colLabel, { flex: 1, fontSize: 8 }]}>
                  {f.source}
                </Text>
                <Text style={[styles.colValue, { fontSize: 8 }]}>{f.year}</Text>
                <Text style={[styles.colValue, { fontSize: 8 }]}>{f.value}</Text>
              </View>
            ))}
          </View>
        )}

        <PageFooter org={snapshot.organisationName} version={snapshot.version} />
      </Page>

      {/* —— Evidence & assurance —— */}
      <Page size="A4" style={styles.page}>
        {watermarked ? <Text style={styles.watermark}>ClearESG</Text> : null}
        <Text style={styles.sectionEyebrow}>04 — Evidence</Text>
        <Text style={styles.h2}>Evidence index</Text>
        <Text style={styles.body}>
          Every figure should trace to a source document. Hashes below are SHA-256
          prefixes for integrity checks.
        </Text>

        {snapshot.evidenceIndex.length === 0 ? (
          <View style={[styles.disclaimerBox, { marginTop: 12 }]}>
            <Text style={styles.muted}>
              No evidence uploaded for this period. Attach invoices, bills, or
              certificates in Data to strengthen assurance readiness.
            </Text>
          </View>
        ) : (
          <View style={[styles.table, { marginTop: 12 }]}>
            <View style={styles.tableHeader}>
              <Text style={[styles.colHeader, { flex: 2 }]}>File</Text>
              <Text style={[styles.colHeader, { flex: 1 }]}>Metric</Text>
              <Text style={styles.colHeaderValue}>Hash</Text>
            </View>
            {snapshot.evidenceIndex.slice(0, 40).map((e, i, arr) => (
              <View
                key={e.sha256}
                style={i === arr.length - 1 ? styles.tableRowLast : styles.tableRow}
              >
                <Text style={[styles.colLabel, { flex: 2, fontSize: 8 }]}>
                  {e.filename}
                </Text>
                <Text style={[styles.mono, { flex: 1, fontSize: 8 }]}>
                  {e.metricKey ?? "—"}
                </Text>
                <Text style={[styles.colValue, { fontSize: 8 }]}>
                  {e.sha256.slice(0, 12)}…
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.disclaimerBox}>
          <Text style={styles.cardLabel}>Assurance notice</Text>
          <Text style={styles.muted}>{snapshot.disclaimer}</Text>
        </View>

        <PageFooter org={snapshot.organisationName} version={snapshot.version} />
      </Page>
    </Document>
  );
}
