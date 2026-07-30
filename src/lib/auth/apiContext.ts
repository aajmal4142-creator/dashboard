import { NextResponse } from "next/server";

import { getCurrentContext, type AuthContext } from "./getCurrentContext";

/**
 * Detect Next.js redirect throws (e.g. auth.protect() → sign-in).
 * API routes that wrap getCurrentContext in try/catch must not turn these into 500s.
 */
export function isNextRedirectError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if (!("digest" in error)) return false;
  const digest = (error as { digest: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

export type ApiContextResult =
  { ok: true; ctx: AuthContext } | { ok: false; response: NextResponse };

/**
 * Auth for JSON API routes. Returns 401 instead of HTML sign-in redirects.
 */
export async function getApiContext(): Promise<ApiContextResult> {
  try {
    const ctx = await getCurrentContext();
    if (!ctx.user || !ctx.activeOrg) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }
    return { ok: true, ctx };
  } catch (error) {
    if (isNextRedirectError(error)) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }
    throw error;
  }
}
