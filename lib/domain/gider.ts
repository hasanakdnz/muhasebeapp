import { roundMoney, toDecimal, type DecimalLike } from "@/lib/money";

/**
 * Gider (masraf) mantığı — saf, Prisma'sız, doğrudan test edilebilir.
 *
 * ## Tutar tanımı
 * `Gider.tutar` KDV DAHİL toplamdır — fişin üzerindeki rakam. Kullanıcı masrafı
 * böyle düşünür ("100 TL yakıt aldım"). KDV bu tutarın İÇİNDEN ayrılır:
 *
 *     kdv = tutar × oran / (100 + oran)
 *
 * Satış tarafındaki `hesaplaKalem` KDV'yi matrahın ÜSTÜNE ekler; buradaki işlem
 * onun tersidir. İkisi karıştırılmamalı.
 */

/** Türkiye'de yürürlükteki KDV oranları + istisna. */
export const GIDER_KDV_ORANLARI = ["0", "1", "10", "20"] as const;
export type GiderKdvOraniValue = (typeof GIDER_KDV_ORANLARI)[number];

/** KOBİ masraflarında sık kullanılan kategoriler. */
export const GIDER_KATEGORILERI = [
  "Kira",
  "Personel",
  "Elektrik / Su / Doğalgaz",
  "İnternet / Telefon",
  "Yakıt",
  "Nakliye",
  "Ofis giderleri",
  "Bakım / Onarım",
  "Danışmanlık",
  "Vergi / Harç",
  "Sigorta",
  "Reklam / Pazarlama",
  "Diğer",
] as const;
export type GiderKategoriValue = (typeof GIDER_KATEGORILERI)[number];

export type KdvAyrimi = {
  /** KDV hariç tutar. */
  matrah: string;
  /** Brüt tutarın içinden ayrılan KDV. */
  kdv: string;
  /** KDV dahil tutar (girdi). */
  brut: string;
};

/**
 * KDV dahil tutardan KDV'yi ayırır.
 *
 * Örnek: 120 TL, %20 → kdv 20, matrah 100.
 * Oran 0 ise KDV yoktur, matrah brüte eşittir.
 */
export function kdvAyir(brutTutar: DecimalLike, oran: DecimalLike): KdvAyrimi {
  const brut = roundMoney(brutTutar);
  const o = toDecimal(oran);

  if (o.isZero()) {
    return { matrah: brut.toString(), kdv: "0", brut: brut.toString() };
  }

  const kdv = roundMoney(brut.times(o).dividedBy(o.plus(100)));
  return {
    matrah: brut.minus(kdv).toString(),
    kdv: kdv.toString(),
    brut: brut.toString(),
  };
}

export type GiderOzeti = {
  /** KDV dahil toplam. */
  toplam: string;
  /** Toplam KDV — Faz 7'de indirilecek KDV tarafını besler. */
  toplamKdv: string;
  /** KDV hariç toplam. */
  toplamMatrah: string;
  giderSayisi: number;
};

export function hesaplaGiderOzeti(
  giderler: Array<{ tutar: DecimalLike; kdvTutari: DecimalLike }>
): GiderOzeti {
  let toplam = toDecimal(0);
  let kdv = toDecimal(0);

  for (const g of giderler) {
    toplam = toplam.plus(roundMoney(g.tutar));
    kdv = kdv.plus(roundMoney(g.kdvTutari));
  }

  return {
    toplam: toplam.toString(),
    toplamKdv: kdv.toString(),
    toplamMatrah: toplam.minus(kdv).toString(),
    giderSayisi: giderler.length,
  };
}

export type KategoriToplami = {
  kategori: string;
  toplam: string;
  /** Toplam gider içindeki payı, yüzde (0-100), iki basamak. */
  yuzde: string;
  adet: number;
};

/**
 * Kategori bazında dağılım — en yüksekten düşüğe sıralı.
 * Yüzdeler de Decimal ile hesaplanır; toplam sıfırsa hepsi 0 döner.
 */
export function kategoriDagilimi(
  giderler: Array<{ kategori: string; tutar: DecimalLike }>
): KategoriToplami[] {
  const kovalar = new Map<string, { toplam: ReturnType<typeof toDecimal>; adet: number }>();

  for (const g of giderler) {
    const mevcut = kovalar.get(g.kategori);
    const tutar = roundMoney(g.tutar);
    if (mevcut) {
      mevcut.toplam = mevcut.toplam.plus(tutar);
      mevcut.adet += 1;
    } else {
      kovalar.set(g.kategori, { toplam: tutar, adet: 1 });
    }
  }

  let genelToplam = toDecimal(0);
  for (const { toplam } of kovalar.values()) genelToplam = genelToplam.plus(toplam);

  return [...kovalar.entries()]
    .map(([kategori, { toplam, adet }]) => ({
      kategori,
      toplam: toplam.toString(),
      yuzde: genelToplam.isZero()
        ? "0"
        : toplam.times(100).dividedBy(genelToplam).toDecimalPlaces(2).toString(),
      adet,
    }))
    .sort((a, b) => Number(b.toplam) - Number(a.toplam));
}
