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
    cekSenetId: optionalText(64, "Çek/Senet"),
    /** Paranın gireceği/çıkacağı hesap; boş bırakılırsa kasa hareketi oluşmaz. */
    hesapId: optionalText(64, "Hesap"),
    aciklama: optionalText(200, "Açıklama"),
  })
  .refine((v) => v.kaynak !== "CEK" || Boolean(v.cekSenetId), {
    message: "Çek/senet seçin.",
    path: ["cekSenetId"],
  });

export type OdemeInput = z.input<typeof odemeSchema>;
export type OdemeOutput = z.output<typeof odemeSchema>;
