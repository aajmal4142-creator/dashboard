import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "input-well field-sizing-content flex min-h-16 w-full px-3 py-2 text-base text-ink outline-none placeholder:text-ink-muted/60 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
        "aria-invalid:border-rust",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
