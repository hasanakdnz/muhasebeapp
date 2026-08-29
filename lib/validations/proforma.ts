import { z } from "zod";
import { kalemSchema } from "@/lib/validations/islem";
import {
  opsiyonelTarihAlani,
  optionalText,
  tarihAlani,
} from "@/lib/validations/common";

/**
 * Proforma formu. Kalem şeması işlemle AYNI (`kalemSchema`) — teklif kabul
 * edilince aynı satırlar faturaya geçecek; iki ayrı şema olsaydı teklifte
 * geçerli olan bir kalem faturada reddedilebilirdi.
 */
export const proformaSchema = z.object({
  cariId: z.string().trim().min(1, "Cari seçin."),
  tarih: tarihAlani,
  // Boş bırakılırsa "süresiz teklif" demektir; bugüne DÜŞMEZ.
  gecerlilikTarihi: opsiyonelTarihAlani,
  notlar: optionalText(1000, "Notlar"),
  /** İşlem formundaki gibi: fiyatlar KDV dahil girilebilir, net saklanır. */
  kdvDahil: z.boolean().default(false),
  kalemler: z.array(kalemSchema).min(1, "En az bir kalem ekleyin."),
});

export type ProformaInput = z.input<typeof proformaSchema>;
export type ProformaOutput = z.output<typeof proformaSchema>;

export const proformaFormDefaults: ProformaInput = {
  cariId: "",
  tarih: "",
  gecerlilikTarihi: "",
  notlar: "",
  kdvDahil: false,
  kalemler: [{ urunAdi: "", miktar: "1", birimFiyat: "", kdvOrani: "20" }],
};
