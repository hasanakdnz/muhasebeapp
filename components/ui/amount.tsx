import * as React from "react";
import { cn } from "@/lib/utils";
import {
  amountTone,
  formatSignedTRY,
  formatTRY,
  type AmountTone,
  type DecimalLike,
} from "@/lib/money";

/**
 * Finansal tutar gösterimi.
 *
 * CLAUDE.md kuralı: tutarlar HER ZAMAN `data-numeric` (IBM Plex Mono) stiliyle
 * gösterilir. Renk varsayılan olarak nötrdür — DESIGN.md'ye göre ledger
 * tablolarında yalnızca tutar sütunu renklenir, "başka hiçbir sütunda renk
 * kullanılmaz". Bu yüzden renklendirme açıkça istenir.
 */
export function Amount({
  value,
  colored = false,
  tone,
  signed = false,
  currency = true,
  className,
  ...props
}: Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> & {
  value: DecimalLike;
  /** İşaretten türetilen green/red renklendirmesi. */
  colored?: boolean;
  /**
   * Rengi açıkça belirler. "Toplam borç" gibi mutlak değer olarak saklanan
   * ama anlamı negatif olan tutarlar için gerekir.
   */
  tone?: AmountTone | "neutral";
  /** Gelir `+`, gider `-` öneki (DESIGN.md Ledger Tables). */
  signed?: boolean;
  currency?: boolean;
}) {
  const text = signed ? formatSignedTRY(value) : formatTRY(value);
  const display = currency ? text : text.replace(" ₺", "");

  // Sıfır ne pozitif ne negatiftir — renk anlam taşımadığı için nötr kalır.
  // Bu, açıkça `tone` verilse de geçerlidir (CLAUDE.md: renk yalnızca anlam taşır).
  const sifirMi = amountTone(value) === "zero";
  const efektifTon: AmountTone | "neutral" = sifirMi
    ? "neutral"
    : (tone ?? (colored ? amountTone(value) : "neutral"));

  return (
    <span
      data-numeric=""
      className={cn(
        "tabular-nums",
        efektifTon === "positive" && "text-green",
        efektifTon === "negative" && "text-red",
        className
      )}
      {...props}
    >
      {display}
    </span>
  );
}
