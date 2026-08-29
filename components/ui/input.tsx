import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * DESIGN.md "Input Fields":
 * 1px border, 8px radius. Focus yalnızca ink renginde 1.5px kenarlık —
 * halka/gölge efekti yok.
 */
export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  ref?: React.Ref<HTMLInputElement>;
}) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-app border border-border bg-surface px-3",
        "text-body-md text-ink placeholder:text-muted",
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
