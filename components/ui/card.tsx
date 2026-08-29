import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * DESIGN.md "Cards": `surface` zemin, 8px radius, 24-32px iç dolgu.
 * Gölge YOK — paper ile arasındaki ton farkı yeterlidir; gerekirse 1px border.
 */
export function Card({
  className,
  bordered = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { bordered?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-app bg-surface p-6",
        bordered && "border border-border",
        className
      )}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-heading-md text-ink", className)} {...props} />;
}

export function CardLabel({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-label-md text-muted", className)} {...props} />;
}
