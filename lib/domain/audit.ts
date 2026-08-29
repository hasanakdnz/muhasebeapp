import { CEK_SENET_DURUM_ETIKETI } from "@/lib/domain/cek-senet";
import { ODEME_KAYNAK_ETIKETI } from "@/lib/domain/odeme";
import { PROFORMA_DURUM_ETIKETI } from "@/lib/domain/proforma";

/**
 * Denetim kaydının saf tarafı — etiketler ve detay biçimlendirme.
 * Prisma'sız, doğrudan test edilebilir (kayıt yazma: lib/audit.ts).
 */

export const AUDIT_AKSIYONLARI = [
  "OLUSTUR",
  "GUNCELLE",
  "SIL",
  "ODEME",
  "TAHSILAT",
  "CIRO",
  "DURUM",
] as const;
export type AuditAksiyonu = (typeof AUDIT_AKSIYONLARI)[number];

export const AUDIT_AKSIYON_ETIKETI: Record<AuditAksiyonu, string> = {
  OLUSTUR: "Oluşturdu",
  GUNCELLE: "Güncelledi",
  SIL: "Sildi",
  ODEME: "Ödeme kaydetti",
  TAHSILAT: "Tahsilat kaydetti",
  CIRO: "Ciro etti",
  DURUM: "Durum değiştirdi",
};

/**
 * DESIGN.md: renk yalnızca anlam taşıdığında. Silme geri alınamaz — tek
 * kırmızı burasıdır; para hareketleri nötr kalır, çünkü bir ödemenin
 * kaydedilmiş olması iyi ya da kötü bir haber değildir.
 */
export const AUDIT_AKSIYON_TONU: Record<
  AuditAksiyonu,
  "negative" | "neutral"
> = {
  OLUSTUR: "neutral",
  GUNCELLE: "neutral",
  SIL: "negative",
  ODEME: "neutral",
  TAHSILAT: "neutral",
  CIRO: "neutral",
  DURUM: "neutral",
};

export const AUDIT_HEDEF_ETIKETI: Record<string, string> = {
  Cari: "Cari",
  Islem: "İşlem",
  IslemOdeme: "Fatura ödemesi",
  KasaBanka: "Kasa/Banka hesabı",
  HesapHareketi: "Hesap hareketi",
  CekSenet: "Çek/Senet",
  CekSenetTahsilat: "Çek tahsilatı",
  Gider: "Gider",
  Proforma: "Teklif",
  Firma: "Firma bilgileri",
};

export function hedefEtiketi(hedefTip: string): string {
  return AUDIT_HEDEF_ETIKETI[hedefTip] ?? hedefTip;
}

/** Detay JSON'ında gösterilecek alanlar ve Türkçe karşılıkları. */
const DETAY_ETIKETI: Record<string, string> = {
  unvan: "Ünvan",
  no: "No",
  proformaNo: "Teklif no",
  tip: "Tip",
  yon: "Yön",
  kaynak: "Kaynak",
  kategori: "Kategori",
  aciklama: "Açıklama",
  alan: "Alan",
  yeniDurum: "Yeni durum",
  tarih: "Tarih",
};

/**
 * Ham enum değerlerini okunur karşılıklarına çevirir.
 *
 * Denetim kaydı kullanıcıya gösterilir; ekranda "KABUL" ya da "CEK_TAHSILATI"
 * görmek, kodu bilmeyen bir muhasebeciye hiçbir şey anlatmaz. Karşılığı
 * bilinmeyen değer olduğu gibi bırakılır — kaydın kendisi hiçbir zaman
 * gizlenmez.
 */
function degeriCevir(anahtar: string, deger: string, hedefTip: string): string {
  if (anahtar === "yeniDurum") {
    if (hedefTip === "Proforma") {
      return PROFORMA_DURUM_ETIKETI[
        deger as keyof typeof PROFORMA_DURUM_ETIKETI
      ] ?? deger;
    }
    if (hedefTip === "CekSenet") {
      return (
        CEK_SENET_DURUM_ETIKETI[
          deger as keyof typeof CEK_SENET_DURUM_ETIKETI
        ] ?? deger
      );
    }
  }
  if (anahtar === "kaynak") {
    if (deger === "proforma") return "Tekliften dönüştürüldü";
    return (
      ODEME_KAYNAK_ETIKETI[deger as keyof typeof ODEME_KAYNAK_ETIKETI] ?? deger
    );
  }
  if (anahtar === "tip") {
    const tipler: Record<string, string> = {
      SATIS: "Satış",
      ALIS: "Alış",
      CEK: "Çek",
      SENET: "Senet",
    };
    return tipler[deger] ?? deger;
  }
  if (anahtar === "yon") {
    const yonler: Record<string, string> = {
      GIRIS: "Giriş",
      CIKIS: "Çıkış",
      ALINAN: "Alınan",
      VERILEN: "Verilen",
    };
    return yonler[deger] ?? deger;
  }
  return deger;
}

export type DetayParcasi = {
  etiket: string;
  deger: string;
  /** Tutar ise ekranda para biçiminde ve data-numeric gösterilir. */
  tutarMi: boolean;
};

/**
 * Detay nesnesini okunur parçalara çevirir.
 *
 * Kimlik alanları (`cariId`, `islemId` gibi) DIŞARIDA bırakılır: kullanıcıya
 * hiçbir şey anlatmayan cuid dizeleri satırı okunmaz hale getirir. Tutar ve
 * ad/no gibi insanın tanıyacağı bilgiler gösterilir.
 */
export function detayParcalari(
  detay: Record<string, unknown> | null,
  hedefTip = ""
): DetayParcasi[] {
  if (!detay) return [];

  const parcalar: DetayParcasi[] = [];

  if (typeof detay.tutar === "string" || typeof detay.tutar === "number") {
    parcalar.push({
      etiket: "Tutar",
      deger: String(detay.tutar),
      tutarMi: true,
    });
  }

  for (const [anahtar, etiket] of Object.entries(DETAY_ETIKETI)) {
    const deger = detay[anahtar];
    if (deger === undefined || deger === null || deger === "") continue;
    parcalar.push({
      etiket,
      deger: degeriCevir(anahtar, String(deger), hedefTip),
      tutarMi: false,
    });
  }

  if (detay.geriAlindi === true) {
    parcalar.push({ etiket: "Ciro", deger: "geri alındı", tutarMi: false });
  }
  if (detay.kaldirildi === true) {
    parcalar.push({ etiket: "Durum", deger: "kaldırıldı", tutarMi: false });
  }
  if (detay.logoDegisti === true) {
    parcalar.push({ etiket: "Logo", deger: "değiştirildi", tutarMi: false });
  }

  return parcalar;
}
