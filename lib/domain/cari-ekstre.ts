import { roundMoney, toDecimal, type DecimalLike } from "@/lib/money";

/**
 * Cari ekstresi — saf mantık, Prisma'sız, doğrudan test edilebilir.
 *
 * Cari kartı yalnızca bir bakiye gösteriyordu; "-60.000 nereden çıktı?"
 * sorusunun cevabı kayıtları tek tek gezmekten geçiyordu. Ekstre, bakiyeyi
 * oluşturan HER hareketi kronolojik olarak ve yürüyen bakiyeyle gösterir.
 *
 * ## Değişmez
 * Ekstrenin son yürüyen bakiyesi, saklanan `Cari.bakiye` ile AYNI olmalıdır.
 * İkisi aynı kaynaklardan (`cariEtkileri`) türer; ayrışırlarsa ya ekstrede
 * eksik bir kaynak vardır ya da bakiye sürüklenmiştir. `ekstreMutabik` bunu
 * ölçer ve test bunu sabitler.
 *
 * ## Karşılıksız çek neden İKİ satır
 * Alan katmanı karşılıksız çekin NET etkisini tek sayı olarak verir
 * (yalnızca tahsil edilen kadar). Ekstrede bu, olan biteni anlatmaz. Bu yüzden
 * iki ayrı olay olarak yazılır: "çek alındı" (tam tutar) ve "karşılıksız çıktı"
 * (tahsil edilemeyen kısım geri döner). Toplamları net etkiye eşittir.
 */

export const CARI_HAREKET_TURLERI = [
  "ACILIS",
  "SATIS",
  "ALIS",
  "CEK_ALINAN",
  "CEK_VERILEN",
  "CEK_KARSILIKSIZ",
  "CIRO_ALINAN",
  "ODEME",
] as const;
export type CariHareketTuru = (typeof CARI_HAREKET_TURLERI)[number];

export const CARI_HAREKET_ETIKETI: Record<CariHareketTuru, string> = {
  ACILIS: "Açılış bakiyesi",
  SATIS: "Satış",
  ALIS: "Alış",
  CEK_ALINAN: "Çek/senet alındı",
  CEK_VERILEN: "Çek/senet verildi",
  CEK_KARSILIKSIZ: "Karşılıksız çıktı",
  CIRO_ALINAN: "Ciro ile devralındı",
  ODEME: "Ödeme",
};

export type CariHareketi = {
  tarih: Date;
  tur: CariHareketTuru;
  /** Satırda gösterilecek serbest açıklama (ürün, çek no, fatura vb.). */
  aciklama: string | null;
  /** Bakiyeye işaretli etkisi: pozitif alacak, negatif borç yönünde. */
  etki: string;
  /** İlgili kayda giden bağlantı; yoksa satır tıklanabilir olmaz. */
  href: string | null;
};

export type EkstreSatiri = CariHareketi & {
  /** Bu hareketten SONRAKİ bakiye. */
  yurutulenBakiye: string;
};

/**
 * Hareketleri kronolojik sıraya koyup yürüyen bakiyeyi hesaplar.
 *
 * Sıralama: önce tarih, sonra `tur` sırası. İkinci ölçüt gerekli — aynı gün
 * kaydedilen satış ve o satışın çeki karışırsa ekstre "önce çek geldi sonra
 * fatura kesildi" gibi okunur. `CARI_HAREKET_TURLERI` sırası bunu belirler:
 * açılış → satış/alış → çek → ciro → ödeme.
 */
export function cariEkstresi(
  acilisBakiyesi: DecimalLike,
  hareketler: CariHareketi[]
): EkstreSatiri[] {
  const sirali = [...hareketler].sort((a, b) => {
    const fark = a.tarih.getTime() - b.tarih.getTime();
    if (fark !== 0) return fark;
    return (
      CARI_HAREKET_TURLERI.indexOf(a.tur) - CARI_HAREKET_TURLERI.indexOf(b.tur)
    );
  });

  let toplam = roundMoney(acilisBakiyesi);
  return sirali.map((h) => {
    toplam = toplam.plus(roundMoney(h.etki));
    return { ...h, yurutulenBakiye: toplam.toString() };
  });
}

/** Ekstrenin son bakiyesi — hareket yoksa açılış bakiyesidir. */
export function ekstreSonBakiye(
  acilisBakiyesi: DecimalLike,
  satirlar: EkstreSatiri[]
): string {
  const son = satirlar.at(-1);
  return son ? son.yurutulenBakiye : roundMoney(acilisBakiyesi).toString();
}

/**
 * Ekstrenin son bakiyesi, saklanan cari bakiyesiyle tutuyor mu?
 * Tutmuyorsa ekstrede bir kaynak eksiktir — sessizce yanlış bir ekstre
 * göstermektense bunu ölçmek gerekir.
 */
export function ekstreMutabik(
  saklananBakiye: DecimalLike,
  acilisBakiyesi: DecimalLike,
  satirlar: EkstreSatiri[]
): boolean {
  return roundMoney(saklananBakiye).equals(
    toDecimal(ekstreSonBakiye(acilisBakiyesi, satirlar))
  );
}

/** Ekstre özeti: toplam borç ve alacak hareketleri (bakiye değil, ciro). */
export function ekstreOzeti(satirlar: EkstreSatiri[]) {
  let alacak = toDecimal(0);
  let borc = toDecimal(0);
  for (const s of satirlar) {
    const e = roundMoney(s.etki);
    if (e.greaterThan(0)) alacak = alacak.plus(e);
    else if (e.lessThan(0)) borc = borc.plus(e.negated());
  }
  return {
    /** Bakiyeyi ARTIRAN hareketlerin toplamı (satış, ciro devralma…). */
    toplamAlacak: alacak.toString(),
    /** Bakiyeyi AZALTAN hareketlerin toplamı (çek alma, ödeme, alış…). */
    toplamBorc: borc.toString(),
    hareketSayisi: satirlar.length,
  };
}
