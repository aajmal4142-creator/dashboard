import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { registerReportPdfFonts } from "@/lib/reports/pdfFonts";

import type { ChecklistExportSnapshot } from "./checklistExport";

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
    marginBottom: 8,
  },
  meta: {
    fontSize: 10,
    fontFamily: "JetBrainsMono",
    color: C.muted,
    marginBottom: 3,
  },
  progress: {
    fontSize: 11,
    fontFamily: "JetBrainsMono",
    fontWeight: 500,
    color: C.ink,
    marginTop: 10,
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
  mark: {
    width: 18,
    fontFamily: "JetBrainsMono",
    fontSize: 11,
    color: C.ink,
  },
  obligation: {
    flex: 1,
    fontSize: 9,
    fontFamily: "Inter",
    lineHeight: 1.35,
    paddingRight: 6,
  },
  status: {
    width: 58,
    fontSize: 8,
    fontFamily: "JetBrainsMono",
    textTransform: "uppercase",
  },
  due: {
    width: 72,
    fontSize: 8,
    fontFamily: "JetBrainsMono",
    color: C.muted,
  },
  owner: {
    width: 70,
    fontSize: 8,
    fontFamily: "Inter",
    color: C.muted,
  },
  colHead: {
    flexDirection: "row",
    marginBottom: 6,
  },
  colHeadText: {
    fontSize: 7,
    fontFamily: "Inter",
    fontWeight: 500,
    color: C.muted,
    textTransform: "uppercase",
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
  empty: {
    fontSize: 10,
    fontFamily: "Inter",
    color: C.muted,
    marginTop: 12,
  },
});

function statusColor(status: "pending" | "complete"): string {
  return status === "complete" ? C.signal : C.muted;
}

export function ChecklistExportPdfDocument({
  snapshot,
}: {
  snapshot: ChecklistExportSnapshot;
}) {
  return (
    <Document
      title={`Compliance checklist — ${snapshot.organisationName}`}
      author="ClearESG"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.accentRule} />
        <Text style={styles.masthead}>ClearESG · Compliance checklist</Text>
        <Text style={styles.title}>Compliance checklist</Text>
        <Text style={styles.meta}>{snapshot.organisationName}</Text>
        <Text style={styles.meta}>Export date {snapshot.exportDate}</Text>
        <Text style={styles.meta}>Period {snapshot.period}</Text>
        <Text style={styles.progress}>{snapshot.summary.label}</Text>

        {snapshot.sections.length === 0 ? (
          <Text style={styles.empty}>
            No confirmed obligations for this period. Confirm obligations on the Runway
            before exporting.
          </Text>
        ) : (
          snapshot.sections.map((section) => (
            <View key={section.category} wrap={false}>
              <View style={styles.rule} />
              <Text style={styles.h2}>{section.category}</Text>
              <View style={styles.colHead}>
                <Text style={{ ...styles.colHeadText, width: 18 }}> </Text>
                <Text style={{ ...styles.colHeadText, flex: 1 }}>Obligation</Text>
                <Text style={{ ...styles.colHeadText, width: 58 }}>Status</Text>
                <Text style={{ ...styles.colHeadText, width: 72 }}>Due</Text>
                <Text style={{ ...styles.colHeadText, width: 70 }}>Owner</Text>
              </View>
              {section.rows.map((row) => (
                <View key={row.id} style={styles.row}>
                  <Text style={styles.mark}>{row.status === "complete" ? "☑" : "☐"}</Text>
                  <Text style={styles.obligation}>{row.obligation}</Text>
                  <Text
                    style={{
                      ...styles.status,
                      color: statusColor(row.status),
                    }}
                  >
                    {row.status}
                  </Text>
                  <Text style={styles.due}>{row.dueDate ?? "—"}</Text>
                  <Text style={styles.owner}>{row.owner || "—"}</Text>
                </View>
              ))}
            </View>
          ))
        )}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Auto-generated by ClearESG · ${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
