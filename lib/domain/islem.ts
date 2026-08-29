import { roundMoney, toDecimal, type DecimalLike } from "@/lib/money";

/**
 * Satış/Alış işlemi ve KDV mantığı — saf, Prisma'sız, doğrudan test edilebilir.
 *
 * ## Fiyat tanımı
 * `IslemKalemi.birimFiyat` HER ZAMAN **KDV hariç (net)** saklanır. Şemada
 * "dahil mi hariç mi" bayrağı olmadığı için saklamanın tek bir anlamı olmalı;
 * kullanıcı KDV dahil girmek isterse arayüz `kdvDahilNete` ile önce net'e
 * çevirir, veritabanına daima net gider.
 *
 * ## Yuvarlama
 * KDV, e-Fatura pratiğindeki gibi SATIR BAZINDA kuruşa yuvarlanır, toplamlar
 * bu yuvarlanmış satırlardan üretilir. Yalnızca toplamda yuvarlansaydı, genel
 * toplam ekranda görünen satırların toplamıyla uyuşmayabilirdi.
 */

/** Türkiye'de yürürlükteki KDV oranları (Temmuz 2023'ten beri) + istisna. */
export const KDV_ORANLARI = ["0", "1", "10", "20"] as const;
export type KdvOraniValue = (typeof KDV_ORANLARI)[number];

/** Birim fiyat bir tutar değil bir fiyattır; KDV dahil girişte sapmayı
 *  azaltmak için kuruştan daha hassas tutulur. */
export const BIRIM_FIYAT_BASAMAK = 4;

export const ISLEM_TIPLERI = ["SATIS", "ALIS"] as const;
export type IslemTipiValue = (typeof ISLEM_TIPLERI)[number];

export const ISLEM_TIP_ETIKETI: Record<IslemTipiValue, string> = {
  SATIS: "Satış",
  ALIS: "Alış",
};

export type KalemGirdisi = {
  miktar: DecimalLike;
  /** KDV hariç birim fiyat. */
  birimFiyat: DecimalLike;
  /** Yüzde olarak KDV oranı (örn. "20"). */
  kdvOrani: DecimalLike;
};

export type KalemHesabi = {
  /** miktar × birimFiyat (KDV matrahı), kuruşa yuvarlı. */
  matrah: string;
  /** matrah × oran / 100, kuruşa yuvarlı. */
  kdv: string;
  /** matrah + kdv. */
  brut: string;
};

export function hesaplaKalem(kalem: KalemGirdisi): KalemHesabi {
  const matrah = roundMoney(
    toDecimal(kalem.miktar).times(toDecimal(kalem.birimFiyat))
  );
  const kdv = roundMoney(matrah.times(toDecimal(kalem.kdvOrani)).dividedBy(100));
  return {
    matrah: matrah.toString(),
    kdv: kdv.toString(),
    brut: matrah.plus(kdv).toString(),
  };
}

export type IslemToplamlari = {
  kalemler: KalemHesabi[];
  /** KDV hariç toplam. */
  toplamMatrah: string;
  /** Toplam KDV. */
  kdvTutari: string;
  /** KDV dahil genel toplam — Islem.toplamTutar bu değerdir. */
  toplamTutar: string;
};

export function hesaplaIslemToplamlari(
  kalemler: KalemGirdisi[]
): IslemToplamlari {
  const hesaplananlar = kalemler.map(hesaplaKalem);

  let matrah = toDecimal(0);
  let kdv = toDecimal(0);
  for (const k of hesaplananlar) {
    matrah = matrah.plus(k.matrah);
    kdv = kdv.plus(k.kdv);
  }

  return {
    kalemler: hesaplananlar,
    toplamMatrah: matrah.toString(),
    kdvTutari: kdv.toString(),
    toplamTutar: matrah.plus(kdv).toString(),
  };
}

/**
 * KDV dahil girilen birim fiyatı net'e çevirir: net = brüt / (1 + oran/100).
 * Sonuç BIRIM_FIYAT_BASAMAK basamağa yuvarlanır — kuruşa yuvarlansaydı
 * çok miktarlı satırlarda birkaç kuruş sapma oluşurdu.
 */
export function kdvDahilNete(
  brutBirimFiyat: DecimalLike,
  kdvOrani: DecimalLike
): string {
  const oran = toDecimal(kdvOrani);
  const carpan = toDecimal(1).plus(oran.dividedBy(100));
  return toDecimal(brutBirimFiyat)
    .dividedBy(carpan)
    .toDecimalPlaces(BIRIM_FIYAT_BASAMAK)
    .toString();
}

/** Net birim fiyattan KDV dahil fiyat — arayüzde geri gösterim için. */
export function neteKdvEkle(
  netBirimFiyat: DecimalLike,
  kdvOrani: DecimalLike
): string {
  const oran = toDecimal(kdvOrani);
  return toDecimal(netBirimFiyat)
    .times(toDecimal(1).plus(oran.dividedBy(100)))
    .toDecimalPlaces(BIRIM_FIYAT_BASAMAK)
    .toString();
}

/**
 * İşlemin cari bakiyesine etkisi.
 *
 * Şema kuralı: pozitif = alacak (cari bize borçlu), negatif = borç.
 * - SATIS: mal/hizmet sattık → cari bize borçlandı → bakiye ARTAR.
 * - ALIS:  mal/hizmet aldık → biz tedarikçiye borçlandık → bakiye AZALIR.
 */
export function cariBakiyeEtkisi(
  tip: IslemTipiValue,
  toplamTutar: DecimalLike
): string {
  const tutar = roundMoney(toplamTutar);
  return (tip === "ALIS" ? tutar.negated() : tutar).toString();
}

/** Bir etkinin geri alınması için uygulanacak ters tutar (işlem silindiğinde). */
export function tersEtki(etki: DecimalLike): string {
  return roundMoney(etki).negated().toString();
}

/** Cari yürüyen bakiyesi = açılış + Σ(işlem etkileri). */
export function hesaplaCariBakiyesi(
  acilisBakiyesi: DecimalLike,
  etkiler: DecimalLike[]
): string {
  let toplam = roundMoney(acilisBakiyesi);
  for (const e of etkiler) toplam = toplam.plus(roundMoney(e));
  return toplam.toString();
}

/** Saklanan cari bakiyesi, açılış + işlem etkileriyle tutuyor mu? */
export function cariBakiyesiMutabik(
  saklananBakiye: DecimalLike,
  acilisBakiyesi: DecimalLike,
  etkiler: DecimalLike[]
): boolean {
  return roundMoney(saklananBakiye).equals(
    toDecimal(hesaplaCariBakiyesi(acilisBakiyesi, etkiler))
  );
}
