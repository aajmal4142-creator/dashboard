import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { formatTco2e } from "@/lib/reports/pdfFormat";
import { registerReportPdfFonts } from "@/lib/reports/pdfFonts";

import {
  FRAMEWORK_LABELS,
  FRAMEWORK_SECTION_COLORS,
  type MultiFrameworkId,
  type MultiFrameworkReport,
  type MultiFrameworkSection,
  type SharedEmissionsBlock,
} from "./types";

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
    marginBottom: 20,
  },
  masthead: {
    fontSize: 9,
    fontFamily: "Inter",
    fontWeight: 500,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
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
  xref: {
    fontSize: 9,
    fontFamily: "Inter",
    color: C.muted,
    fontStyle: "italic",
    marginBottom: 10,
    marginTop: 4,
  },
  bullet: {
    fontSize: 10,
    fontFamily: "Inter",
    marginBottom: 4,
    paddingLeft: 8,
  },
  qLabel: {
    fontSize: 9,
    fontFamily: "Inter",
    fontWeight: 500,
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

function EmissionsBlock({
  emissions,
  color,
}: {
  emissions: SharedEmissionsBlock;
  color: string;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ ...styles.h2, color }}>GHG inventory</Text>
      <Text style={styles.mono}>
        Scope 1 {formatTco2e(emissions.scope1)} tCO₂e · Scope 2{" "}
        {formatTco2e(emissions.scope2)} tCO₂e · Scope 3 {formatTco2e(emissions.scope3)}{" "}
        tCO₂e
      </Text>
      <Text style={{ ...styles.mono, marginTop: 4 }}>
        Total {formatTco2e(emissions.total)} tCO₂e
        {emissions.emissionsStandard ? ` · ${emissions.emissionsStandard}` : ""}
        {` · data quality ${Math.round(emissions.dataQualityPct)}%`}
      </Text>
    </View>
  );
}

function SectionPages({
  section,
  orgName,
}: {
  section: MultiFrameworkSection;
  orgName: string;
}) {
  const fw = section.framework as MultiFrameworkId;
  const color = FRAMEWORK_SECTION_COLORS[fw];
  const label = FRAMEWORK_LABELS[fw];

  return (
    <Page size="A4" style={styles.page} wrap>
      <View style={{ ...styles.accentRule, backgroundColor: color }} />
      <Text style={{ ...styles.masthead, color }}>
        ClearESG · Section {section.sectionNumber} · {label}
      </Text>
      <Text style={{ ...styles.title, fontSize: 20 }}>{label}</Text>

      {section.framework === "csrd" ? (
        <View>
          {section.includeEmissions && section.emissions ? (
            <EmissionsBlock emissions={section.emissions} color={color} />
          ) : null}
          {section.emissionsCrossRef ? (
            <Text style={styles.xref}>{section.emissionsCrossRef}</Text>
          ) : null}
          {section.scores ? (
            <Text style={{ ...styles.mono, marginBottom: 8 }}>
              Scores · overall {Math.round(section.scores.overall)} · E{" "}
              {Math.round(section.scores.e)} · S {Math.round(section.scores.s)} · G{" "}
              {Math.round(section.scores.g)}
            </Text>
          ) : null}
          <Text style={{ ...styles.h2, color }}>Reduction targets</Text>
          {section.targets.length === 0 ? (
            <Text style={styles.muted}>No CSRD compliance targets on file.</Text>
          ) : (
            section.targets.map((t) => (
              <Text key={`${t.metricKey}-${t.targetYear}`} style={styles.bullet}>
                · {t.metricLabel ?? t.metricKey}: {t.targetValue} by {t.targetYear}{" "}
                (baseline {t.baselineYear}) — {t.status}
              </Text>
            ))
          )}
        </View>
      ) : null}

      {section.framework === "tcfd" ? (
        <View>
          {section.includeEmissions && section.emissions ? (
            <EmissionsBlock emissions={section.emissions} color={color} />
          ) : null}
          {section.emissionsCrossRef ? (
            <Text style={styles.xref}>{section.emissionsCrossRef}</Text>
          ) : null}
          <Text style={{ ...styles.h2, color }}>Climate risk</Text>
          {section.riskItems.length === 0 ? (
            <Text style={styles.muted}>No climate-risk narrative disclosed.</Text>
          ) : (
            section.riskItems.map((r) => (
              <View key={r.id} style={{ marginBottom: 10 }} wrap={false}>
                <Text style={{ ...styles.qLabel, color }}>
                  {r.label} · {r.pillar.replace("_", " ")}
                </Text>
                <Text style={styles.body}>{r.answer}</Text>
              </View>
            ))
          )}
          <View style={styles.rule} />
          <Text style={{ ...styles.h2, color }}>Scenario analysis</Text>
          {section.scenarios.length === 0 ? (
            <Text style={styles.muted}>No linked ClearESG scenarios.</Text>
          ) : (
            section.scenarios.map((s) => (
              <Text key={s.id} style={styles.bullet}>
                · {s.name} ({s.type}) — {s.reductionPercent}% {s.baselineYear}→
                {s.targetYear}
                {s.category ? ` · ${s.category}` : ""}
              </Text>
            ))
          )}
        </View>
      ) : null}

      {section.framework === "issb" ? (
        <View>
          {section.includeEmissions && section.emissions ? (
            <EmissionsBlock emissions={section.emissions} color={color} />
          ) : null}
          {section.emissionsCrossRef ? (
            <Text style={styles.xref}>{section.emissionsCrossRef}</Text>
          ) : null}
          {section.linkedTcfdCrossRef ? (
            <Text style={styles.xref}>{section.linkedTcfdCrossRef}</Text>
          ) : null}
          <Text style={{ ...styles.h2, color }}>Sustainability metrics</Text>
          {section.metrics.length === 0 ? (
            <Text style={styles.muted}>No ISSB disclosures with content.</Text>
          ) : (
            section.metrics.map((m) => (
              <View key={m.id} style={{ marginBottom: 10 }} wrap={false}>
                <Text style={{ ...styles.qLabel, color }}>
                  {m.standard} · {m.label}
                </Text>
                <Text style={styles.body}>{m.answer}</Text>
              </View>
            ))
          )}
        </View>
      ) : null}

      {section.framework === "gri" ? (
        <View>
          <Text style={{ ...styles.h2, color }}>Material topics</Text>
          {section.narrative ? (
            <Text style={styles.body}>{section.narrative}</Text>
          ) : null}
          {section.materialTopics.length === 0 ? (
            <Text style={styles.muted}>No material topics recorded.</Text>
          ) : (
            section.materialTopics.map((t) => (
              <Text key={t.esrsTopic} style={styles.bullet}>
                · {t.esrsTopic} {t.label} — impact {t.impactScore.toFixed(1)} / financial{" "}
                {t.financialScore.toFixed(1)}
              </Text>
            ))
          )}
        </View>
      ) : null}

      <Text
        style={styles.footer}
        render={({ pageNumber, totalPages }) =>
          `ClearESG multi-framework · ${orgName} · ${label} · ${pageNumber}/${totalPages}`
        }
        fixed
      />
    </Page>
  );
}

