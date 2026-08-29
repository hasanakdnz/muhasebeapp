import Decimal from "decimal.js";

/**
 * Para birimi yardımcıları.
 *
 * CLAUDE.md kuralı: finansal hesaplarda `Decimal` kullanılır, `number`/float ile
 * çarpma-bölme yapılmaz. Bu modül float'a hiç düşmez — biçimlendirme bile
 * Decimal'in kendi string gösteriminden üretilir, çünkü `Intl.NumberFormat`
 * `number` aldığı için büyük tutarlarda hassasiyet kaybettirir.
 */

/** Prisma'nın Decimal'i ile decimal.js'in Decimal'i ayrı sınıflar olabilir;
 *  sınırda string üzerinden normalize ederek `instanceof` tuzağını kapatıyoruz. */
export type DecimalLike = Decimal | { toString(): string } | string | number;

/** Türk Lirası: 2 basamak, yarım yukarı yuvarlama (ticari yuvarlama). */
export const KURUS_BASAMAK = 2;
export const ROUNDING = Decimal.ROUND_HALF_UP;

const BINLIK_AYRAC = ".";
const ONDALIK_AYRAC = ",";
const PARA_BIRIMI = "₺";

export function toDecimal(value: DecimalLike): Decimal {
  if (value instanceof Decimal) return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Geçersiz sayısal değer: ${value}`);
    }
    return new Decimal(value);
  }
  const raw = typeof value === "string" ? value : value.toString();
  const trimmed = raw.trim();
  if (trimmed === "") throw new Error("Boş değer Decimal'e çevrilemez.");
  const parsed = new Decimal(trimmed);
  if (!parsed.isFinite()) throw new Error(`Geçersiz sayısal değer: ${raw}`);
  return parsed;
}

/** Tutarı kuruş hassasiyetine yuvarlar. Kayıt öncesi tek yuvarlama noktası. */
export function roundMoney(value: DecimalLike): Decimal {
  return toDecimal(value).toDecimalPlaces(KURUS_BASAMAK, ROUNDING);
}

/**
 * "1234567.891" → "1.234.567,89"
 * Sembol eklemez; `data-numeric` ile gösterilecek ham tutar biçimidir.
 */
export function formatAmount(
  value: DecimalLike,
  options: { decimals?: number } = {}
): string {
  const decimals = options.decimals ?? KURUS_BASAMAK;
  const dec = toDecimal(value);
  // toFixed float'a düşmez; Decimal kendi string gösterimini üretir.
  const fixed = dec.toFixed(decimals, ROUNDING);
  const negative = fixed.startsWith("-");
  const unsigned = negative ? fixed.slice(1) : fixed;
  const [intPart, fracPart = ""] = unsigned.split(".");

  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, BINLIK_AYRAC);
  const body = fracPart ? `${grouped}${ONDALIK_AYRAC}${fracPart}` : grouped;

  // "-0,00" yerine "0,00" — yuvarlama sonrası negatif sıfır gösterilmez.
  const isZero = dec.toDecimalPlaces(decimals, ROUNDING).isZero();
  return negative && !isZero ? `-${body}` : body;
}

/** "1.234,56 ₺" — sembol Türkçe kullanımdaki gibi sonda. */
export function formatTRY(
  value: DecimalLike,
  options: { decimals?: number } = {}
): string {
  return `${formatAmount(value, options)} ${PARA_BIRIMI}`;
}

/**
 * Ledger tabloları için işaretli biçim: gelir `+`, gider `-` (DESIGN.md).
 * Sıfır işaretsiz gösterilir.
 */
export function formatSignedTRY(
  value: DecimalLike,
  options: { decimals?: number } = {}
): string {
  const dec = roundMoney(toDecimal(value));
  const formatted = formatTRY(dec.abs(), options);
  if (dec.isZero()) return formatted;
  return `${dec.isNegative() ? "-" : "+"}${formatted}`;
}

/**
 * Yüzde gösterimi — Türkçe ondalık ayracıyla ("75,02").
 * Decimal.toString() nokta üretir; ekranda ve Excel'de bu yanlış okunur.
 */
export function formatYuzde(value: DecimalLike, basamak = 2): string {
  return formatAmount(value, { decimals: basamak });
}

export type AmountTone = "positive" | "negative" | "zero";

/** Renk seçimi için: yalnızca green / red / nötr. Marka rengi (ink) tutar rengi değildir. */
export function amountTone(value: DecimalLike): AmountTone {
  const dec = roundMoney(toDecimal(value));
  if (dec.isZero()) return "zero";
  return dec.isNegative() ? "negative" : "positive";
}

/**
 * Kullanıcı girdisini ("1.234,56" veya "1234.56" veya "1234,56") Decimal'e çevirir.
 * Türkçe klavyeyle hem nokta hem virgül girilebildiği için ikisi de kabul edilir.
 * Belirsiz durumda ("1.234") binlik ayraç varsayılır — Türkçe yazım budur.
 */
export function parseAmountInput(input: string): Decimal | null {
  const trimmed = input.trim().replace(/\s|₺|TL/gi, "");
  if (trimmed === "") return null;
  if (!/^-?[\d.,]+$/.test(trimmed)) return null;

  const lastComma = trimmed.lastIndexOf(",");
  const lastDot = trimmed.lastIndexOf(".");

  let normalized: string;
  if (lastComma === -1 && lastDot === -1) {
    normalized = trimmed;
  } else if (lastComma > lastDot) {
    // virgül ondalık ayraç: "1.234,56"
    normalized = trimmed.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma && lastComma !== -1) {
    // nokta ondalık ayraç: "1,234.56" (yabancı biçim)
    normalized = trimmed.replace(/,/g, "");
  } else {
    // yalnızca nokta var. Son gruptaki basamak sayısı 3 ise binlik kabul edilir.
    const after = trimmed.slice(lastDot + 1);
    const dotCount = (trimmed.match(/\./g) ?? []).length;
    normalized =
      dotCount > 1 || after.length === 3
        ? trimmed.replace(/\./g, "")
        : trimmed;
  }

  try {
    const dec = new Decimal(normalized);
    return dec.isFinite() ? dec : null;
  } catch {
    return null;
  }
}

export { Decimal };
