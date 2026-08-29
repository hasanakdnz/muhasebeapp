import { z } from "zod";
import { isValidVknTckn } from "@/lib/identity";
import { optionalText, tutarAlani } from "@/lib/validations/common";

export const CARI_TIPLERI = ["MUSTERI", "TEDARIKCI", "HER_IKISI"] as const;
export type CariTipiValue = (typeof CARI_TIPLERI)[number];

export const CARI_TIP_ETIKETI: Record<CariTipiValue, string> = {
  MUSTERI: "Müşteri",
  TEDARIKCI: "Tedarikçi",
  HER_IKISI: "Her ikisi",
};

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
  bakiye: tutarAlani({ label: "Açılış bakiyesi" }),
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
