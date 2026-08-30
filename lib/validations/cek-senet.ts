import { z } from "zod";
import {
  CEK_SENET_DURUMLARI,
  CEK_SENET_TIPLERI,
  CEK_SENET_YONLERI,
} from "@/lib/domain/cek-senet";
import {
  optionalText,
  tarihAlani,
  tutarAlani,
} from "@/lib/validations/common";

export const cekSenetSchema = z.object({
  tip: z.enum(CEK_SENET_TIPLERI, { message: "Tip seçin." }),
  yon: z.enum(CEK_SENET_YONLERI, { message: "Yön seçin." }),
  cariId: z.string().trim().min(1, "Cari seçin."),
  tutar: tutarAlani({ zorunlu: true, pozitif: true, label: "Tutar" }),
  /** Çekin ALINDIĞI / VERİLDİĞİ tarih — cari bakiyesi bu anda değişir. */
  tarih: tarihAlani,
  vadeTarihi: tarihAlani,
  aciklama: optionalText(200, "Açıklama"),
});

export type CekSenetInput = z.input<typeof cekSenetSchema>;
export type CekSenetOutput = z.output<typeof cekSenetSchema>;

export const cekSenetFormDefaults: CekSenetInput = {
  tip: "CEK",
  yon: "ALINAN",
  cariId: "",
  tutar: "",
  tarih: "",
  vadeTarihi: "",
  aciklama: "",
};

/**
 * Tahsilat girişi. Kalandan fazla olamaz — bu kural tutarın kendisine değil
 * çek/senedin durumuna bağlı olduğu için sunucuda, alan katmanındaki
 * `tahsilatKontrol` ile uygulanır.
 */
export const tahsilatSchema = z.object({
  tutar: tutarAlani({ zorunlu: true, pozitif: true, label: "Tahsilat tutarı" }),
  tarih: tarihAlani,
  aciklama: optionalText(200, "Açıklama"),
});

export type TahsilatInput = z.input<typeof tahsilatSchema>;
export type TahsilatOutput = z.output<typeof tahsilatSchema>;

/** Elle seçilebilen durumlar — TAHSIL_EDILDI tahsilat kayıtlarından doğar. */
export const ELLE_SECILEBILIR_DURUMLAR = CEK_SENET_DURUMLARI.filter(
  (d) => d !== "TAHSIL_EDILDI"
);

export const durumSchema = z.object({
  durum: z.enum(CEK_SENET_DURUMLARI, { message: "Durum seçin." }),
});
