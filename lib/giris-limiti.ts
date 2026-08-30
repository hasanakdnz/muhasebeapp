import "server-only";

import {
  KILIT_SURESI_MS,
  PENCERE_MS,
  limitDurumu,
  pencereyeIndir,
  type LimitDurumu,
} from "@/lib/domain/giris-limiti";

/**
 * Giriş deneme sayacı — süreç belleğinde.
 *
 * ## Bilinen sınır
 * Bellekte tutulduğu için yalnızca TEK süreç için geçerlidir; uygulama birden
 * fazla örnekle çalıştırılırsa her örnek kendi sayacını tutar ve sınır
 * örnek sayısı kadar gevşer. Bu kurulum tek süreç + SQLite üzerine kurulu
 * (CLAUDE.md), dolayısıyla bugün doğru çalışır. Çok örnekli bir dağıtımda
 * sayacın paylaşılan bir depoya (Redis / veritabanı tablosu) taşınması gerekir
 * — o gün geldiğinde değişecek tek yer burasıdır.
 *
 * Sayaç yalnızca BAŞARISIZ denemeleri tutar ve başarılı girişte sıfırlanır.
 */

const denemeler = new Map<string, number[]>();

/** Sayaç sonsuza dek büyümesin diye ara sıra ölü anahtarlar temizlenir. */
let sonTemizlik = 0;
const TEMIZLIK_ARALIGI_MS = 5 * 60_000;

function temizlikGerekliyse(simdi: number): void {
  if (simdi - sonTemizlik < TEMIZLIK_ARALIGI_MS) return;
  sonTemizlik = simdi;

  const eskiSinir = PENCERE_MS + KILIT_SURESI_MS;
  for (const [anahtar, kayit] of denemeler) {
    const kalan = pencereyeIndir(kayit, simdi, eskiSinir);
    if (kalan.length === 0) denemeler.delete(anahtar);
    else denemeler.set(anahtar, kalan);
  }
}

export function girisDenenebilirMi(
  anahtarlar: string[],
  simdi: number = Date.now()
): LimitDurumu {
  temizlikGerekliyse(simdi);

  // Anahtarlardan HERHANGİ biri kilitliyse giriş reddedilir; en uzun kalan
  // süre bildirilir.
  let enUzun: LimitDurumu = { izinli: true };
  for (const anahtar of anahtarlar) {
    const durum = limitDurumu(denemeler.get(anahtar) ?? [], simdi);
    if (
      !durum.izinli &&
      (enUzun.izinli || durum.kalanSaniye > enUzun.kalanSaniye)
    ) {
      enUzun = durum;
    }
  }
  return enUzun;
}

export function basarisizGirisKaydet(
  anahtarlar: string[],
  simdi: number = Date.now()
): void {
  for (const anahtar of anahtarlar) {
    const kayit = pencereyeIndir(denemeler.get(anahtar) ?? [], simdi);
    kayit.push(simdi);
    denemeler.set(anahtar, kayit);
  }
}

export function basariliGirisTemizle(anahtarlar: string[]): void {
  for (const anahtar of anahtarlar) denemeler.delete(anahtar);
}

/** Yalnızca testler için: sayacı tamamen boşaltır. */
export function girisSayaciniSifirla(): void {
  denemeler.clear();
  sonTemizlik = 0;
}

/** E-posta ve IP için ayrı anahtar üretir (bkz. lib/domain/giris-limiti.ts). */
export function girisAnahtarlari(
  email: string,
  ip: string | null
): string[] {
  const anahtarlar = [`eposta:${email.trim().toLowerCase()}`];
  if (ip) anahtarlar.push(`ip:${ip}`);
  return anahtarlar;
}
