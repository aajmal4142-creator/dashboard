export type ParsedEmail = {
  from: string;
  subject: string;
  body: string;
  attachments: string[];
  extractedData: Record<string, string | number | boolean>;
};

export function parseEmailBody(emailBody: string): Record<string, string> {
  const data: Record<string, string> = {};

  // Simple key: value extraction
  const lines = emailBody.split("\n");
  for (const line of lines) {
    const match = line.match(/^([^:]+):\s*(.+)$/);
    if (match) {
      const key = match[1].toLowerCase().replace(/\s+/g, "_");
      data[key] = match[2].trim();
    }
  }

  return data;
}

export function extractTableFromEmail(emailBody: string): Record<string, string>[] {
  const rows: Record<string, string>[] = [];

  // Look for pipe-delimited or tab-delimited tables
  const lines = emailBody.split("\n");
  let headers: string[] = [];
  let inTable = false;

  for (const line of lines) {
    if (line.includes("|") || line.includes("\t")) {
      inTable = true;
      const cells = line.split(/\s*\|\s*|\t/).filter((c) => c.length > 0);

      if (headers.length === 0) {
        headers = cells;
      } else if (cells.length === headers.length) {
        const row: Record<string, string> = {};
        headers.forEach((h, i) => {
          row[h.toLowerCase().replace(/\s+/g, "_")] = cells[i];
        });
        rows.push(row);
      }
    } else if (inTable && line.trim().length === 0) {
      inTable = false;
    }
  }

  return rows;
}

export function detectFormFields(emailBody: string): string[] {
  const fields: Set<string> = new Set();

  // Common field patterns
  const patterns = [
    /(\w+\s*consumption)/gi,
    /(\w+\s*emissions?)/gi,
    /(\w+\s*spending?)/gi,
    /(\w+\s*count)/gi,
    /^(\w+):/gm,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(emailBody)) !== null) {
      const field = match[1].toLowerCase().trim().replace(/\s+/g, "_");
      if (field.length > 2) {
        fields.add(field);
      }
    }
  }

  return Array.from(fields);
}

export function isAutoReply(emailBody: string, subject: string): boolean {
  const autoReplyPatterns = [
    /auto[- ]?reply/i,
    /out of office/i,
    /automatic response/i,
    /i am currently/i,
    /will return/i,
    /fwd:/i,
    /re: re:/i,
  ];

  const text = `${subject} ${emailBody}`.toLowerCase();

  for (const pattern of autoReplyPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }

  return false;
}

export type ExtractedValue = string | number | boolean;

export function sanitizeExtractedData(
  data: Record<string, unknown>,
): Record<string, ExtractedValue> {
  const sanitized: Record<string, ExtractedValue> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      continue;
    }

    // Try to parse numbers
    if (typeof value === "string") {
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && value.trim() !== "") {
        sanitized[key] = numValue;
      } else if (value.toLowerCase() === "true" || value.toLowerCase() === "yes") {
        sanitized[key] = true;
      } else if (value.toLowerCase() === "false" || value.toLowerCase() === "no") {
        sanitized[key] = false;
      } else {
        sanitized[key] = value.trim();
      }
    } else if (typeof value === "number" || typeof value === "boolean") {
      sanitized[key] = value;
    } else {
      sanitized[key] = String(value);
    }
  }

  return sanitized;
}
