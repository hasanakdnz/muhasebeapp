import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * DESIGN.md "Status Badges":
 * `full` radius, ilgili rengin `-tint` zemini, aynı rengin koyu tonunda metin.
 * Kenarlık yok, gölge yok, uppercase yok.
 */
const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-label-md transition-colors duration-200",
  {
    variants: {
      variant: {
        positive: "bg-green-tint text-green", // "Ödendi"
        negative: "bg-red-tint text-red", // "Gecikti"
        pending: "bg-amber-tint text-amber", // "Bekliyor"
        neutral: "bg-surface-muted text-muted",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { badgeVariants };
