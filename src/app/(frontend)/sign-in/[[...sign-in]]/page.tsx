import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
        <h1 className="font-display text-3xl text-ink">Sign in</h1>
        <p className="mt-4 max-w-md text-center text-ink-muted">
          Clerk keys are not configured. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and
          CLERK_SECRET_KEY, or use CLEARESG_DEV_BYPASS=1 with the seeded demo user for
          local development.
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <SignIn />
    </main>
  );
}
