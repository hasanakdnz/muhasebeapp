/**
 * Belge numaralandırma — saf, Prisma'sız, doğrudan test edilebilir.
 *
 * Teklif (`PRF`), satış faturası (`FTR`) ve alış kaydı (`ALS`) aynı kuralı
 * kullanır: `ÖNEK-YIL-SIRA`. Kural tek yerde durur; üç ayrı kopya olsaydı
 * biri düzeltilip diğerleri unutulabilirdi.
 *
 * ## Sıra neden kayıt sayısından üretilmez
 * Aradan bir kayıt silinirse sayı düşer ve daha önce kullanılmış bir numara
 * yeniden verilirdi. Bu yüzden o yılın mevcut numaraları arasındaki EN BÜYÜK
 * sıra esas alınır.
 */

const SIRA_BASAMAK = 4;

export function belgeNoUret(onek: string, yil: number, sira: number): string {
  return `${onek}-${yil}-${String(sira).padStart(SIRA_BASAMAK, "0")}`;
}

export function belgeNoAyristir(
  onek: string,
  no: string
): { yil: number; sira: number } | null {
  const kalip = new RegExp(`^${onek}-(\\d{4})-(\\d+)$`);
  const eslesme = kalip.exec(no.trim());
  if (!eslesme) return null;
  return { yil: Number(eslesme[1]), sira: Number(eslesme[2]) };
}

/** O yılın bir sonraki numarası. Yıl değişince sıra 1'e döner. */
export function sonrakiBelgeNo(
  onek: string,
  yil: number,
  mevcutNolar: string[]
): string {
  let enBuyuk = 0;
  for (const no of mevcutNolar) {
    const parca = belgeNoAyristir(onek, no);
    if (parca && parca.yil === yil && parca.sira > enBuyuk) {
      enBuyuk = parca.sira;
    }
  }
  return belgeNoUret(onek, yil, enBuyuk + 1);
}
