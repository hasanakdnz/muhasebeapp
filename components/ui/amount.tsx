import * as React from "react";
import { cn } from "@/lib/utils";
import {
  amountTone,
  formatSignedTRY,
  formatTRY,
  type DecimalLike,
} from "@/lib/money";

/**
 * Finansal tutar gösterimi.
 *
 * CLAUDE.md kuralı: tutarlar HER ZAMAN `data-numeric` (IBM Plex Mono) stiliyle
 * gösterilir. Renk varsayılan olarak nötrdür — DESIGN.md'ye göre ledger
 * tablolarında yalnızca tutar sütunu renklenir, "başka hiçbir sütunda renk
 * kullanılmaz". Bu yüzden renklendirme `colored` ile açıkça istenir.
 */
export function Amount({
  value,
  colored = false,
  signed = false,
  currency = true,
  className,
  ...props
}: Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> & {
  value: DecimalLike;
  /** green (pozitif) / red (negatif) uygula. Marka rengi asla tutar rengi değildir. */
  colored?: boolean;
  /** Gelir `+`, gider `-` öneki (DESIGN.md Ledger Tables). */
  signed?: boolean;
  currency?: boolean;
}) {
  const text = signed
    ? formatSignedTRY(value)
    : formatTRY(value);
  const display = currency ? text : text.replace(" ₺", "");

  const tone = colored ? amountTone(value) : "zero";

  return (
    <span
      data-numeric=""
      className={cn(
        "tabular-nums",
        colored && tone === "positive" && "text-green",
        colored && tone === "negative" && "text-red",
        className
      )}
      {...props}
    >
      {display}
    </span>
  );
}
