import {
  belgeNoAyristir,
  belgeNoUret,
  sonrakiBelgeNo,
} from "@/lib/domain/belge-no";
import { kalanGun } from "@/lib/domain/vade";

/**
 * Proforma (teklif) — saf mantık, Prisma'sız, doğrudan test edilebilir.
 *
 * ## Neden ayrı bir kayıt
 * Proforma bir SATIŞ DEĞİLDİR, satış öncesi bir tekliftir. İşlem olarak
 * kaydedilseydi gerçekleşmemiş bir satış deftere yazılır, müşterinin borcu
 * haksız yere artar, KDV raporuna beyan edilmemiş KDV girerdi. Bu yüzden
 * proformanın cari bakiyesine, KDV'ye ve vade takibine HİÇBİR etkisi yoktur;
 * yalnızca kabul edildiğinde bir İşlem üretir ve muhasebe o anda başlar.
 *
 * ## Durum akışı
 *   TASLAK ──► GONDERILDI ──► KABUL ──► ISLEME_DONUSTU  (uç durum)
 *      │            └──────► RED
 *      └──────────────────► RED
 * Geriye dönüş yalnızca KABUL/RED'den GONDERILDI'ya mümkündür (yanlış
 * işaretlemeyi düzeltmek için). ISLEME_DONUSTU kilitlidir: karşılığında
 * gerçek bir fatura ve cari bakiye hareketi oluşmuştur, teklif artık
 * geçmişin kaydıdır.
 */

export const PROFORMA_DURUMLARI = [
  "TASLAK",
  "GONDERILDI",
  "KABUL",
  "RED",
  "ISLEME_DONUSTU",
] as const;
export type ProformaDurumuValue = (typeof PROFORMA_DURUMLARI)[number];

export const PROFORMA_DURUM_ETIKETI: Record<ProformaDurumuValue, string> = {
  TASLAK: "Taslak",
  GONDERILDI: "Gönderildi",
  KABUL: "Kabul edildi",
  RED: "Reddedildi",
  ISLEME_DONUSTU: "Faturalandı",
};

/** DESIGN.md: renk yalnızca anlam taşıdığında. Taslak nötr, bekleyen amber. */
export const PROFORMA_DURUM_TONU: Record<
  ProformaDurumuValue,
  "positive" | "negative" | "pending" | "neutral"
> = {
  TASLAK: "neutral",
  GONDERILDI: "pending",
  KABUL: "positive",
  RED: "negative",
  ISLEME_DONUSTU: "positive",
};

const GECISLER: Record<ProformaDurumuValue, ProformaDurumuValue[]> = {
  TASLAK: ["GONDERILDI", "RED"],
  GONDERILDI: ["KABUL", "RED"],
  KABUL: ["GONDERILDI", "ISLEME_DONUSTU"],
  RED: ["GONDERILDI"],
  ISLEME_DONUSTU: [],
};

export function gecerliDurumGecisi(
  mevcut: ProformaDurumuValue,
  yeni: ProformaDurumuValue
): boolean {
  return GECISLER[mevcut].includes(yeni);
}

/** Kullanıcıya gösterilecek geçişler — geçersiz seçenek arayüze hiç çıkmaz. */
export function sonrakiDurumlar(
  mevcut: ProformaDurumuValue
): ProformaDurumuValue[] {
  // İşleme dönüştürme ayrı ve daha ağır bir aksiyondur; durum menüsünde değil,
  // kendi onaylı düğmesinde durur.
  return GECISLER[mevcut].filter((d) => d !== "ISLEME_DONUSTU");
}

/** Faturalanmış teklif ne düzenlenir ne silinir — kaydı bozmak veriyi bozar. */
export function duzenlenebilirMi(durum: ProformaDurumuValue): boolean {
  return durum !== "ISLEME_DONUSTU";
}

export function silinebilirMi(durum: ProformaDurumuValue): boolean {
  return durum !== "ISLEME_DONUSTU";
}

/** Yalnızca kabul edilen teklif faturaya dönüşür. */
export function donusturulebilirMi(durum: ProformaDurumuValue): boolean {
  return durum === "KABUL";
}

/* ------------------------------------------------------------------ */
/* Numaralandırma                                                      */
/* ------------------------------------------------------------------ */

export const PROFORMA_NO_ONEKI = "PRF";

