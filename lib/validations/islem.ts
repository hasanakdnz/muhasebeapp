import { z } from "zod";
import {
  BIRIM_FIYAT_BASAMAK,
  ISLEM_TIPLERI,
  KDV_ORANLARI,
} from "@/lib/domain/islem";
import {
  opsiyonelTarihAlani,
  optionalText,
  sayiAlani,
  tarihAlani,
} from "@/lib/validations/common";

export const MIKTAR_BASAMAK = 4;

export const kalemSchema = z.object({
  urunAdi: z
    .string()
    .trim()
    .min(1, "Ürün/hizmet adı gerekli.")
    .max(200, "Ürün/hizmet adı en fazla 200 karakter olabilir."),
  miktar: sayiAlani({
    basamak: MIKTAR_BASAMAK,
    zorunlu: true,
    pozitif: true,
    label: "Miktar",
  }),
  /** Girilen fiyat; `kdvDahil` işaretliyse brüt kabul edilir ve net'e çevrilir. */
  birimFiyat: sayiAlani({
    basamak: BIRIM_FIYAT_BASAMAK,
    zorunlu: true,
    pozitif: true,
    label: "Birim fiyat",
  }),
  kdvOrani: z.enum(KDV_ORANLARI, { message: "KDV oranı seçin." }),
});

export const islemSchema = z.object({
  tip: z.enum(ISLEM_TIPLERI, { message: "İşlem tipi seçin." }),
  cariId: z.string().trim().min(1, "Cari seçin."),
  /**
   * Karşı tarafın belge numarası. Alış faturasında fişin üzerindeki numaradır;
   * iç referans numarası (`Islem.no`) sunucuda üretilir, kullanıcı giremez.
   */
  belgeNo: optionalText(50, "Belge no"),
  tarih: tarihAlani,
  // Boş bırakılırsa "vade yok" demektir; bugüne DÜŞMEZ.
  vadeTarihi: opsiyonelTarihAlani,
  /**
   * Arayüz kolaylığı: kullanıcı fiyatları KDV dahil girebilir. Veritabanına
   * DAİMA KDV hariç (net) yazılır — dönüşüm sunucuda kdvDahilNete ile yapılır.
   */
  kdvDahil: z.boolean().default(false),
  kalemler: z.array(kalemSchema).min(1, "En az bir kalem ekleyin."),
});

export type IslemInput = z.input<typeof islemSchema>;
export type IslemOutput = z.output<typeof islemSchema>;
export type KalemInput = z.input<typeof kalemSchema>;

export const bosKalem: KalemInput = {
  urunAdi: "",
  miktar: "1",
  birimFiyat: "",
  kdvOrani: "20",
};

export const islemFormDefaults: IslemInput = {
  tip: "SATIS",
  cariId: "",
  belgeNo: "",
  tarih: "",
  vadeTarihi: "",
  kdvDahil: false,
  kalemler: [bosKalem],
};
