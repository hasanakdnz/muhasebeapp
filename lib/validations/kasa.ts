import { z } from "zod";
import { HAREKET_YONLERI } from "@/lib/domain/kasa";
import { optionalText, tarihAlani, tutarAlani } from "@/lib/validations/common";

export const HESAP_TIPLERI = ["KASA", "BANKA"] as const;
export type HesapTipiValue = (typeof HESAP_TIPLERI)[number];

export const HESAP_TIP_ETIKETI: Record<HesapTipiValue, string> = {
  KASA: "Kasa",
  BANKA: "Banka",
};

/**
 * Hesap tanımı.
 *
 * Açılış bakiyesi doğrudan `bakiye` alanına yazılmaz; bir "Açılış bakiyesi"
 * hareketi olarak kaydedilir. Böylece `KasaBanka.bakiye = Σ HesapHareketi.tutar`
 * değişmezi ilk andan itibaren korunur.
 */
export const hesapSchema = z.object({
  ad: z
    .string()
    .trim()
    .min(2, "Hesap adı en az 2 karakter olmalı.")
    .max(100, "Hesap adı en fazla 100 karakter olabilir."),
  tip: z.enum(HESAP_TIPLERI, { message: "Hesap tipi seçin." }),
  acilisBakiyesi: tutarAlani({ label: "Açılış bakiyesi" }),
  // Açılış hareketinin tarihi. Geriye dönük kayıt girmek (geçen ayı sonradan
  // işlemek) yaygın olduğu için ekstrede açılışın en başta kalması gerekir.
  acilisTarihi: tarihAlani,
});

export type HesapInput = z.input<typeof hesapSchema>;
export type HesapOutput = z.output<typeof hesapSchema>;

export const hesapFormDefaults: HesapInput = {
  ad: "",
  tip: "KASA",
  acilisBakiyesi: "",
  acilisTarihi: "",
};

/** Düzenlemede yalnızca ad ve tip değişir — bakiye hareketlerden gelir. */
export const hesapDuzenleSchema = hesapSchema.omit({
  acilisBakiyesi: true,
  acilisTarihi: true,
});
export type HesapDuzenleInput = z.input<typeof hesapDuzenleSchema>;
export type HesapDuzenleOutput = z.output<typeof hesapDuzenleSchema>;

/**
 * Hareket girişi. Kullanıcı daima POZİTİF tutar + yön girer; işaret
 * lib/domain/kasa.ts içindeki isaretliTutar ile tek noktadan uygulanır.
 */
export const hareketSchema = z.object({
  yon: z.enum(HAREKET_YONLERI, { message: "Hareket yönü seçin." }),
  tutar: tutarAlani({ zorunlu: true, pozitif: true, label: "Tutar" }),
  aciklama: optionalText(200, "Açıklama"),
  tarih: tarihAlani,
});

export type HareketInput = z.input<typeof hareketSchema>;
export type HareketOutput = z.output<typeof hareketSchema>;