/** PRF-2026-0001 — ortak kural için bkz. lib/domain/belge-no.ts */
export function proformaNoUret(yil: number, sira: number): string {
  return belgeNoUret(PROFORMA_NO_ONEKI, yil, sira);
}

export function proformaNoAyristir(
  no: string
): { yil: number; sira: number } | null {
  return belgeNoAyristir(PROFORMA_NO_ONEKI, no);
}

export function sonrakiProformaNo(yil: number, mevcutNolar: string[]): string {
  return sonrakiBelgeNo(PROFORMA_NO_ONEKI, yil, mevcutNolar);
}

/* ------------------------------------------------------------------ */
/* Geçerlilik                                                          */
/* ------------------------------------------------------------------ */

/**
 * Teklifin süresi doldu mu? Yalnızca henüz karara bağlanmamış (gönderilmiş)
 * teklifler için anlamlıdır; kabul edilmiş bir teklifin geçerlilik tarihi
 * geçse de kabul geçerlidir.
 */
export function suresiDoldu(
  durum: ProformaDurumuValue,
  gecerlilikTarihi: Date | null | undefined,
  bugun: Date
): boolean {
  if (durum !== "GONDERILDI") return false;
  if (!gecerlilikTarihi) return false;
  return kalanGun(gecerlilikTarihi, bugun) < 0;
}

/* ------------------------------------------------------------------ */
/* Paylaşım                                                            */
/* ------------------------------------------------------------------ */

/**
 * WhatsApp bağlantısı için telefon numarasını uluslararası biçime getirir.
 *
 * Türkiye numaraları defterde "0532 …", "(532) …", "+90 532 …" gibi çok farklı
 * yazılır; wa.me yalnızca rakam ve ülke kodu kabul eder. Numara tanınmazsa
 * `null` döner ve arayüz alıcısız (kullanıcının kendi seçeceği) bir paylaşım
 * bağlantısı üretir — yanlış kişiye teklif göndermektense alıcısız göndermek
 * daha güvenlidir.
 */
export function whatsappNumarasi(telefon: string | null | undefined): string | null {
  if (!telefon) return null;
  const rakamlar = telefon.replace(/\D/g, "");
  if (rakamlar.length === 0) return null;

  // 0532… → 90532…
  if (rakamlar.length === 11 && rakamlar.startsWith("0")) {
    return `90${rakamlar.slice(1)}`;
  }
  // 532… → 90532…
  if (rakamlar.length === 10 && !rakamlar.startsWith("0")) {
    return `90${rakamlar}`;
  }
  // 90532… zaten ülke kodlu
  if (rakamlar.length === 12 && rakamlar.startsWith("90")) return rakamlar;
  // Yurt dışı numaraları: ülke kodlu olduğu varsayılır.
  if (rakamlar.length >= 11 && rakamlar.length <= 15) return rakamlar;
  return null;
}

export type PaylasimVerisi = {
  no: string;
  firmaUnvani: string;
  cariUnvan: string;
  toplamTutar: string;
  gecerlilikTarihi: string | null;
};

/**
 * Teklifin kısa metin özeti — WhatsApp ve e-posta gövdesinde kullanılır.
 *
 * Belgenin kendisi değil, belgeye eşlik eden mesajdır: uygulama dışarıya
 * dosya sunmadığı için (bulut depolama Faz 9'a ertelendi) teklif çıktısı
 * yazdırma/PDF olarak alınıp ayrıca eklenir. Metin bunu varsayar.
 */
export function paylasimMetni(veri: PaylasimVerisi): string {
  const satirlar = [
    `Sayın ${veri.cariUnvan},`,
    "",
    `${veri.no} numaralı teklifimiz ektedir.`,
    `Genel toplam: ${veri.toplamTutar}`,
  ];
  if (veri.gecerlilikTarihi) {
    satirlar.push(`Geçerlilik tarihi: ${veri.gecerlilikTarihi}`);
  }
  satirlar.push("", "İyi çalışmalar dileriz.");
  if (veri.firmaUnvani) satirlar.push(veri.firmaUnvani);
  return satirlar.join("\n");
}

export function paylasimKonusu(no: string, firmaUnvani: string): string {
  return firmaUnvani ? `${no} · ${firmaUnvani} teklifi` : `${no} numaralı teklif`;
}
