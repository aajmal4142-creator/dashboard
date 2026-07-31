/**
 * Pure formula parse / validate / evaluate for user-authored derived metrics.
 * No I/O. Safe for Vitest and API preview (values supplied by caller).
 */

export const FORMULA_OPERATORS = ["+", "-", "*", "/", "(", ")"] as const;

export type FormulaToken =
  | { kind: "number"; value: number; raw: string }
  | { kind: "ident"; value: string }
  | { kind: "op"; value: "+" | "-" | "*" | "/" | "(" | ")" };

export type FormulaValidateOk = {
  ok: true;
  keys: string[];
  tokens: FormulaToken[];
};

export type FormulaValidateErr = {
  ok: false;
  error: string;
};

export type FormulaValidateResult = FormulaValidateOk | FormulaValidateErr;

export type FormulaEvalOk = {
  ok: true;
  value: number;
  keys: string[];
};

export type FormulaEvalErr = {
  ok: false;
  error: string;
  keys: string[];
  missingKeys?: string[];
};

export type FormulaEvalResult = FormulaEvalOk | FormulaEvalErr;

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_.]*$/;

function isOpChar(c: string): c is "+" | "-" | "*" | "/" | "(" | ")" {
  return c === "+" || c === "-" || c === "*" || c === "/" || c === "(" || c === ")";
}

/** Tokenize a formula string. Whitespace is ignored. */
export function tokenizeFormula(formula: string): FormulaValidateResult {
  const src = formula.trim();
  if (!src) return { ok: false, error: "Formula is empty." };

  const tokens: FormulaToken[] = [];
  let i = 0;

  while (i < src.length) {
    const c = src[i]!;
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i += 1;
      continue;
    }

    if (isOpChar(c)) {
      tokens.push({ kind: "op", value: c });
      i += 1;
      continue;
    }

    if ((c >= "0" && c <= "9") || c === ".") {
      let j = i;
      let seenDot = c === ".";
      j += 1;
      while (j < src.length) {
        const d = src[j]!;
        if (d >= "0" && d <= "9") {
          j += 1;
          continue;
        }
        if (d === "." && !seenDot) {
          seenDot = true;
          j += 1;
          continue;
        }
        break;
      }
      const raw = src.slice(i, j);
      const value = Number(raw);
      if (!Number.isFinite(value) || raw === "." || raw === "") {
        return { ok: false, error: `Invalid number near "${raw}".` };
      }
      tokens.push({ kind: "number", value, raw });
      i = j;
      continue;
    }

    if ((c >= "A" && c <= "Z") || (c >= "a" && c <= "z") || c === "_") {
      let j = i + 1;
      while (j < src.length) {
        const d = src[j]!;
        if (
          (d >= "A" && d <= "Z") ||
          (d >= "a" && d <= "z") ||
          (d >= "0" && d <= "9") ||
          d === "_" ||
          d === "."
        ) {
          j += 1;
          continue;
        }
        break;
      }
      const value = src.slice(i, j);
      if (!IDENT_RE.test(value) || value.endsWith(".")) {
        return { ok: false, error: `Invalid metric key "${value}".` };
      }
      tokens.push({ kind: "ident", value });
      i = j;
      continue;
    }

    return { ok: false, error: `Unexpected character "${c}" at position ${i + 1}.` };
  }

  if (tokens.length === 0) return { ok: false, error: "Formula is empty." };
  return { ok: true, keys: extractKeys(tokens), tokens };
}

function extractKeys(tokens: FormulaToken[]): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const t of tokens) {
    if (t.kind === "ident" && !seen.has(t.value)) {
      seen.add(t.value);
      keys.push(t.value);
    }
  }
  return keys;
}

/**
 * Validate formula syntax and that every identifier is in `allowedKeys`.
 * Pass `allowedKeys: null` to skip key membership checks (syntax only).
 */
export function validateFormula(
  formula: string,
  allowedKeys: ReadonlySet<string> | readonly string[] | null,
): FormulaValidateResult {
  const tokenized = tokenizeFormula(formula);
  if (!tokenized.ok) return tokenized;

  const allowed =
    allowedKeys === null
      ? null
      : allowedKeys instanceof Set
        ? allowedKeys
        : new Set(allowedKeys);

  if (allowed) {
    for (const key of tokenized.keys) {
      if (!allowed.has(key)) {
        return {
          ok: false,
          error: `Unknown metric key "${key}". Choose a key from the available metrics list.`,
        };
      }
    }
  }

  const syntax = checkSyntax(tokenized.tokens);
  if (!syntax.ok) return syntax;

  return tokenized;
}

