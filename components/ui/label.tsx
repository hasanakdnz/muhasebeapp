import * as React from "react";
import { cn } from "@/lib/utils";

/** DESIGN.md: etiketler Medium (500) + geniş harf aralığı, uppercase DEĞİL. */
export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & {
  ref?: React.Ref<HTMLLabelElement>;
}) {
  return (
    <label className={cn("block text-label-md text-muted", className)} {...props} />
  );
}
