"use client";

import { UserButton, useAuth } from "@clerk/nextjs";
import Link from "next/link";

import { Button } from "@/components/ui/button";

type Variant = "acid" | "editorial";

export function ClerkMarketingAuthActions({ variant }: { variant: Variant }) {
  const { isLoaded, isSignedIn } = useAuth();

  const signInClass =
    variant === "acid"
      ? "hidden text-sm text-ink-muted hover:text-ink sm:inline"
      : "hover:text-ink";
  const buttonClass = variant === "acid" ? "rounded-full px-4" : undefined;

  if (!isLoaded) {
    return <div className="h-8 w-24" aria-hidden />;
  }

  if (isSignedIn) {
    return (
      <>
        <UserButton
          appearance={{
            elements: {
              avatarBox: "size-8 rounded-full ring-1 ring-rule",
            },
          }}
        />
        <Button asChild size="sm" className={buttonClass}>
          <Link href="/dashboard">Open workspace</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <Link href="/sign-in" className={signInClass}>
        Sign in
      </Link>
      <Button asChild size="sm" className={buttonClass}>
        <Link href="/sign-up">Start free</Link>
      </Button>
    </>
  );
}