export function MultiFrameworkPdfDocument({
  report,
  watermarked = false,
}: {
  report: MultiFrameworkReport;
  watermarked?: boolean;
}) {
  return (
    <Document
      title={`Multi-framework ${report.reportingYear} — ${report.organisationName}`}
      author="ClearESG"
    >
      {/* Cover + executive summary */}
      <Page size="A4" style={styles.page}>
        <View style={{ ...styles.accentRule, backgroundColor: C.accent }} />
        <Text style={{ ...styles.masthead, color: C.accent }}>
          ClearESG · Multi-framework consolidated report
        </Text>
        <Text style={styles.title}>Multi-Framework Report</Text>
        <Text style={styles.meta}>{report.organisationName}</Text>
        <Text style={styles.meta}>
          {report.periodLabel} · {report.reportingYear}
        </Text>
        <Text style={styles.meta}>Prepared {report.generatedAt.slice(0, 10)}</Text>
        {watermarked ? (
          <Text style={{ ...styles.muted, marginTop: 8, color: C.accent }}>
            Draft / plan watermark — upgrade for unwatermarked export.
          </Text>
        ) : null}

        <View style={styles.rule} />
        <Text style={{ ...styles.h2, color: C.accent }}>1 — Executive summary</Text>
        <Text style={styles.body}>{report.executiveSummary.paragraph}</Text>

        {report.executiveSummary.highlights.length > 0 ? (
          <View style={{ marginTop: 8 }}>
            {report.executiveSummary.highlights.map((h) => (
              <Text key={h} style={styles.bullet}>
                · {h}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.rule} />
        <Text style={{ ...styles.h2, color: C.accent }}>Contents</Text>
        {report.sections.length === 0 ? (
          <Text style={styles.muted}>
            No completed frameworks for this period. Finalise CSRD, TCFD, ISSB, or
            materiality (GRI) first.
          </Text>
        ) : (
          report.sections.map((s) => (
            <Text
              key={s.framework}
              style={{
                ...styles.bullet,
                color: FRAMEWORK_SECTION_COLORS[s.framework],
              }}
            >
              · Section {s.sectionNumber} — {FRAMEWORK_LABELS[s.framework]}
            </Text>
          ))
        )}

        {report.emissions && report.emissionsOwner ? (
          <Text style={{ ...styles.muted, marginTop: 12 }}>
            Shared emissions inventory owned by {FRAMEWORK_LABELS[report.emissionsOwner]};
            other sections cross-reference rather than repeat Scope totals.
          </Text>
        ) : null}

        <View style={styles.rule} />
        <Text style={styles.muted}>{report.disclaimer}</Text>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `ClearESG multi-framework · ${report.organisationName} · ${pageNumber}/${totalPages}`
          }
          fixed
        />
      </Page>

      {report.sections.map((section) => (
        <SectionPages
          key={section.framework}
          section={section}
          orgName={report.organisationName}
        />
      ))}
    </Document>
  );
}
