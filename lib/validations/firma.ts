import { z } from "zod";
import { optionalText } from "@/lib/validations/common";

/**
 * Firma bilgileri — proforma/teklif başlığında görünen künye.
 *
 * VKN 10, TCKN 11 hane. Alan zorunlu değil (yeni kurulumda boş olabilir) ama
 * doldurulmuşsa hane sayısı doğrulanır: yanlış vergi numarası taşıyan bir
 * teklif, müşteriye giden resmî görünümlü bir belgede hatalı bilgi demektir.
 */
export const firmaSchema = z.object({
  unvan: z
    .string()
    .trim()
    .min(2, "Firma ünvanı en az 2 karakter olmalı.")
    .max(160, "Firma ünvanı en fazla 160 karakter olabilir."),
  vknTckn: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined))
    .refine(
      (v) => v === undefined || /^\d{10}$|^\d{11}$/.test(v),
      "VKN 10, TCKN 11 haneli olmalı."
    ),
  vergiDairesi: optionalText(80, "Vergi dairesi"),
  adres: optionalText(300, "Adres"),
  telefon: optionalText(30, "Telefon"),
  email: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined))
    .refine(
      (v) => v === undefined || z.email().safeParse(v).success,
      "Geçerli bir e-posta girin."
    ),
  iban: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.replace(/\s+/g, "").toUpperCase() : undefined))
    .transform((v) => (v && v.length > 0 ? v : undefined))
    .refine(
      (v) => v === undefined || /^TR\d{24}$/.test(v),
      "IBAN 'TR' ile başlamalı ve 26 karakter olmalı."
    ),
});

export type FirmaInput = z.input<typeof firmaSchema>;
export type FirmaOutput = z.output<typeof firmaSchema>;
