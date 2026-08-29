import { z } from "zod";
import { isValidVknTckn } from "@/lib/identity";
import { parseAmountInput, roundMoney } from "@/lib/money";

export const CARI_TIPLERI = ["MUSTERI", "TEDARIKCI", "HER_IKISI"] as const;
export type CariTipiValue = (typeof CARI_TIPLERI)[number];

export const CARI_TIP_ETIKETI: Record<CariTipiValue, string> = {
  MUSTERI: "Müşteri",
  TEDARIKCI: "Tedarikçi",
  HER_IKISI: "Her ikisi",
};

/** Boş bırakılan metin alanları undefined'a normalize edilir (DB'de NULL). */
const optionalText = (max: number, label: string) =>
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
 */
const tutarAlani = z
  .string()
  .optional()
  .superRefine((val, ctx) => {
    const raw = (val ?? "").trim();
    if (raw === "") return;
    if (parseAmountInput(raw) === null) {
      ctx.addIssue({ code: "custom", message: "Geçerli bir tutar girin." });
    }
  })
  .transform((val) => {
    const raw = (val ?? "").trim();
    if (raw === "") return "0";
    const parsed = parseAmountInput(raw);
    // superRefine geçtiyse parsed null olamaz.
    return parsed ? roundMoney(parsed).toString() : "0";
  });

export const cariSchema = z.object({
  unvan: z
    .string()
    .trim()
    .min(2, "Ünvan en az 2 karakter olmalı.")
    .max(200, "Ünvan en fazla 200 karakter olabilir."),

  tip: z.enum(CARI_TIPLERI, { message: "Cari tipi seçin." }),

  vknTckn: optionalText(11, "VKN/TCKN").refine(
    (v) => v === undefined || isValidVknTckn(v),
    "VKN 10 haneli, TCKN 11 haneli ve geçerli olmalı."
  ),

  vergiDairesi: optionalText(100, "Vergi dairesi"),

  telefon: optionalText(30, "Telefon").refine(
    (v) => v === undefined || /^[\d\s()+\-.]{7,}$/.test(v),
    "Geçerli bir telefon numarası girin."
  ),

  email: optionalText(160, "E-posta").refine(
    (v) => v === undefined || z.email().safeParse(v).success,
    "Geçerli bir e-posta adresi girin."
  ),

  adres: optionalText(500, "Adres"),

  /** Açılış bakiyesi. Pozitif: alacak (bizden alacaklı değil, bize borçlu),
   *  negatif: borç. Faz 3'te işlemler bakiyeyi güncellemeye başlayacak. */
  bakiye: tutarAlani,
});

export type CariInput = z.input<typeof cariSchema>;
export type CariOutput = z.output<typeof cariSchema>;

export const cariFormDefaults: CariInput = {
  unvan: "",
  tip: "MUSTERI",
  vknTckn: "",
  vergiDairesi: "",
  telefon: "",
  email: "",
  adres: "",
  bakiye: "",
};
