import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
        <h1 className="font-display text-3xl text-ink">Sign up</h1>
        <p className="mt-4 max-w-md text-center text-ink-muted">
          Clerk keys are not configured. Add them to .env to enable registration.
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <SignUp />
    </main>
  );
}
