import * as React from "react";
import { cn } from "@/lib/utils";

/** Input ile aynı ölçü ve focus dili (DESIGN.md): 1px border, 8px radius, ink focus. */
export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  ref?: React.Ref<HTMLSelectElement>;
}) {
  return (
    <select
      className={cn(
        "h-11 w-full appearance-none rounded-app border border-border bg-surface px-3",
        "text-body-md text-ink",
        "transition-colors duration-120",
        "focus:border-[1.5px] focus:border-ink focus:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-[invalid=true]:border-red",
        className
      )}
      {...props}
    />
  );
}
