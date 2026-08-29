import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

/** Etiket üstte, hata mesajı altta — DESIGN.md Input Fields düzeni. */
export function Field({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && <p className="text-body-sm text-muted">{hint}</p>}
      {error && (
        <p className="text-body-sm text-red" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
