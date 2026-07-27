import Link from "next/link";

import { cn } from "@/lib/utils";

/** Consistent in-page shortcut to the place that completes the work. */
export function GoLink({
  href,
  children = "Open",
  className,
}: {
  href: string;
  children?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-accent underline-offset-2 hover:underline",
        className,
      )}
    >
      {children}
      <span aria-hidden>→</span>
    </Link>
  );
}
