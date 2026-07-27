import Link from "next/link";

import { cn } from "@/lib/utils";

type ClearESGLogoProps = {
  className?: string;
  /** Rendered height in px. */
  height?: number;
  href?: string | null;
};

/**
 * ClearESG logo — teal C with leaf mark.
 * SVG so it stays sharp and works on light/dark nav.
 */
export function ClearESGLogo({ className, height = 32, href = "/" }: ClearESGLogoProps) {
  const width = Math.round(height * (38 / 32));

  const mark = (
    <svg
      width={width}
      height={height}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={href ? true : undefined}
      role={href ? undefined : "img"}
      aria-label={href ? undefined : "ClearESG"}
    >
      {/* Soft plate */}
      <rect width="40" height="40" rx="10" className="fill-accent" />
      {/* C stroke */}
      <path
        d="M28.2 12.4c-1.5-1.4-3.5-2.2-5.7-2.2-4.8 0-8.6 3.7-8.6 8.8s3.8 8.8 8.6 8.8c2.2 0 4.2-.8 5.7-2.2"
        stroke="white"
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Leaf */}
      <path
        d="M27.5 11.2c2.8 1.2 4.6 3.6 5.1 6.4-2.6-.4-5.1-1.9-6.6-4.2-.4-.7-.7-1.4-.9-2.2 1-.1 1.7 0 2.4 0z"
        fill="white"
        fillOpacity="0.95"
      />
      <path
        d="M26.2 13.4c.9 1.4 2.2 2.5 3.7 3.1"
        stroke="white"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeOpacity="0.55"
      />
    </svg>
  );

  if (href === null) {
    return <span className={cn("inline-flex items-center", className)}>{mark}</span>;
  }

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center rounded-[10px] outline-offset-4 focus-visible:outline-2 focus-visible:outline-accent",
        className,
      )}
      aria-label="ClearESG home"
    >
      {mark}
    </Link>
  );
}