function checkSyntax(tokens: FormulaToken[]): FormulaValidateResult {
  let depth = 0;
  let expectValue = true;

  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i]!;

    if (expectValue) {
      if (t.kind === "number" || t.kind === "ident") {
        expectValue = false;
        continue;
      }
      if (t.kind === "op" && t.value === "(") {
        depth += 1;
        continue;
      }
      if (t.kind === "op" && (t.value === "+" || t.value === "-")) {
        // Unary + / −
        continue;
      }
      return {
        ok: false,
        error: `Expected a value or "(" near token ${i + 1}.`,
      };
    }

    if (t.kind === "op" && t.value === ")") {
      depth -= 1;
      if (depth < 0) {
        return { ok: false, error: "Unmatched closing parenthesis." };
      }
      expectValue = false;
      continue;
    }

    if (
      t.kind === "op" &&
      (t.value === "+" || t.value === "-" || t.value === "*" || t.value === "/")
    ) {
      expectValue = true;
      continue;
    }

    return {
      ok: false,
      error: `Expected an operator or ")" near token ${i + 1}.`,
    };
  }

  if (expectValue) {
    return {
      ok: false,
      error: "Formula ends unexpectedly; value required after operator.",
    };
  }
  if (depth !== 0) {
    return { ok: false, error: "Unmatched opening parenthesis." };
  }

  return { ok: true, keys: extractKeys(tokens), tokens };
}

/**
 * Evaluate a validated formula against a values map.
 * Missing keys → error with missingKeys (never silent zero).
 * Division by zero → explicit error.
 */
export function evaluateFormula(
  formula: string,
  values: Readonly<Record<string, number | null | undefined>>,
  allowedKeys: ReadonlySet<string> | readonly string[] | null = null,
): FormulaEvalResult {
  const validated = validateFormula(formula, allowedKeys);
  if (!validated.ok) {
    return { ok: false, error: validated.error, keys: [] };
  }

  const missingKeys: string[] = [];
  for (const key of validated.keys) {
    const v = values[key];
    if (v === null || v === undefined || !Number.isFinite(v)) {
      missingKeys.push(key);
    }
  }
  if (missingKeys.length > 0) {
    return {
      ok: false,
      error: `Missing values for: ${missingKeys.join(", ")}.`,
      keys: validated.keys,
      missingKeys,
    };
  }

  try {
    const value = evalTokens(validated.tokens, values);
    if (!Number.isFinite(value)) {
      return {
        ok: false,
        error: "Result is not a finite number.",
        keys: validated.keys,
      };
    }
    return { ok: true, value, keys: validated.keys };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Evaluation failed.";
    return { ok: false, error: message, keys: validated.keys };
  }
}

function evalTokens(
  tokens: FormulaToken[],
  values: Readonly<Record<string, number | null | undefined>>,
): number {
  let pos = 0;

  function peek(): FormulaToken | undefined {
    return tokens[pos];
  }

  function consume(): FormulaToken {
    const t = tokens[pos];
    if (!t) throw new Error("Unexpected end of formula.");
    pos += 1;
    return t;
  }

  function parseExpr(): number {
    let left = parseTerm();
    while (true) {
      const t = peek();
      if (!t || t.kind !== "op" || (t.value !== "+" && t.value !== "-")) break;
      consume();
      const right = parseTerm();
      left = t.value === "+" ? left + right : left - right;
    }
    return left;
  }

  function parseTerm(): number {
    let left = parseUnary();
    while (true) {
      const t = peek();
      if (!t || t.kind !== "op" || (t.value !== "*" && t.value !== "/")) break;
      consume();
      const right = parseUnary();
      if (t.value === "/") {
        if (right === 0) throw new Error("Division by zero.");
        left = left / right;
      } else {
        left = left * right;
      }
    }
    return left;
  }

  function parseUnary(): number {
    const t = peek();
    if (t && t.kind === "op" && (t.value === "+" || t.value === "-")) {
      consume();
      const v = parseUnary();
      return t.value === "-" ? -v : v;
    }
    return parsePrimary();
  }

  function parsePrimary(): number {
    const t = consume();
    if (t.kind === "number") return t.value;
    if (t.kind === "ident") {
      const v = values[t.value];
      if (v === null || v === undefined || !Number.isFinite(v)) {
        throw new Error(`Missing value for "${t.value}".`);
      }
      return v;
    }
    if (t.kind === "op" && t.value === "(") {
      const inner = parseExpr();
      const close = consume();
      if (close.kind !== "op" || close.value !== ")") {
        throw new Error("Expected closing parenthesis.");
      }
      return inner;
    }
    throw new Error('Expected a value or "(".');
  }

  const result = parseExpr();
  if (pos !== tokens.length) {
    throw new Error("Unexpected trailing tokens.");
  }
  return result;
}

/** Keys referenced by a formula (empty array if unparseable). */
export function formulaKeys(formula: string): string[] {
  const t = tokenizeFormula(formula);
  return t.ok ? t.keys : [];
}

/** Slug for custom metric keys: custom.<slug> */
export function slugifyMetricKey(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
  const slug = base || "metric";
  return `custom.${slug}`;
}
