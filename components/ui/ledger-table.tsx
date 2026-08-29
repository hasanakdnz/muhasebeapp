import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * DESIGN.md "Ledger Tables":
 * Satırlar arası çok ince border, zebra YOK, bol dolgu (satır başına en az 12px
 * dikey boşluk). Tutar sütunu sağa yaslı ve `data-numeric`. Hover yalnızca
 * `surface-muted` — dikkat çekmeden konum belirtir.
 */
export function LedgerTable({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-app bg-surface">
      <table
        className={cn("w-full border-collapse text-body-md", className)}
        {...props}
      />
    </div>
  );
}

export function LedgerHead({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("", className)} {...props} />;
}

export function LedgerHeadCell({
  className,
  numeric = false,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-border px-4 py-3 text-left align-middle",
        "text-label-md font-medium text-muted",
        numeric && "text-right",
        className
      )}
      {...props}
    />
  );
}

export function LedgerBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("", className)} {...props} />;
}

export function LedgerRow({
  className,
  highlight = false,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & {
  /** Yeni eklenen satır: kısa bir `surface-muted` vurgusuyla belirir ve söner. */
  highlight?: boolean;
}) {
  return (
    <tr
      className={cn(
        "relative border-b border-border last:border-b-0",
        "transition-colors duration-120 ease-enter hover:bg-surface-muted",
        highlight && "animate-row-enter",
        className
      )}
      {...props}
    />
  );
}

export function LedgerCell({
  className,
  numeric = false,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        "px-4 py-3.5 align-middle text-ink",
        numeric && "text-right",
        className
      )}
      {...props}
    />
  );
}
