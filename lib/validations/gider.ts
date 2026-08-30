import { z } from "zod";
import { GIDER_KATEGORILERI, GIDER_KDV_ORANLARI } from "@/lib/domain/gider";
import {
  optionalText,
  tarihAlani,
  tutarAlani,
} from "@/lib/validations/common";

export const giderSchema = z.object({
  kategori: z.enum(GIDER_KATEGORILERI, { message: "Kategori seçin." }),
  /** Fişin üzerindeki KDV DAHİL tutar. */
  tutar: tutarAlani({ zorunlu: true, pozitif: true, label: "Tutar" }),
  kdvOrani: z.enum(GIDER_KDV_ORANLARI, { message: "KDV oranı seçin." }),
  aciklama: optionalText(300, "Açıklama"),
  /** Paranın çıkacağı hesap; boş bırakılırsa kasa hareketi oluşmaz. */
  hesapId: optionalText(64, "Hesap"),
  tarih: tarihAlani,
});

export type GiderInput = z.input<typeof giderSchema>;
export type GiderOutput = z.output<typeof giderSchema>;

export const giderFormDefaults: GiderInput = {
  kategori: "Diğer",
  tutar: "",
  kdvOrani: "20",
  aciklama: "",
  hesapId: "",
  tarih: "",
};
