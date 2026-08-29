/**
 * Vade takibi — saf, Prisma'sız, doğrudan test edilebilir.
 *
 * ## Gün sınırı
 * Vade tarihi gün BAŞINA (yerel gece yarısı) kaydedilir; "şimdi" ise günün
 * herhangi bir saati olabilir. Düz zaman damgası karşılaştırması, bugün vadesi
 * gelen bir kaydı saat 00:01'den itibaren "gecikmiş" gösterirdi. Bu yüzden
 * karşılaştırma TAKVİM GÜNÜ üzerinden yapılır.
 */

export const VADE_DURUMLARI = ["gecti", "bugun", "yaklasiyor", "normal"] as const;
export type VadeDurumu = (typeof VADE_DURUMLARI)[number];

/** Vadesine bu kadar gün veya daha az kalan kayıtlar "yaklaşıyor" sayılır. */
export const VARSAYILAN_YAKLASMA_ESIGI = 7;

const GUN_MS = 24 * 60 * 60 * 1000;

function gunBasi(tarih: Date): number {
  const d = new Date(tarih);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Vadeye kalan gün sayısı. Negatif = gecikmiş, 0 = bugün.
 *
 * Yuvarlama bilinçlidir: yaz saati uygulaması olan bölgelerde bir "gün"
 * 23 veya 25 saat sürebilir; bölme sonucu tam sayıya yuvarlanmazsa sınır
 * günlerinde bir gün kayar.
 */
export function kalanGun(vadeTarihi: Date | string, bugun: Date | string): number {
  return Math.round((gunBasi(new Date(vadeTarihi)) - gunBasi(new Date(bugun))) / GUN_MS);
}

export function vadeDurumu(
  vadeTarihi: Date | string,
  bugun: Date | string,
  yaklasmaEsigi: number = VARSAYILAN_YAKLASMA_ESIGI
): VadeDurumu {
  const kalan = kalanGun(vadeTarihi, bugun);
  if (kalan < 0) return "gecti";
  if (kalan === 0) return "bugun";
  return kalan <= yaklasmaEsigi ? "yaklasiyor" : "normal";
}

/** Kullanıcıya gösterilecek kısa metin. */
export function vadeMetni(
  vadeTarihi: Date | string,
  bugun: Date | string,
  yaklasmaEsigi: number = VARSAYILAN_YAKLASMA_ESIGI
): string {
  const kalan = kalanGun(vadeTarihi, bugun);
  if (kalan < 0) return `${Math.abs(kalan)} gün gecikti`;
  if (kalan === 0) return "bugün vadeli";
  if (kalan <= yaklasmaEsigi) return `${kalan} gün kaldı`;
  return `${kalan} gün kaldı`;
}

/** Rozet rengi — DESIGN.md: geçmiş kırmızı, yaklaşan amber, normal nötr. */
export function vadeRozetVaryanti(
  durum: VadeDurumu
): "negative" | "pending" | "neutral" {
  if (durum === "gecti") return "negative";
  if (durum === "bugun" || durum === "yaklasiyor") return "pending";
  return "neutral";
}

export type VadeliKayit<T> = {
  kayit: T;
  vadeTarihi: Date;
  durum: VadeDurumu;
  kalanGun: number;
};

/**
 * Vadeli kayıtları durumlarına göre etiketler ve vadesi en yakından uzağa
 * sıralar. Gecikmiş olanlar en başta (en çok gecikmiş en üstte).
 */
export function vadeyeGoreSirala<T>(
  kayitlar: Array<{ kayit: T; vadeTarihi: Date }>,
  bugun: Date,
  yaklasmaEsigi: number = VARSAYILAN_YAKLASMA_ESIGI
): Array<VadeliKayit<T>> {
  return kayitlar
    .map(({ kayit, vadeTarihi }) => ({
      kayit,
      vadeTarihi,
      durum: vadeDurumu(vadeTarihi, bugun, yaklasmaEsigi),
      kalanGun: kalanGun(vadeTarihi, bugun),
    }))
    .sort((a, b) => a.kalanGun - b.kalanGun);
}

export type VadeOzeti = {
  gecen: number;
  bugunVadeli: number;
  yaklasan: number;
};

export function hesaplaVadeOzeti(
  vadeTarihleri: Array<Date | string>,
  bugun: Date | string,
  yaklasmaEsigi: number = VARSAYILAN_YAKLASMA_ESIGI
): VadeOzeti {
  const ozet: VadeOzeti = { gecen: 0, bugunVadeli: 0, yaklasan: 0 };
  for (const v of vadeTarihleri) {
    const durum = vadeDurumu(v, bugun, yaklasmaEsigi);
    if (durum === "gecti") ozet.gecen += 1;
    else if (durum === "bugun") ozet.bugunVadeli += 1;
    else if (durum === "yaklasiyor") ozet.yaklasan += 1;
  }
  return ozet;
}
