import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  const numeric =
    type === "number" || props.inputMode === "decimal" || props.inputMode === "numeric";

  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "input-well h-9 w-full min-w-0 px-3 py-1 text-base text-ink outline-none placeholder:text-ink-muted/60 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
        "aria-invalid:border-rust",
        numeric && "font-data",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
