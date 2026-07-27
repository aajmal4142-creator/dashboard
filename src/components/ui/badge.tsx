import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border bg-transparent px-1.5 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-rule text-ink-muted",
        secondary: "border-rule text-ink-muted",
        outline: "border-rule text-ink",
        ghost: "border-transparent text-ink-muted",
        link: "border-transparent text-accent underline-offset-4",
        measured: "border-signal text-signal",
        calculated: "border-cobalt text-cobalt",
        estimated: "border-amber text-amber",
        missing: "border-rust text-rust",
        destructive: "border-rust text-rust",
        signal: "border-signal text-signal",
        amber: "border-amber text-amber",
        rust: "border-rust text-rust",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
