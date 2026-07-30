export type InboundAttachment = {
  filename: string;
  contentType?: string;
  /** UTF-8 CSV text when already decoded */
  text?: string;
  /** Base64 content when text not provided */
  contentBase64?: string;
  downloadUrl?: string;
};

export type NormalizedInboundMessage = {
  from: string;
  to: string[];
  subject: string;
  bodyText?: string;
  attachments: InboundAttachment[];
  providerMessageId?: string;
  /** Explicit form match when provider includes it */
  formId?: string;
  inboundToken?: string;
};

const TOKEN_SUBJECT = /\[ClearESG:([a-zA-Z0-9_-]+)\]/i;
const TOKEN_PLUS = /(?:^|[<,\s])(?:import\+)?([a-zA-Z0-9_-]{6,})@/i;

/**
 * Resolve inbound form token from To / subject / explicit fields.
 */
export function extractInboundToken(msg: {
  to?: string[];
  subject?: string;
  inboundToken?: string;
}): string | null {
  if (msg.inboundToken?.trim()) return msg.inboundToken.trim();

  const subject = msg.subject ?? "";
  const subjectMatch = TOKEN_SUBJECT.exec(subject);
  if (subjectMatch?.[1]) return subjectMatch[1];

  for (const addr of msg.to ?? []) {
    const plus = /\+([a-zA-Z0-9_-]+)@/.exec(addr);
    if (plus?.[1]) return plus[1];
    const bare = TOKEN_PLUS.exec(addr);
    if (bare?.[1] && !bare[1].includes(".")) {
      // Prefer plus-local; skip bare domains mistaken as tokens
    }
  }
  return null;
}

/** Prefer first .csv attachment; decode base64 when needed. */
export function pickCsvAttachment(
  attachments: InboundAttachment[],
): { filename: string; csvText: string } | { error: string } {
  const csv = attachments.find((a) => {
    const name = a.filename?.toLowerCase() ?? "";
    const type = a.contentType?.toLowerCase() ?? "";
    return name.endsWith(".csv") || type.includes("csv") || type === "text/plain";
  });

  if (!csv) {
    return { error: "No CSV attachment found. Attach a .csv file and retry." };
  }

  if (csv.text?.trim()) {
    return { filename: csv.filename, csvText: csv.text };
  }

  if (csv.contentBase64?.trim()) {
    try {
      const text = Buffer.from(csv.contentBase64, "base64").toString("utf8");
      if (!text.trim()) {
        return { error: `CSV attachment "${csv.filename}" is empty.` };
      }
      return { filename: csv.filename, csvText: text };
    } catch {
      return { error: `Could not decode CSV attachment "${csv.filename}".` };
    }
  }

  if (csv.downloadUrl) {
    return {
      error: "CSV attachment requires download; fetch content before processing.",
    };
  }

  return { error: `CSV attachment "${csv.filename}" has no content.` };
}

/**
 * Normalize Resend `email.received` or a simplified test shape into one message.
 */
export function normalizeInboundMessage(
  raw: unknown,
): { ok: true; message: NormalizedInboundMessage } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Invalid webhook payload" };
  }

  const root = raw as Record<string, unknown>;

  // Simplified direct shape (membership process route / tests)
  if (typeof root.from === "string" && (root.attachments || root.csvText)) {
    const attachments: InboundAttachment[] = Array.isArray(root.attachments)
      ? (root.attachments as InboundAttachment[])
      : [];
    if (typeof root.csvText === "string" && root.csvText.length > 0) {
      attachments.push({
        filename: typeof root.filename === "string" ? root.filename : "import.csv",
        text: root.csvText,
        contentType: "text/csv",
      });
    }
    const to = Array.isArray(root.to)
      ? root.to.filter((t): t is string => typeof t === "string")
      : typeof root.to === "string"
        ? [root.to]
        : [];
    return {
      ok: true,
      message: {
        from: root.from,
        to,
        subject: typeof root.subject === "string" ? root.subject : "",
        bodyText: typeof root.bodyText === "string" ? root.bodyText : undefined,
        attachments,
        providerMessageId:
          typeof root.providerMessageId === "string" ? root.providerMessageId : undefined,
        formId: typeof root.formId === "string" ? root.formId : undefined,
        inboundToken:
          typeof root.inboundToken === "string" ? root.inboundToken : undefined,
      },
    };
  }

  const data =
    root.type === "email.received" && root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root.data && typeof root.data === "object"
        ? (root.data as Record<string, unknown>)
        : root;

  const fromRaw = data.from;
  const from =
    typeof fromRaw === "string"
      ? fromRaw
      : fromRaw && typeof fromRaw === "object" && "address" in fromRaw
        ? String((fromRaw as { address: string }).address)
        : "";

  if (!from) {
    return { ok: false, error: "Missing from address on inbound email" };
  }

  const toField = data.to;
  const to: string[] = [];
  if (typeof toField === "string") to.push(toField);
  else if (Array.isArray(toField)) {
    for (const t of toField) {
      if (typeof t === "string") to.push(t);
      else if (t && typeof t === "object" && "address" in t) {
        to.push(String((t as { address: string }).address));
      }
    }
  }

  const attachments: InboundAttachment[] = [];
  if (Array.isArray(data.attachments)) {
    for (const a of data.attachments) {
      if (!a || typeof a !== "object") continue;
      const att = a as Record<string, unknown>;
      const filename =
        typeof att.filename === "string"
          ? att.filename
          : typeof att.name === "string"
            ? att.name
            : "attachment.csv";
      attachments.push({
        filename,
        contentType:
          typeof att.content_type === "string"
            ? att.content_type
            : typeof att.contentType === "string"
              ? att.contentType
              : undefined,
        text:
          typeof att.content === "string" && !att.content_base64
            ? att.content
            : typeof att.text === "string"
              ? att.text
              : undefined,
        contentBase64:
          typeof att.content_base64 === "string"
            ? att.content_base64
            : typeof att.contentBase64 === "string"
              ? att.contentBase64
              : undefined,
        downloadUrl:
          typeof att.download_url === "string"
            ? att.download_url
            : typeof att.downloadUrl === "string"
              ? att.downloadUrl
              : undefined,
      });
    }
  }

  return {
    ok: true,
    message: {
      from,
      to,
      subject: typeof data.subject === "string" ? data.subject : "",
      bodyText:
        typeof data.text === "string"
          ? data.text
          : typeof data.body === "string"
            ? data.body
            : undefined,
      attachments,
      providerMessageId:
        typeof data.email_id === "string"
          ? data.email_id
          : typeof data.id === "string"
            ? data.id
            : undefined,
      formId: typeof data.formId === "string" ? data.formId : undefined,
      inboundToken: typeof data.inboundToken === "string" ? data.inboundToken : undefined,
    },
  };
}
