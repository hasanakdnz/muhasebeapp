import { z } from "zod";
import { parseAmountInput, roundMoney } from "@/lib/money";

/** Boş bırakılan metin alanları undefined'a normalize edilir (DB'de NULL). */
export const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} en fazla ${max} karakter olabilir.`)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined));

/**
 * Tutar alanı. Girdi kullanıcı biçiminde ("1.234,56"), çıktı Decimal'in
 * kanonik string gösterimi — RSC sınırından geçebilsin diye string tutulur,
 * hesaplama her zaman Decimal ile yapılır.
 *
 * `zorunlu`: boş bırakılamaz. `pozitif`: sıfır ve negatif reddedilir
 * (yön ayrı bir alanla belirlenen hareket tutarları için).
 */
export const tutarAlani = (
  secenek: { zorunlu?: boolean; pozitif?: boolean; label?: string } = {}
) => {
  const label = secenek.label ?? "Tutar";
  return z
    .string()
    .optional()
    .superRefine((val, ctx) => {
      const raw = (val ?? "").trim();
      if (raw === "") {
        if (secenek.zorunlu) {
          ctx.addIssue({ code: "custom", message: `${label} gerekli.` });
        }
        return;
      }
      const parsed = parseAmountInput(raw);
      if (parsed === null) {
        ctx.addIssue({ code: "custom", message: "Geçerli bir tutar girin." });
        return;
      }
      // decimal.js: isPositive() sıfır için de true döner — greaterThan(0) şart.
      if (secenek.pozitif && !roundMoney(parsed).greaterThan(0)) {
        ctx.addIssue({
          code: "custom",
          message: `${label} sıfırdan büyük olmalı.`,
        });
      }
    })
    .transform((val) => {
      const raw = (val ?? "").trim();
      if (raw === "") return "0";
      const parsed = parseAmountInput(raw);
      return parsed ? roundMoney(parsed).toString() : "0";
    });
};

/**
 * Ondalıklı sayı alanı (tutar değil): miktar, birim fiyat gibi.
 * `basamak` kadar ondalığa yuvarlar — miktar kg/saat olabilir, birim fiyat
 * kuruştan hassas tutulur (KDV dahil girişte sapmayı azaltır).
 */
export const sayiAlani = (secenek: {
  basamak: number;
  zorunlu?: boolean;
  pozitif?: boolean;
  label: string;
}) =>
  z
    .string()
    .optional()
    .superRefine((val, ctx) => {
      const raw = (val ?? "").trim();
      if (raw === "") {
        if (secenek.zorunlu) {
          ctx.addIssue({ code: "custom", message: `${secenek.label} gerekli.` });
        }
        return;
      }
      const parsed = parseAmountInput(raw);
      if (parsed === null) {
        ctx.addIssue({
          code: "custom",
          message: `${secenek.label} geçerli bir sayı olmalı.`,
        });
        return;
      }
      if (secenek.pozitif && !parsed.greaterThan(0)) {
        ctx.addIssue({
          code: "custom",
          message: `${secenek.label} sıfırdan büyük olmalı.`,
        });
      }
    })
    .transform((val) => {
      const raw = (val ?? "").trim();
      if (raw === "") return "0";
      const parsed = parseAmountInput(raw);
      return parsed ? parsed.toDecimalPlaces(secenek.basamak).toString() : "0";
    });

/** <input type="date"> değerini (YYYY-MM-DD) yerel gün başına çevirir. */
export const tarihAlani = z
  .string()
  .optional()
  .superRefine((val, ctx) => {
    const raw = (val ?? "").trim();
    if (raw === "") return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) {
      ctx.addIssue({ code: "custom", message: "Geçerli bir tarih girin." });
    }
  })
  .transform((val) => {
    const raw = (val ?? "").trim();
    if (raw === "") return new Date();
    const [yil, ay, gun] = raw.split("-").map(Number);
    // Yerel saat diliminde gün başı — UTC'ye çevrilince gün kaymasın.
    return new Date(yil, ay - 1, gun);
  });

/**
 * Opsiyonel tarih: boş bırakılırsa undefined döner.
 *
 * `tarihAlani` boşken BUGÜNE düşer — bu, işlem/hareket tarihi gibi zorunlu
 * alanlar için doğrudur. Vade tarihi gibi isteğe bağlı alanlarda ise boş bırakmak
 * "vade yok" demektir; bugüne düşerse vade takibinde yanlış gecikme üretirdi.
 */
export const opsiyonelTarihAlani = z
  .string()
  .optional()
  .superRefine((val, ctx) => {
    const raw = (val ?? "").trim();
    if (raw === "") return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) {
      ctx.addIssue({ code: "custom", message: "Geçerli bir tarih girin." });
    }
  })
  .transform((val) => {
    const raw = (val ?? "").trim();
    if (raw === "") return undefined;
    const [yil, ay, gun] = raw.split("-").map(Number);
    return new Date(yil, ay - 1, gun);
  });
