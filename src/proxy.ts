import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

import {
  buildFrameAncestorsHeaderValue,
  normalizeAllowedOrigins,
} from "@/lib/reports/htmlReport";

/**
 * Clerk session plumbing only — no route-level auth gates here.
 * Protect pages/APIs with auth.protect() / getCurrentContext() at the resource
 * (Clerk deprecated createRouteMatcher middleware gating).
 *
 * Next.js 16+: this file is `proxy.ts` (middleware.ts renamed) and runs on the
 * Node.js runtime by default, so it can look up the embed token's allowlist here.
 * See docs/embed-csp.md.
 */
const hasClerk = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

const clerkHandler = clerkMiddleware();

function embedTokenFromPathname(pathname: string): string | null {
  const shareMatch = pathname.match(/^\/r\/html\/([^/?]+)\/?$/);
  if (shareMatch) return decodeURIComponent(shareMatch[1]);
  const embedMatch = pathname.match(/^\/public\/reports\/embed\/([^/?]+)\/?$/);
  if (embedMatch) return decodeURIComponent(embedMatch[1]);
  return null;
}

/**
 * Sets a per-token `Content-Security-Policy: frame-ancestors ...` on the shared/embedded
 * HTML report routes. Denies all framing (`'none'`) when the token is unknown or has no
 * configured allowlist — direct (non-framed) navigation to the same URL is unaffected.
 */
async function applyEmbedCsp<T extends Response>(req: NextRequest, res: T): Promise<T> {
  const token = embedTokenFromPathname(req.nextUrl.pathname);
  if (!token) return res;

  let allowedOrigins: string[] = [];
  try {
    const [{ getPayload }, { default: config }, { REPORT_EMBED_TOKENS_SLUG }] =
      await Promise.all([
        import("payload"),
        import("@/payload.config"),
        import("@/collections/ReportEmbedTokens"),
      ]);
    const payload = await getPayload({ config });
    const found = await payload.find({
      collection: REPORT_EMBED_TOKENS_SLUG,
      where: { token: { equals: token } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    allowedOrigins = normalizeAllowedOrigins(found.docs[0]?.allowedOrigins);
  } catch {
    allowedOrigins = [];
  }

  res.headers.set(
    "Content-Security-Policy",
    buildFrameAncestorsHeaderValue(allowedOrigins),
  );
  res.headers.set("X-Content-Type-Options", "nosniff");
  return res;
}

export default async function proxy(req: NextRequest, event: unknown) {
  const res: Response = hasClerk
    ? ((await clerkHandler(req, event as never)) ?? NextResponse.next())
    : NextResponse.next();
  return applyEmbedCsp(req, res);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
