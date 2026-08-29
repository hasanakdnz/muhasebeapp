import { z } from "zod";
import { ODEME_KAYNAKLARI } from "@/lib/domain/odeme";
import {
  optionalText,
  tarihAlani,
  tutarAlani,
} from "@/lib/validations/common";

/**
 * Fatura ödemesi girdisi.
 *
 * Diğer tüm formlarda olduğu gibi tutar `tutarAlani`'ndan geçer: kullanıcı
 * "3.930,00" yazar, alan katmanına kanonik "3930" gider. Bu ara katman
 * atlanırsa alan katmanı Türkçe biçimi çözemez ve hata fırlatır.
 */
export const odemeSchema = z
  .object({
    tutar: tutarAlani({ zorunlu: true, pozitif: true, label: "Ödeme tutarı" }),
    tarih: tarihAlani,
    kaynak: z.enum(ODEME_KAYNAKLARI, { message: "Ödeme kaynağı seçin." }),
    cekSenetTahsilatId: optionalText(64, "Tahsilat"),
    aciklama: optionalText(200, "Açıklama"),
  })
  .refine(
    (v) => v.kaynak !== "CEK_TAHSILATI" || Boolean(v.cekSenetTahsilatId),
    { message: "Çek tahsilatı seçin.", path: ["cekSenetTahsilatId"] }
  );

export type OdemeInput = z.input<typeof odemeSchema>;
export type OdemeOutput = z.output<typeof odemeSchema>;
