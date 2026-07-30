import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { registerReportPdfFonts } from "@/lib/reports/pdfFonts";
import type { SupplierReceiptSnapshot } from "@/lib/portal/types";

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

function stylesFor(accent: string) {
  return StyleSheet.create({
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
      backgroundColor: accent,
      marginBottom: 24,
    },
    masthead: {
      fontSize: 9,
      fontFamily: "Inter",
      fontWeight: 500,
      color: accent,
      marginBottom: 16,
    },
    title: {
      fontSize: 28,
      fontFamily: "Fraunces",
      fontWeight: 600,
      marginBottom: 8,
    },
    status: {
      fontSize: 11,
      fontFamily: "Inter",
      fontWeight: 500,
      color: C.signal,
      marginBottom: 16,
    },
    meta: {
      fontSize: 10,
      fontFamily: "JetBrainsMono",
      color: C.muted,
      marginBottom: 4,
    },
    rule: { height: 1, backgroundColor: C.rule, marginVertical: 14 },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    label: { fontSize: 10, fontFamily: "Inter", color: C.muted, flex: 1 },
    value: {
      fontSize: 10,
      fontFamily: "JetBrainsMono",
      color: C.ink,
      textAlign: "right",
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
}

function formatValue(value: number | null, unit: string): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value} ${unit}`;
}

export function SupplierReceiptPdfDocument({
  snapshot,
}: {
  snapshot: SupplierReceiptSnapshot;
}) {
  const accent =
    snapshot.accentColor && /^#[0-9A-Fa-f]{6}$/.test(snapshot.accentColor)
      ? snapshot.accentColor
      : C.accent;
  const styles = stylesFor(accent);
  const when = snapshot.submittedAt.slice(0, 19).replace("T", " ");

  return (
    <Document
      title={`Submission receipt — ${snapshot.supplierName}`}
      author={snapshot.orgName}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.accentRule} />
        <Text style={styles.masthead}>{snapshot.orgName}</Text>
        <Text style={styles.title}>Submission receipt</Text>
        <Text style={styles.status}>
          {snapshot.isResubmit ? "Updated response" : "Submitted"}
        </Text>
        <Text style={styles.meta}>Supplier: {snapshot.supplierName}</Text>
        <Text style={styles.meta}>Recorded: {when} UTC</Text>
        <Text style={styles.meta}>
          Measurement:{" "}
          {snapshot.isMetered ? "Metered / inventoried" : "Estimate or mixed"}
        </Text>
        <View style={styles.rule} />
        {snapshot.fields.map((f) => (
          <View key={f.label} style={styles.row}>
            <Text style={styles.label}>{f.label}</Text>
            <Text style={styles.value}>{formatValue(f.value, f.unit)}</Text>
          </View>
        ))}
        <Text style={styles.footer}>
          Keep this receipt as acknowledgement. Corrections may be allowed via the
          original invite link until it expires.
        </Text>
      </Page>
    </Document>
  );
}
