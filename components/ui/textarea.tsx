import * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  ref?: React.Ref<HTMLTextAreaElement>;
}) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-app border border-border bg-surface px-3 py-2.5",
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
