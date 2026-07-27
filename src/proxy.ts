import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Clerk session plumbing only — no route-level auth gates here.
 * Protect pages/APIs with auth.protect() / getCurrentContext() at the resource
 * (Clerk deprecated createRouteMatcher middleware gating).
 *
 * Next.js 16+: this file is `proxy.ts` (middleware.ts renamed).
 */
const hasClerk = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

const clerkHandler = clerkMiddleware();

export default function proxy(req: NextRequest, event: unknown) {
  if (!hasClerk) {
    return NextResponse.next();
  }
  return clerkHandler(req, event as never);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
