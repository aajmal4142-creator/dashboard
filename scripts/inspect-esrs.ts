/**
 * Phase 1c Step 1 — Inspect only.
 * Do not parse mappings. Do not propose. Do not set approved.
 *
 * Reads the Explanatory Note (column semantics) then dumps workbook structure
 * for human confirmation before any parser is written.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PDFParse } from "pdf-parse";
import * as XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const docsDir = path.join(root, "docs");

const REQUIRED = [
  "EFRAG-IG3-datapoints.xlsx",
  "EFRAG-IG3-explanatory-note.pdf",
  "EFRAG-IG3-addendum-2024-12.pdf",
] as const;

function assertDocsPresent(): void {
  const missing = REQUIRED.filter((f) => !fs.existsSync(path.join(docsDir, f)));
  if (missing.length > 0) {
    console.error("Missing required /docs files:");
    for (const f of missing) console.error(`  - ${f}`);
    console.error("Stop. Do not proceed without the real source files.");
    process.exit(1);
  }
  console.log("=== /docs presence check ===");
  for (const f of REQUIRED) {
    const full = path.join(docsDir, f);
    const stat = fs.statSync(full);
    console.log(`  [x] ${f}  (${stat.size} bytes)`);
  }
  for (const optional of ["SEBI-BRSR-format.pdf", "EFRAG-VSME.pdf"]) {
    const full = path.join(docsDir, optional);
    console.log(
      fs.existsSync(full)
        ? `  [x] ${optional}  (present)`
        : `  [ ] ${optional}  (missing — not required for this ESRS inspect step)`,
    );
  }
  console.log("");
}

async function readExplanatoryNoteSnippet(): Promise<void> {
  const pdfPath = path.join(docsDir, "EFRAG-IG3-explanatory-note.pdf");
  console.log("=== Explanatory Note (first ~4k chars of extracted text) ===");
  console.log(`File: ${pdfPath}`);
  try {
    const buffer = fs.readFileSync(pdfPath);
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = result.text ?? "";
    console.log(`Pages: ${result.total ?? "unknown"}`);
    const snippet = text.replace(/\s+/g, " ").trim().slice(0, 4000);
    console.log(snippet);
    console.log("\n… [truncated for inspect — full note defines column semantics]\n");
  } catch (error) {
    console.error("Could not extract PDF text:", error);
    console.error(
      "Workbook inspect will still run. Confirm columns against the PDF manually.",
    );
  }
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function inspectWorkbook(): void {
  const xlsxPath = path.join(docsDir, "EFRAG-IG3-datapoints.xlsx");
  console.log("=== Workbook inspect ===");
  console.log(`File: ${xlsxPath}`);

  const readFile =
    XLSX.readFile ??
    (XLSX as { default?: { readFile: typeof XLSX.readFile } }).default?.readFile;
  if (!readFile) {
    throw new Error("xlsx readFile unavailable in this module shape");
  }

  const workbook = readFile(xlsxPath, { cellDates: true });
  console.log(`Sheet count: ${workbook.SheetNames.length}`);
  console.log("Sheet names:");
  for (const name of workbook.SheetNames) {
    console.log(`  - ${name}`);
  }
  console.log("");

  const sheet_to_json =
    XLSX.utils?.sheet_to_json ??
    (XLSX as { default?: { utils: typeof XLSX.utils } }).default?.utils.sheet_to_json;
  if (!sheet_to_json) {
    throw new Error("xlsx sheet_to_json unavailable");
  }

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const rows = sheet_to_json<(string | number | boolean | Date | null)[]>(sheet, {
      header: 1,
      defval: null,
      raw: false,
    });

    console.log(`--- Sheet: "${name}" ---`);
    console.log(`Row count (including header): ${rows.length}`);
    console.log(`Data row count (excluding header): ${Math.max(0, rows.length - 1)}`);

    const header = (rows[0] ?? []).map(cellToString);
    console.log("Header columns:");
    header.forEach((col, i) => {
      console.log(`  [${i}] ${col || "(empty)"}`);
    });

    const firstThree = rows.slice(1, 4);
    console.log("First 3 data rows:");
    if (firstThree.length === 0) {
      console.log("  (no data rows)");
    } else {
      firstThree.forEach((row, idx) => {
        const cells = (row ?? []).map(cellToString);
        console.log(`  row ${idx + 2}:`);
        header.forEach((col, i) => {
          console.log(`    ${col || `col_${i}`}: ${cells[i] ?? ""}`);
        });
      });
    }
    console.log("");
  }

  console.log("=== END INSPECT — waiting for human confirmation of sheet + columns ===");
  console.log("Do not write parse-esrs.ts until confirmed.");
}

async function main() {
  assertDocsPresent();
  await readExplanatoryNoteSnippet();
  inspectWorkbook();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
