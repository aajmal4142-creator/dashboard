"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

import { Button } from "@/components/ui/button";

const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

const ClerkMarketingAuthActions = dynamic(
  () =>
    import("@/components/marketing/ClerkMarketingAuthActions").then(
      (m) => m.ClerkMarketingAuthActions,
    ),
  { ssr: false },
);

type Variant = "acid" | "editorial";

/** Marketing chrome auth CTAs — signed-in users see Open workspace, not Sign in. */
export function MarketingAuthActions({ variant = "acid" }: { variant?: Variant }) {
  if (!hasClerk) {
    const signInClass =
      variant === "acid"
        ? "hidden text-sm text-ink-muted hover:text-ink sm:inline"
        : "hover:text-ink";
    return (
      <>
        <Link href="/sign-in" className={signInClass}>
          Sign in
        </Link>
        <Button
          asChild
          size="sm"
          className={variant === "acid" ? "rounded-full px-4" : undefined}
        >
          <Link href="/dashboard">Open workspace</Link>
        </Button>
      </>
    );
  }

  return <ClerkMarketingAuthActions variant={variant} />;
}
