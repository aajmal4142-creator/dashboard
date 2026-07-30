export type ImportReplyKind = "success" | "partial" | "error";

export type ImportReplyContent = {
  kind: ImportReplyKind;
  subject: string;
  text: string;
  html: string;
};

export function buildImportReply(opts: {
  formName: string;
  kind: ImportReplyKind;
  summary: string;
  details?: string[];
}): ImportReplyContent {
  const prefix =
    opts.kind === "success"
      ? "Import confirmed"
      : opts.kind === "partial"
        ? "Import partially applied"
        : "Import failed";

  const subject = `[ClearESG] ${prefix}: ${opts.formName}`;
  const detailLines =
    opts.details && opts.details.length > 0
      ? `\n\n${opts.details.map((d) => `- ${d}`).join("\n")}`
      : "";

  const text = `${prefix} for "${opts.formName}".\n\n${opts.summary}${detailLines}\n\n— ClearESG`;

  const detailHtml =
    opts.details && opts.details.length > 0
      ? `<ul>${opts.details.map((d) => `<li>${escapeHtml(d)}</li>`).join("")}</ul>`
      : "";

  const html = `<p>${escapeHtml(prefix)} for <strong>${escapeHtml(opts.formName)}</strong>.</p><p>${escapeHtml(opts.summary)}</p>${detailHtml}<p>— ClearESG</p>`;

  return { kind: opts.kind, subject, text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
